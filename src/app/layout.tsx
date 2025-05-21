import './global.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Arqiva Meter Insight',
  description: 'Dashboard for monitoring meter insights',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <Script
          id="qlik-embed-script"
          src="https://cdn.jsdelivr.net/npm/@qlik/embed-web-components"
          strategy="beforeInteractive"
          data-auth-type="Oauth2"
          data-host="https://arqiva.uk.qlikcloud.com/"
          data-client-id="f6ec83d532eadf375cd98cfe709859df"
          data-redirect-uri="https://192.168.1.128:5500/oauth_callback.html"
          data-access-token-storage="session"
        />
        {children}
      </body>
    </html>
  );
}