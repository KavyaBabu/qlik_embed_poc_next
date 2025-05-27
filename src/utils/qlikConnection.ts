import enigma from 'enigma.js';
import schema from 'enigma.js/schemas/12.612.0.json';

const fetchCsrfToken = async (tenantUrl: string, webIntegrationId: string) => {
  const csrfRes = await fetch(`https://${tenantUrl}/api/v1/csrf-token`, {
    credentials: 'include',
    headers: {
      'qlik-web-integration-id': webIntegrationId,
    },
  });

  if (!csrfRes.ok) {
    if (csrfRes.status === 401 || csrfRes.status === 403) {
      throw new Error('Qlik session expired or not authenticated. Please ensure you are logged in to Qlik Sense.');
    } else if (csrfRes.status === 404) {
      throw new Error('Qlik API endpoint not found. Please verify the tenant URL and web integration ID.');
    } else {
      throw new Error(`Failed to get Qlik CSRF token: HTTP Status ${csrfRes.status} - ${csrfRes.statusText}`);
    }
  }

  const csrfToken = csrfRes.headers.get('qlik-csrf-token') || '';
  if (!csrfToken) {
    throw new Error('Qlik CSRF token missing in response headers. Session might be invalid or misconfigured.');
  }

  return csrfToken;
};

export const connectToQlik = async (
  appId: string,
  tenantUrl: string,
  webIntegrationId: string,
  retryCount = 3,
  onError?: (message: string) => void
) => {
  let csrfToken = '';
  let session: any;
  let global: any;
  let app: any;
  let retryAttempts = 0;

  const handleGracefulError = (err: any) => {
    const message =
      typeof err?.message === 'string'
        ? err.message
        : typeof err === 'string'
        ? err
        : JSON.stringify(err);

    if (message.includes('Insufficient resources')) {
      onError?.(
        'Too many connections to Qlik Sense. Please close other tabs or wait a moment and try again.'
      );
    } else {
      onError?.(
        `Failed to connect to Qlik app: ${message || 'Unknown error'}. Please check app ID, network, or contact your administrator.`
      );
    }
  };

  const refreshSession = async () => {
    try {
      console.log('Attempting to refresh Qlik session...');
      csrfToken = await fetchCsrfToken(tenantUrl, webIntegrationId);

      if (session) {
        await session.close();
      }

      const wsUrl = `wss://${tenantUrl}/app/${appId}?qlik-web-integration-id=${webIntegrationId}&qlik-csrf-token=${csrfToken}`;

      session = enigma.create({
        schema,
        url: wsUrl,
        createSocket: (url) => {
          const ws = new WebSocket(url);
          ws.onerror = (event) => {
            handleGracefulError(event);
          };
          return ws;
        },
        suspendOnClose: true,
      });

      global = await session.open();
      app = await global.openDoc(appId);
      return { app, session };
    } catch (error) {
      handleGracefulError(error);
      throw error;
    }
  };

  try {
    csrfToken = await fetchCsrfToken(tenantUrl, webIntegrationId);

    const wsUrl = `wss://${tenantUrl}/app/${appId}?qlik-web-integration-id=${webIntegrationId}&qlik-csrf-token=${csrfToken}`;

    session = enigma.create({
      schema,
      url: wsUrl,
      createSocket: (url) => {
        const ws = new WebSocket(url);
        ws.onerror = (event) => {
          handleGracefulError(event);
        };
        return ws;
      },
      suspendOnClose: true,
    });

    session.on('closed', (hadError: boolean) => {
      console.warn('Enigma.js session closed.', hadError ? 'Due to error.' : '');
      if (hadError && retryAttempts < retryCount) {
        retryAttempts++;
        setTimeout(refreshSession, 1000 * retryAttempts);
      } else if (hadError) {
        onError?.(
          'Qlik session closed due to insufficient resources or network issues. Please try again later.'
        );
      }
    });

    session.on('suspended', () => {
      console.warn('Enigma.js session suspended. Attempting to resume...');
      session.resume().catch(() => {
        console.warn('Resume failed, attempting full refresh...');
        refreshSession();
      });
    });

    session.on('resumed', () => {
      console.info('Enigma.js session resumed successfully.');
      retryAttempts = 0;
    });

    session.on('notification:OnAuthenticationInformation', (event: any) => {
      if (event.mustAuthenticate) {
        console.warn('Qlik session requires reauthentication.');
        refreshSession();
      }
    });

    global = await session.open();
    app = await global.openDoc(appId);

    return {
      app,
      session,
      refreshSession,
    };
  } catch (error: any) {
    handleGracefulError(error);

    if (
      typeof error?.message === 'string' &&
      error.message.includes('token') &&
      retryAttempts < retryCount
    ) {
      retryAttempts++;
      console.log('Token might be expired, attempting refresh...');
      return refreshSession();
    }

    throw new Error(
      `Failed to connect to Qlik app: ${error?.message || 'Unknown error'}. Please check app ID or network connection.`
    );
  }
};
