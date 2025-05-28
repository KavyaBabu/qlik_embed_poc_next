export const QLIK_CONFIG = {
  host: process.env.NEXT_PUBLIC_QLIK_HOST!,
  appId: process.env.NEXT_PUBLIC_QLIK_APP_ID!,
  clientId: process.env.NEXT_PUBLIC_QLIK_CLIENT_ID!,
  webIntegrationId: process.env.NEXT_PUBLIC_QLIK_WEB_INTEGRATION_ID!,
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
} as const;

export const validateConfig = () => {
  const missingVars = Object.entries(QLIK_CONFIG).filter(([, value]) => !value);
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.map(([key]) => key).join(', ')}`
    );
  }
};