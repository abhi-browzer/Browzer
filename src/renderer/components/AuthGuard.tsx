import { useEffect, ReactNode, useState } from 'react';
import { useAuthStore } from '@/renderer/stores/authStore';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * AuthGuard - Protects routes and components from unauthorized access
 * Shows loading state while checking authentication
 * Redirects to auth page if not authenticated
 * Initializes browser after authentication
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const [browserInitialized, setBrowserInitialized] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    // Initialize browser when user becomes authenticated
    const initBrowser = async () => {
      if (isAuthenticated && !isLoading) {
        try {
          const isInit = await window.browserAPI.isBrowserInitialized();
          if (!isInit) {
            await window.browserAPI.initializeBrowser();
          }
          setBrowserInitialized(true);
        } catch (error) {
          console.error('Failed to initialize browser:', error);
          setBrowserInitialized(true); // Continue anyway
        }
      }
    };

    initBrowser();
  }, [isAuthenticated, isLoading]);

  if (isLoading || (isAuthenticated && !browserInitialized)) {
    return (
      fallback || (
        <div className="w-full h-full flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading...' : 'Initializing browser...'}
            </p>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    // Redirect to auth page
    if (typeof window !== 'undefined') {
      window.location.hash = '#/auth';
    }
    return null;
  }

  return <>{children}</>;
}
