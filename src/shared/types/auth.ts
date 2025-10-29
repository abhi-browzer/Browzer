/**
 * Authentication related types
 */

export interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
  created_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: User;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  metadata?: {
    full_name?: string;
  };
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthError {
  message: string;
  status?: number;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  session?: Session;
  error?: AuthError;
}
