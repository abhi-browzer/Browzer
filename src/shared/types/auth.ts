/**
 * Authentication related types
 */

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  lastSignInAt: string;
  metadata?: Record<string, any>;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthError {
  code: string;
  message: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  session?: AuthSession;
  error?: AuthError;
}
