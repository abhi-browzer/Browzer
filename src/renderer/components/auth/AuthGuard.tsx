import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/renderer/hooks/useAuth';
import { AuthScreen } from './AuthScreen';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard - Protects routes and components requiring authentication
 * Shows AuthScreen if user is not authenticated
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading } = useAuth();
  const [browserInitialized, setBrowserInitialized] = useState(false);

  // Initialize browser after authentication
  useEffect(() => {
    if (isAuthenticated && !browserInitialized) {
      window.browserAPI.initializeBrowser()
        .then(() => {
          setBrowserInitialized(true);
        })
        .catch((error) => {
          console.error('Failed to initialize browser:', error);
        });
    }
  }, [isAuthenticated, browserInitialized]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Show loading while browser initializes
  if (!browserInitialized) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Initializing browser...</p>
        </div>
      </div>
    );
  }

  // User is authenticated and browser is initialized
  return <>{children}</>;
}
