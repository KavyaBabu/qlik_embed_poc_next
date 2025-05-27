import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem('qlik_token');
    router.replace(token ? '/dashboard' : '/auth');
  }, [router]);

  return null;
}