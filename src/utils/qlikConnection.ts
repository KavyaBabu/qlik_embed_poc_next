import enigma from 'enigma.js';
import schema from 'enigma.js/schemas/12.612.0.json';

export const connectToQlik = async (appId: string, tenantUrl: string, webIntegrationId: string) => {
  let csrfToken = '';

   try {
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

    csrfToken = csrfRes.headers.get('qlik-csrf-token') || '';

    if (!csrfToken) {
      throw new Error('Qlik CSRF token missing in response headers. Session might be invalid or misconfigured.');
    }

  } catch (error: any) {
    console.error("Error fetching Qlik CSRF token:", error);
    throw error;
  }

  const wsUrl = `wss://${tenantUrl}/app/${appId}?qlik-web-integration-id=${webIntegrationId}&qlik-csrf-token=${csrfToken}`;

  const session = enigma.create({
    schema, 
    url: wsUrl, 
    createSocket: (url) => new WebSocket(url), 
    suspendOnClose: true, 
  });

  try {
    const global = (await session.open()) as any; 
    const app = await global.openDoc(appId); 
    session.on('closed', (hadError: boolean) => {
        console.warn('Enigma.js session closed.', hadError ? 'Due to error.' : '');
    });

    session.on('suspended', () => {
        console.warn('Enigma.js session suspended. Attempting to resume...');
    });

    session.on('resumed', () => {
        console.info('Enigma.js session resumed successfully.');
    });

    return { app, session }; 
  } catch (error: any) {
    console.error("Error opening Qlik session or app:", error);
    throw new Error(`Failed to connect to Qlik app: ${error.message || 'Unknown error'}. Please check app ID or network connection.`);
  }
};
