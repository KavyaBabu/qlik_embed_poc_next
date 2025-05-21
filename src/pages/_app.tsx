import "@arqiva-cs/react-component-lib/styles/global.css";

import '../app/global.css'; 
import type { AppProps } from 'next/app';
import DashboardLayout from "layout/dashboard";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <DashboardLayout>
      <Component {...pageProps} />
    </DashboardLayout>
  );;
}
