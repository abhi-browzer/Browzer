import { useAuthStore } from '@/renderer/stores/authStore';

/**
 * useAuth - Convenient hook for accessing authentication state and methods
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, signOut } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <div>Please sign in</div>;
 *   }
 *   
 *   return (
 *     <div>
 *       <p>Welcome, {user?.email}</p>
 *       <button onClick={signOut}>Sign Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth() {
  const store = useAuthStore();
  
  return {
    // State
    user: store.user,
    session: store.session,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    
    // Actions
    signUp: store.signUp,
    signIn: store.signIn,
    signInWithGoogle: store.signInWithGoogle,
    signOut: store.signOut,
    resetPassword: store.resetPassword,
    updatePassword: store.updatePassword,
    updateUserMetadata: store.updateUserMetadata,
    clearError: store.clearError,
  };
}
