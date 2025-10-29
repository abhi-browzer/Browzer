import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client singleton for main process
 * Uses environment variables for configuration
 */
class SupabaseClientManager {
  private static instance: SupabaseClient | null = null;

  static getClient(): SupabaseClient {
    if (!this.instance) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          'Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file'
        );
      }

      this.instance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          // Store session in memory for Electron main process
          storage: undefined,
          autoRefreshToken: true,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    }

    return this.instance;
  }

  static resetClient(): void {
    this.instance = null;
  }
}

export const getSupabaseClient = () => SupabaseClientManager.getClient();
export const resetSupabaseClient = () => SupabaseClientManager.resetClient();