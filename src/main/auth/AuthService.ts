import { BrowserWindow } from 'electron';
import Store from 'electron-store';
import {
  User,
  AuthSession,
  AuthResponse,
  SignUpCredentials,
  SignInCredentials,
  UpdateProfileRequest,
  SimpleResponse,
} from '@/shared/types';
import { BrowserManager } from '@/main/BrowserManager';
import { api } from '@/main/api';

export class AuthService {
  private sessionStore: Store;
  private refreshTimer: NodeJS.Timeout | null = null;
  private authWindow: BrowserWindow | null = null;
  private readonly browserManager: BrowserManager;

  

  constructor(
    browserManager: BrowserManager,
  ) {
    this.browserManager = browserManager;

    // Initialize secure session storage
    this.sessionStore = new Store({
      name: 'auth-session',
      encryptionKey: 'browzer-auth-encryption-key', // In production, use env variable
    });

    // Restore session on startup
    this.restoreSession();
  }

  /**
   * Sign up with email and password
   */
  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>(
        '/auth/signup',
        {
          email: credentials.email,
          password: credentials.password,
          display_name: credentials.display_name || null,
        }
      );

      if (!response.success) {
        return {
          success: false,
          error: {
            code: 'SIGNUP_FAILED',
            message: response.error || 'Sign up failed',
          },
        };
      }

      return response.data;
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
      const response = await api.post<AuthResponse>(
        '/auth/signin',
        {
          email: credentials.email,
          password: credentials.password,
        }
      );

      if (!response.success || !response.data) {
        return {
          success: false,
          error: {
            code: 'SIGNIN_FAILED',
            message: response.error || 'Sign in failed',
          },
        };
      }

      const authResponse = response.data;

      // If sign in successful, persist session
      if (authResponse.success && authResponse.session) {
        this.persistSession(authResponse.session);
        this.scheduleTokenRefresh(authResponse.session);
      }

      return authResponse;
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
   * Sign in with Google OAuth
   * TODO: Implement OAuth flow through backend
   */
  async signInWithGoogle(): Promise<AuthResponse> {
    return {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Google OAuth not yet implemented with backend',
      },
    };
  }

  /**
   * Sign out
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.getStoredSession();
      
      if (session) {
        // Call backend signout endpoint
        await api.post<SimpleResponse>('/auth/signout');
      }

      this.clearSession();
      this.cancelTokenRefresh();
      this.browserManager.destroy();

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
      const storedSession = this.getStoredSession();
      
      if (!storedSession) {
        return null;
      }

      // Validate session with backend
      const user = await this.getCurrentUser();
      
      if (!user) {
        this.clearSession();
        return null;
      }

      return storedSession;
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
      const session = this.getStoredSession();
      
      if (!session) {
        return null;
      }

      const response = await api.get<AuthResponse>('/auth/user');

      if (!response.success || !response.data || !response.data.user) {
        return null;
      }

      return response.data.user;
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
      const storedSession = this.getStoredSession();
      
      if (!storedSession || !storedSession.refresh_token) {
        return {
          success: false,
          error: {
            code: 'NO_SESSION',
            message: 'No session to refresh',
          },
        };
      }

      const response = await api.post<AuthResponse>(
        '/auth/refresh',
        {
          refresh_token: storedSession.refresh_token,
        }
      );

      if (!response.success || !response.data) {
        this.clearSession();
        return {
          success: false,
          error: {
            code: 'REFRESH_FAILED',
            message: response.error || 'Failed to refresh session',
          },
        };
      }

      const authResponse = response.data;

      // Persist new session
      if (authResponse.success && authResponse.session) {
        this.persistSession(authResponse.session);
        this.scheduleTokenRefresh(authResponse.session);
      }

      return authResponse;
    } catch (error: any) {
      this.clearSession();
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
  async updateProfile(updates: UpdateProfileRequest): Promise<AuthResponse> {
    try {
      const response = await api.put<AuthResponse>(
        '/auth/profile',
        updates
      );

      if (!response.success || !response.data) {
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: response.error || 'Failed to update profile',
          },
        };
      }

      return response.data;
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
   * Verify email with OTP code
   */
  async verifyEmailOTP(email: string, token: string): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>(
        '/auth/verify-otp',
        {
          email,
          token,
        }
      );

      if (!response.success || !response.data) {
        return {
          success: false,
          error: {
            code: 'VERIFY_FAILED',
            message: response.error || 'Verification failed',
          },
        };
      }

      const authResponse = response.data;

      // If verification successful, persist session
      if (authResponse.success && authResponse.session) {
        this.persistSession(authResponse.session);
        this.scheduleTokenRefresh(authResponse.session);
      }

      return authResponse;
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'VERIFY_EXCEPTION',
          message: error.message || 'An unexpected error occurred during verification',
        },
      };
    }
  }

  /**
   * Resend verification OTP
   */
  async resendVerificationOTP(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await api.post<SimpleResponse>(
        '/auth/resend-otp',
        { email }
      );

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'Failed to resend OTP',
        };
      }

      return {
        success: response.data.success,
        error: response.data.error || undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An unexpected error occurred while resending OTP',
      };
    }
  }

  /**
   * Send password reset OTP to email
   */
  async sendPasswordResetOTP(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await api.post<SimpleResponse>(
        '/auth/password-reset',
        { email }
      );

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'Failed to send reset code',
        };
      }

      return {
        success: response.data.success,
        error: response.data.error || undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An unexpected error occurred while sending reset code',
      };
    }
  }

  /**
   * Verify password reset OTP and update password
   */
  async verifyPasswordResetOTP(
    email: string,
    token: string,
    newPassword: string
  ): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>(
        '/auth/password-reset/verify',
        {
          email,
          token,
          new_password: newPassword,
        }
      );

      if (!response.success || !response.data) {
        return {
          success: false,
          error: {
            code: 'RESET_FAILED',
            message: response.error || 'Password reset failed',
          },
        };
      }

      const authResponse = response.data;

      // If reset successful, persist new session
      if (authResponse.success && authResponse.session) {
        this.persistSession(authResponse.session);
        this.scheduleTokenRefresh(authResponse.session);
      }

      return authResponse;
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'RESET_EXCEPTION',
          message: error.message || 'An unexpected error occurred during password reset',
        },
      };
    }
  }

  /**
   * Resend password reset OTP
   */
  async resendPasswordResetOTP(email: string): Promise<{ success: boolean; error?: string }> {
    return this.sendPasswordResetOTP(email);
  }

  /**
   * Persist session to secure storage
   */
  private persistSession(session: AuthSession): void {
    this.sessionStore.set('session', session);
  }

  /**
   * Get stored session
   */
  private getStoredSession(): AuthSession | null {
    try {
      const session = this.sessionStore.get('session') as AuthSession | undefined;
      return session || null;
    } catch (error) {
      console.error('Error getting stored session:', error);
      return null;
    }
  }

  /**
   * Restore session from storage
   */
  private async restoreSession(): Promise<void> {
    try {
      const storedSession = this.getStoredSession();
      
      if (storedSession && storedSession.access_token) {
        // Validate session with backend
        const user = await this.getCurrentUser();
        
        if (user) {
          console.log('Session restored successfully');
          this.scheduleTokenRefresh(storedSession);
        } else {
          console.log('Stored session is invalid');
          this.clearSession();
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
  private scheduleTokenRefresh(session: AuthSession): void {
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
