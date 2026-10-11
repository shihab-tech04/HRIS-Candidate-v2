import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase configuration from project instructions
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://oslgwxaqfbteqtwqvdzs.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof window !== 'undefined' ? localStorage.getItem('synesis_supabase_anon_key') || '' : '');

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      return clientInstance;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

export function setCustomAnonKey(key: string) {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem('synesis_supabase_anon_key', key.trim());
    } else {
      localStorage.removeItem('synesis_supabase_anon_key');
    }
    clientInstance = null;
  }
}
