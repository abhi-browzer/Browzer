import { create } from 'zustand';
import { AuthState, User, AuthSession } from '@/shared/types';

/**
 * Auth Store - Manages authentication state in renderer process
 * 
 * Features:
 * - Centralized auth state management
 * - Reactive updates across components
 * - Persists user and session data
 */
interface AuthStore extends AuthState {
  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: AuthSession | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  reset: () => void;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  session: null,
  loading: false,
  error: null,
};

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  setSession: (session) => set({ session }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
  
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  
  reset: () => set({ ...initialState, loading: false }),
}));
