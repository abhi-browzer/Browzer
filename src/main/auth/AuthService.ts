import { createClient, SupabaseClient, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { app, BrowserWindow, shell } from 'electron';
import Store from 'electron-store';
import { User, AuthSession, AuthResponse, SignUpCredentials, SignInCredentials } from '@/shared/types';

/**
 * AuthService - Manages authentication with Supabase
 * 
 * Features:
 * - Email/Password authentication
 * - Google OAuth (via PKCE flow)
 * - Session persistence using electron-store
 * - Automatic token refresh
 * - Secure session storage
 */
export class AuthService {
  private supabase: SupabaseClient;
  private sessionStore: Store;
  private refreshTimer: NodeJS.Timeout | null = null;
  private authWindow: BrowserWindow | null = null;

  constructor() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file');
    }

    // Initialize Supabase client
    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // We handle persistence manually
        detectSessionInUrl: false,
      },
    });

    // Initialize secure session storage
    this.sessionStore = new Store({
      name: 'auth-session',
      encryptionKey: 'browzer-auth-encryption-key', // In production, use a more secure key
    });

    // Setup auth state change listener
    this.setupAuthStateListener();

    // Restore session on startup
    this.restoreSession();
  }

  /**
   * Setup listener for auth state changes
   */
  private setupAuthStateListener(): void {
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session) {
        this.persistSession(session);
        this.scheduleTokenRefresh(session);
      } else if (event === 'SIGNED_OUT') {
        this.clearSession();
        this.cancelTokenRefresh();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        this.persistSession(session);
        this.scheduleTokenRefresh(session);
      }
    });
  }

  /**
   * Sign up with email and password
   */
  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            display_name: credentials.displayName,
          },
        },
      });

      if (error) {
        return {
          success: false,
          error: {
            code: error.status?.toString() || 'SIGNUP_ERROR',
            message: error.message,
          },
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: {
            code: 'NO_USER_DATA',
            message: 'Sign up succeeded but no user data returned',
          },
        };
      }

      return {
        success: true,
        user: this.mapSupabaseUser(data.user),
        session: this.mapSupabaseSession(data.session),
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'SIGNUP_EXCEPTION',
          message: error.message || 'An unexpected error occurred during sign up',
        },
      };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return {
          success: false,
          error: {
            code: error.status?.toString() || 'SIGNIN_ERROR',
            message: error.message,
          },
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: {
            code: 'NO_USER_DATA',
            message: 'Sign in succeeded but no user data returned',
          },
        };
      }

      return {
        success: true,
        user: this.mapSupabaseUser(data.user),
        session: this.mapSupabaseSession(data.session),
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'SIGNIN_EXCEPTION',
          message: error.message || 'An unexpected error occurred during sign in',
        },
      };
    }
  }

  /**
   * Sign in with Google OAuth (PKCE flow)
   */
  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: 'browzer://auth/callback',
        },
      });

      if (error) {
        return {
          success: false,
          error: {
            code: error.status?.toString() || 'OAUTH_ERROR',
            message: error.message,
          },
        };
      }

      // Open OAuth URL in external browser window
      const authUrl = data.url;
      if (!authUrl) {
        return {
          success: false,
          error: {
            code: 'NO_AUTH_URL',
            message: 'No authentication URL returned',
          },
        };
      }

      // Create auth window
      return await this.handleOAuthFlow(authUrl);
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'OAUTH_EXCEPTION',
          message: error.message || 'An unexpected error occurred during OAuth',
        },
      };
    }
  }

  /**
   * Handle OAuth flow in a separate window
   */
  private async handleOAuthFlow(authUrl: string): Promise<AuthResponse> {
    return new Promise((resolve) => {
      // Create a new window for OAuth
      this.authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      this.authWindow.loadURL(authUrl);

      // Listen for navigation to callback URL
      this.authWindow.webContents.on('will-redirect', async (event, url) => {
        if (url.startsWith('browzer://auth/callback')) {
          event.preventDefault();
          
          // Extract tokens from URL
          const urlParams = new URL(url);
          const accessToken = urlParams.searchParams.get('access_token');
          const refreshToken = urlParams.searchParams.get('refresh_token');

          if (accessToken && refreshToken) {
            // Set session with tokens
            const { data, error } = await this.supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (this.authWindow) {
              this.authWindow.close();
              this.authWindow = null;
            }

            if (error || !data.user || !data.session) {
              resolve({
                success: false,
                error: {
                  code: 'SESSION_ERROR',
                  message: error?.message || 'Failed to establish session',
                },
              });
            } else {
              resolve({
                success: true,
                user: this.mapSupabaseUser(data.user),
                session: this.mapSupabaseSession(data.session),
              });
            }
          } else {
            if (this.authWindow) {
              this.authWindow.close();
              this.authWindow = null;
            }
            resolve({
              success: false,
              error: {
                code: 'NO_TOKENS',
                message: 'No tokens received from OAuth provider',
              },
            });
          }
        }
      });

      // Handle window close
      this.authWindow.on('closed', () => {
        this.authWindow = null;
        resolve({
          success: false,
          error: {
            code: 'OAUTH_CANCELLED',
            message: 'OAuth flow was cancelled',
          },
        });
      });
    });
  }

  /**
   * Sign out
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      this.clearSession();
      this.cancelTokenRefresh();

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An unexpected error occurred during sign out',
      };
    }
  }

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const { data } = await this.supabase.auth.getSession();
      
      if (data.session) {
        return this.mapSupabaseSession(data.session);
      }

      return null;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data } = await this.supabase.auth.getUser();
      
      if (data.user) {
        return this.mapSupabaseUser(data.user);
      }

      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error || !data.session || !data.user) {
        return {
          success: false,
          error: {
            code: 'REFRESH_ERROR',
            message: error?.message || 'Failed to refresh session',
          },
        };
      }

      return {
        success: true,
        user: this.mapSupabaseUser(data.user),
        session: this.mapSupabaseSession(data.session),
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'REFRESH_EXCEPTION',
          message: error.message || 'An unexpected error occurred during session refresh',
        },
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        data: {
          display_name: updates.displayName,
          photo_url: updates.photoURL,
        },
      });

      if (error || !data.user) {
        return {
          success: false,
          error: {
            code: 'UPDATE_ERROR',
            message: error?.message || 'Failed to update profile',
          },
        };
      }

      return {
        success: true,
        user: this.mapSupabaseUser(data.user),
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'UPDATE_EXCEPTION',
          message: error.message || 'An unexpected error occurred during profile update',
        },
      };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'browzer://auth/reset-password',
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An unexpected error occurred during password reset',
      };
    }
  }

  /**
   * Persist session to secure storage
   */
  private persistSession(session: Session): void {
    this.sessionStore.set('session', {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: session.user,
    });
  }

  /**
   * Restore session from storage
   */
  private async restoreSession(): Promise<void> {
    try {
      const storedSession = this.sessionStore.get('session') as any;
      
      if (storedSession && storedSession.access_token && storedSession.refresh_token) {
        const { data, error } = await this.supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });

        if (error) {
          console.error('Failed to restore session:', error);
          this.clearSession();
        } else if (data.session) {
          console.log('Session restored successfully');
          this.scheduleTokenRefresh(data.session);
        }
      }
    } catch (error) {
      console.error('Error restoring session:', error);
      this.clearSession();
    }
  }

  /**
   * Clear session from storage
   */
  private clearSession(): void {
    this.sessionStore.delete('session');
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(session: Session): void {
    this.cancelTokenRefresh();

    if (session.expires_at) {
      // Refresh 5 minutes before expiry
      const expiresIn = session.expires_at * 1000 - Date.now() - 5 * 60 * 1000;
      
      if (expiresIn > 0) {
        this.refreshTimer = setTimeout(() => {
          this.refreshSession();
        }, expiresIn);
      }
    }
  }

  /**
   * Cancel scheduled token refresh
   */
  private cancelTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Map Supabase user to our User type
   */
  private mapSupabaseUser(supabaseUser: SupabaseUser): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      emailVerified: !!supabaseUser.email_confirmed_at,
      displayName: supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0],
      photoURL: supabaseUser.user_metadata?.photo_url || supabaseUser.user_metadata?.avatar_url,
      createdAt: supabaseUser.created_at,
      lastSignInAt: supabaseUser.last_sign_in_at || supabaseUser.created_at,
      metadata: supabaseUser.user_metadata,
    };
  }

  /**
   * Map Supabase session to our AuthSession type
   */
  private mapSupabaseSession(session: Session): AuthSession {
    return {
      user: this.mapSupabaseUser(session.user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at || 0,
    };
  }

  /**
   * Cleanup on app quit
   */
  destroy(): void {
    this.cancelTokenRefresh();
    if (this.authWindow) {
      this.authWindow.close();
      this.authWindow = null;
    }
  }
}
