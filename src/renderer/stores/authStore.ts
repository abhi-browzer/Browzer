import { create } from 'zustand';
import { User, Session, SignUpCredentials, SignInCredentials } from '@/shared/types';

interface AuthStore {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<{ success: boolean; error?: string }>;
  signIn: (credentials: SignInCredentials) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateUserMetadata: (metadata: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const [session, user, isAuthenticated] = await Promise.all([
        window.browserAPI.getSession(),
        window.browserAPI.getUser(),
        window.browserAPI.isAuthenticated(),
      ]);

      set({
        session,
        user,
        isAuthenticated,
        isLoading: false,
      });

      // Listen for auth state changes
      window.browserAPI.onAuthStateChanged((data) => {
        set({
          user: data.user,
          session: data.session,
          isAuthenticated: !!data.user && !!data.session,
        });
      });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize authentication',
      });
    }
  },

  signUp: async (credentials) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await window.browserAPI.signUp(credentials);
      
      if (response.success) {
        set({
          user: response.user || null,
          session: response.session || null,
          isAuthenticated: !!(response.user && response.session),
          isLoading: false,
        });
        return { success: true };
      } else {
        set({
          isLoading: false,
          error: response.error?.message || 'Sign up failed',
        });
        return {
          success: false,
          error: response.error?.message || 'Sign up failed',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during sign up';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  signIn: async (credentials) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await window.browserAPI.signIn(credentials);
      
      if (response.success) {
        set({
          user: response.user || null,
          session: response.session || null,
          isAuthenticated: !!(response.user && response.session),
          isLoading: false,
        });
        return { success: true };
      } else {
        set({
          isLoading: false,
          error: response.error?.message || 'Sign in failed',
        });
        return {
          success: false,
          error: response.error?.message || 'Sign in failed',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during sign in';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  signInWithGoogle: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await window.browserAPI.signInWithGoogle();
      
      if (response.success) {
        // OAuth flow will handle session via callback
        set({ isLoading: false });
        return { success: true };
      } else {
        set({
          isLoading: false,
          error: response.error?.message || 'Google sign in failed',
        });
        return {
          success: false,
          error: response.error?.message || 'Google sign in failed',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during Google sign in';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true, error: null });
      
      await window.browserAPI.signOut();
      
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to sign out:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to sign out',
      });
    }
  },

  resetPassword: async (email) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await window.browserAPI.resetPassword(email);
      
      set({ isLoading: false });
      
      if (response.success) {
        return { success: true };
      } else {
        const errorMessage = response.error?.message || 'Password reset failed';
        set({ error: errorMessage });
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during password reset';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  updatePassword: async (newPassword) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await window.browserAPI.updatePassword(newPassword);
      
      set({ isLoading: false });
      
      if (response.success) {
        return { success: true };
      } else {
        const errorMessage = response.error?.message || 'Password update failed';
        set({ error: errorMessage });
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during password update';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  updateUserMetadata: async (metadata) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await window.browserAPI.updateUserMetadata(metadata);
      
      if (response.success && response.user) {
        set({
          user: response.user,
          isLoading: false,
        });
        return { success: true };
      } else {
        const errorMessage = response.error?.message || 'Profile update failed';
        set({ isLoading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during profile update';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  clearError: () => set({ error: null }),
  
  setLoading: (loading) => set({ isLoading: loading }),
}));
