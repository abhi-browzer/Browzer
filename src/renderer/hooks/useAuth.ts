import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/renderer/stores/authStore';
import { SignUpCredentials, SignInCredentials, AuthResponse } from '@/shared/types';
import { toast } from 'sonner';

/**
 * useAuth Hook - Provides authentication functionality to components
 * 
 * Features:
 * - Sign up, sign in, sign out
 * - Google OAuth
 * - Session management
 * - Profile updates
 * - Password reset
 */
export function useAuth() {
  const {
    isAuthenticated,
    user,
    session,
    loading,
    error,
    setUser,
    setSession,
    setLoading,
    setError,
    reset,
  } = useAuthStore();

  /**
   * Initialize authentication state
   */
  const initializeAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentSession = await window.authAPI.getCurrentSession();
      
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      } else {
        reset();
      }
    } catch (err: any) {
      console.error('Failed to initialize auth:', err);
      setError(err.message || 'Failed to initialize authentication');
      reset();
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSession, setUser, reset]);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(async (credentials: SignUpCredentials): Promise<AuthResponse> => {
    try {
      setLoading(true);
      setError(null);

      const response = await window.authAPI.signUp(credentials);

      if (response.success && response.user && response.session) {
        setUser(response.user);
        setSession(response.session);
      } else if (response.error) {
        setError(response.error.message);
      }

      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign up';
      setError(errorMessage);
      return {
        success: false,
        error: {
          code: 'SIGNUP_EXCEPTION',
          message: errorMessage,
        },
      };
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setUser, setSession]);

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (credentials: SignInCredentials): Promise<AuthResponse> => {
    try {
      setLoading(true);
      setError(null);

      const response = await window.authAPI.signIn(credentials);

      if (response.success && response.user && response.session) {
        setUser(response.user);
        setSession(response.session);
      } else if (response.error) {
        setError(response.error.message);
      }

      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign in';
      setError(errorMessage);
      return {
        success: false,
        error: {
          code: 'SIGNIN_EXCEPTION',
          message: errorMessage,
        },
      };
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setUser, setSession]);

  /**
   * Sign in with Google
   */
  const signInWithGoogle = useCallback(async (): Promise<AuthResponse> => {
    try {
      setLoading(true);
      setError(null);

      const response = await window.authAPI.signInWithGoogle();
      console.log("response: ", response);

      if (response.success && response.user && response.session) {
        setUser(response.user);
        setSession(response.session);
        toast.success('Signed in successfully');
      } else if (response.error) {
        console.log("error: ", response.error);
        setError(response.error.message);
        toast.error(response.error.message);
      }

      return response;
    } catch (err: any) {
      toast.error(err.message);
      const errorMessage = err.message || 'Failed to sign in with Google';
      setError(errorMessage);
      return {
        success: false,
        error: {
          code: 'GOOGLE_SIGNIN_EXCEPTION',
          message: errorMessage,
        },
      };
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setUser, setSession]);

  /**
   * Sign out
   */
  const signOut = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const result = await window.authAPI.signOut();

      if (result.success) {
        reset();
      } else if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign out';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, reset]);

  /**
   * Refresh session
   */
  const refreshSession = useCallback(async (): Promise<AuthResponse> => {
    try {
      setLoading(true);
      setError(null);

      const response = await window.authAPI.refreshSession();

      if (response.success && response.user && response.session) {
        setUser(response.user);
        setSession(response.session);
      } else if (response.error) {
        setError(response.error.message);
      }

      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to refresh session';
      setError(errorMessage);
      return {
        success: false,
        error: {
          code: 'REFRESH_EXCEPTION',
          message: errorMessage,
        },
      };
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setUser, setSession]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(
    async (updates: { displayName?: string; photoURL?: string }): Promise<AuthResponse> => {
      try {
        setLoading(true);
        setError(null);

        const response = await window.authAPI.updateProfile(updates);

        if (response.success && response.user) {
          setUser(response.user);
        } else if (response.error) {
          setError(response.error.message);
        }

        return response;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to update profile';
        setError(errorMessage);
        return {
          success: false,
          error: {
            code: 'UPDATE_EXCEPTION',
            message: errorMessage,
          },
        };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setUser]
  );

  /**
   * Reset password
   */
  const resetPassword = useCallback(
    async (email: string): Promise<{ success: boolean; error?: string }> => {
      try {
        setLoading(true);
        setError(null);

        const result = await window.authAPI.resetPassword(email);

        if (!result.success && result.error) {
          setError(result.error);
        }

        return result;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to reset password';
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  return {
    // State
    isAuthenticated,
    user,
    session,
    loading,
    error,

    // Actions
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refreshSession,
    updateProfile,
    resetPassword,
    initializeAuth,
  };
}
