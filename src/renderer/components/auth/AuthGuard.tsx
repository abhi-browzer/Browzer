import { ReactNode, useEffect, useState, useRef } from 'react';
import { useAuth } from '@/renderer/hooks/useAuth';
import { AuthScreen } from './AuthScreen';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading } = useAuth();
  const [browserReady, setBrowserReady] = useState(false);
  const browserInitRef = useRef(false);

  useEffect(() => {
    const shouldInitialize = isAuthenticated && !browserReady && !browserInitRef.current;
    
    if (!shouldInitialize) return;

    browserInitRef.current = true;
    console.log('[AuthGuard] Initializing browser...');

    window.browserAPI
      .initializeBrowser()
      .then(() => {
        console.log('[AuthGuard] Browser ready');
        setBrowserReady(true);
      })
      .catch((error) => {
        console.error('[AuthGuard] Browser initialization failed:', error);
        browserInitRef.current = false; // Allow retry
      });
  }, [isAuthenticated, browserReady]);

  useEffect(() => {
    if (!isAuthenticated && browserReady) {
      console.log('[AuthGuard] User signed out, resetting browser state');
      setBrowserReady(false);
      browserInitRef.current = false;
    }
  }, [isAuthenticated, browserReady]);

  // State 1: Loading authentication
  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  // State 2: Not authenticated
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // State 3: Authenticated but browser not ready
  if (!browserReady) {
    return <LoadingScreen message="Initializing browser..." />;
  }

  // State 4: Fully ready
  return <>{children}</>;
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <section className='h-screen flex flex-col items-center justify-center'>
      <Loader2 className='size-4 font-bold'/>
      <p className="text-slate-600 dark:text-slate-400">{message}</p>
    </section>
  );
}