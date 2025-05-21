import enigma from 'enigma.js';
import schema from 'enigma.js/schemas/12.612.0.json';

export const connectToQlik = async (
  appId: string,
  tenantUrl: string,
  webIntegrationId: string
) => {
  const csrfRes = await fetch(`https://${tenantUrl}/api/v1/csrf-token`, {
    credentials: 'include',
    headers: {
      'qlik-web-integration-id': webIntegrationId,
    },
  });

  if (!csrfRes.ok) {
    throw new Error('Authentication failed');
  }
  const csrfToken = csrfRes.headers.get('qlik-csrf-token') || '';

  const wsUrl = `wss://${tenantUrl}/app/${appId}?qlik-web-integration-id=${webIntegrationId}&qlik-csrf-token=${csrfToken}`;

  const session = enigma.create({
    schema,
    url: wsUrl,
    createSocket: url => new WebSocket(url),
  });

  const global = await session.open() as any;
  const app = await global.openDoc(appId);
  return { app, session };
};
