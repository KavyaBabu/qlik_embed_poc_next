import Script from 'next/script';
import Head from 'next/head';
import '@arqiva-cs/react-component-lib/styles/global.css';
import '../app/global.css';
import type { AppProps } from 'next/app';
import DashboardLayout from 'layout/dashboard';

export default function App({ Component, pageProps }: AppProps) {
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
        data-host="https://arqiva.uk.qlikcloud.com/"
        data-client-id="f6ec83d532eadf375cd98cfe709859df"
        data-redirect-uri="https://192.168.1.128:5500/oauth_callback.html"
        data-access-token-storage="session"
        data-auth-type="oauth2"
      />
      <DashboardLayout>
        <Component {...pageProps} />
      </DashboardLayout>
    </>
  );
}
