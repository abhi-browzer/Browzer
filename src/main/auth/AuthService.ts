import { app } from 'electron';
import Store from 'electron-store';
import { getSupabaseClient } from './supabaseClient';
import { 
  User, 
  Session, 
  SignUpCredentials, 
  SignInCredentials, 
  AuthResponse 
} from '@/shared/types';

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: User;
}

/**
 * AuthService - Handles all authentication operations in the main process
 * - Integrates with Supabase for authentication
 * - Manages session persistence using electron-store
 * - Handles token refresh automatically
 */
export class AuthService {
  private store: Store<{ session: StoredSession | null }>;
  private currentSession: Session | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.store = new Store({
      name: 'auth-session',
      encryptionKey: 'browzer-auth-encryption-key', // In production, use a more secure key
    });

    // Load session from store on initialization
    this.loadSession();
  }

  /**
   * Load session from persistent storage
   */
  private loadSession(): void {
    try {
      const storedSession = this.store.get('session');
      if (storedSession) {
        this.currentSession = storedSession;
        this.scheduleTokenRefresh();
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      this.clearSession();
    }
  }

  /**
   * Save session to persistent storage
   */
  private saveSession(session: Session): void {
    try {
      this.currentSession = session;
      this.store.set('session', session);
      this.scheduleTokenRefresh();
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  /**
   * Clear session from memory and storage
   */
  private clearSession(): void {
    this.currentSession = null;
    this.store.delete('session');
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.currentSession) return;

    const expiresAt = this.currentSession.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Refresh 5 minutes before expiry
    const refreshTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);

    this.refreshTimer = setTimeout(() => {
      this.refreshSession();
    }, refreshTime);
  }

  /**
   * Refresh the current session
   */
  private async refreshSession(): Promise<void> {
    try {
      if (!this.currentSession) return;

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: this.currentSession.refresh_token,
      });

      if (error) throw error;

      if (data.session) {
        const session: Session = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at || 0,
          user: {
            id: data.session.user.id,
            email: data.session.user.email || '',
            user_metadata: data.session.user.user_metadata,
            created_at: data.session.user.created_at || '',
          },
        };
        this.saveSession(session);
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      this.clearSession();
    }
  }

  /**
   * Sign up a new user with email and password
   */
  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: credentials.metadata,
        },
      });

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            status: error.status,
          },
        };
      }

      if (data.session && data.user) {
        const session: Session = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at || 0,
          user: {
            id: data.user.id,
            email: data.user.email || '',
            user_metadata: data.user.user_metadata,
            created_at: data.user.created_at || '',
          },
        };

        this.saveSession(session);

        return {
          success: true,
          user: session.user,
          session,
        };
      }

      // Email confirmation required
      return {
        success: true,
        user: data.user ? {
          id: data.user.id,
          email: data.user.email || '',
          user_metadata: data.user.user_metadata,
          created_at: data.user.created_at || '',
        } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            status: error.status,
          },
        };
      }

      if (data.session && data.user) {
        const session: Session = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at || 0,
          user: {
            id: data.user.id,
            email: data.user.email || '',
            user_metadata: data.user.user_metadata,
            created_at: data.user.created_at || '',
          },
        };

        this.saveSession(session);

        return {
          success: true,
          user: session.user,
          session,
        };
      }

      return {
        success: false,
        error: {
          message: 'Failed to create session',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            status: error.status,
          },
        };
      }

      // OAuth flow will redirect to browser, session will be handled via callback
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<AuthResponse> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            status: error.status,
          },
        };
      }

      this.clearSession();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Get the current session
   */
  getSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Get the current user
   */
  getUser(): User | null {
    return this.currentSession?.user || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.currentSession) return false;

    const now = Date.now();
    const expiresAt = this.currentSession.expires_at * 1000;

    return now < expiresAt;
  }

  /**
   * Reset password via email
   */
  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'browzer://auth/reset-password',
      });

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            status: error.status,
          },
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            status: error.status,
          },
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Update user metadata
   */
  async updateUserMetadata(metadata: Record<string, unknown>): Promise<AuthResponse> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.updateUser({
        data: metadata,
      });

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            status: error.status,
          },
        };
      }

      if (data.user && this.currentSession) {
        const updatedSession: Session = {
          ...this.currentSession,
          user: {
            ...this.currentSession.user,
            user_metadata: data.user.user_metadata,
          },
        };
        this.saveSession(updatedSession);

        return {
          success: true,
          user: updatedSession.user,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Handle OAuth callback (for Google sign-in)
   */
  async handleOAuthCallback(url: string): Promise<AuthResponse> {
    try {
      const supabase = getSupabaseClient();
      
      // Extract tokens from URL
      const urlParams = new URL(url).searchParams;
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        return {
          success: false,
          error: {
            message: 'Invalid OAuth callback URL',
          },
        };
      }

      // Set the session
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            status: error.status,
          },
        };
      }

      if (data.session && data.user) {
        const session: Session = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at || 0,
          user: {
            id: data.user.id,
            email: data.user.email || '',
            user_metadata: data.user.user_metadata,
            created_at: data.user.created_at || '',
          },
        };

        this.saveSession(session);

        return {
          success: true,
          user: session.user,
          session,
        };
      }

      return {
        success: false,
        error: {
          message: 'Failed to create session',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Cleanup on app quit
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
