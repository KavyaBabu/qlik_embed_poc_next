import Script from 'next/script';
import Head from 'next/head';
import '@arqiva-cs/react-component-lib/styles/global.css';
import '../app/global.css';
import type { AppProps } from 'next/app';
import DashboardLayout from 'layout/dashboard';
import { useRouter } from 'next/router';
import { QLIK_CONFIG } from '../config/qlik';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const showLayout = router.pathname !== '/auth';

  return (
    <>
      <Head>
        <title>Qlik Embed Analytics Dashboard</title>
      </Head>
      <Script
        id="qlik-embed-script"
        src="https://cdn.jsdelivr.net/npm/@qlik/embed-web-components"
        strategy="lazyOnload"
        crossOrigin="anonymous"
        data-host={QLIK_CONFIG.host}
        data-client-id={QLIK_CONFIG.clientId}
        data-redirect-uri={QLIK_CONFIG.redirectUri}
        data-access-token-storage="session"
        data-auth-type="oauth2"
      />
      {showLayout ? (
        <DashboardLayout>
          <Component {...pageProps} />
        </DashboardLayout>
      ) : (
        <Component {...pageProps} />
      )}
    </>
  );
}