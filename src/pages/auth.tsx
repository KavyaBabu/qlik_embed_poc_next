import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@arqiva-cs/react-component-lib';

const QlikEmbed = 'qlik-embed' as any;

const AuthPage = () => {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    const token = sessionStorage.getItem('qlik_token');
    if (token) {
      router.replace('/dashboard');
      return;
    }

    // Check if script is loaded
    const checkScript = () => {
      if (window.qlikEmbed) {
        setIsScriptLoaded(true);
        return true;
      }
      return false;
    };

    if (!checkScript()) {
      const interval = setInterval(() => {
        if (checkScript()) {
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    }

    // Listen for authentication events
    const handleAuthenticated = (event: CustomEvent) => {
      const token = event.detail;
      sessionStorage.setItem('qlik_token', token);
      router.replace('/dashboard');
    };

    window.addEventListener('qlik-auth-success', handleAuthenticated as EventListener);

    return () => {
      window.removeEventListener('qlik-auth-success', handleAuthenticated as EventListener);
    };
  }, [router]);

  const handleSignIn = () => {
    if (!isScriptLoaded) {
      console.error('Qlik embed script not loaded');
      return;
    }

    setIsAuthenticating(true);
    const qlikAuth = window.qlikEmbed.connect();
    
    qlikAuth.on('authenticated', (token: string) => {
      const event = new CustomEvent('qlik-auth-success', { detail: token });
      window.dispatchEvent(event);
    });

    qlikAuth.on('error', (error: Error) => {
      console.error('Authentication error:', error);
      setIsAuthenticating(false);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Meter Insight
          </h2>
        </div>
        <div>
          <Button
            onClick={handleSignIn}
            disabled={isAuthenticating || !isScriptLoaded}
            style={{ width: '100%' }}
          >
            {isAuthenticating ? 'Signing in...' : !isScriptLoaded ? 'Loading...' : 'Sign in with Qlik'}
          </Button>
        </div>
      </div>
      <div id="qlik-embed"></div>
    </div>
  );
};

export default AuthPage;