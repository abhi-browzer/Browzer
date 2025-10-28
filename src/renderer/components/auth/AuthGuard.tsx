import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/renderer/hooks/useAuth';
import { AuthScreen } from './AuthScreen';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard - Protects routes and components requiring authentication
 * Shows AuthScreen if user is not authenticated
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading, initializeAuth,  } = useAuth();

  initializeAuth().then(() => {
    toast.success('Auth initialized');
  }).catch((error) => {
    console.error("auth state: ", error);
    toast.error('Failed to initialize auth');
  });

  if (loading) {
    toast.loading('Loading...');
    return (
      <Loader2Icon className="h-4 w-4 animate-spin text-primary" />
    );
  }

  if (!isAuthenticated) {
    toast.loading('Authenticating...')
    return <AuthScreen />;
  }

  return <>{children}</>;
}
