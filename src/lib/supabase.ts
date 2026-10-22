import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase configuration from project instructions
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://xfuxnljfrgvusbrpvxpa.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (import.meta.env.DEV && typeof window !== 'undefined' ? localStorage.getItem('synesis_supabase_anon_key') || '' : '') ||
  'sb_publishable_4xzRp7eeyLuj1fQmmx_Vtw_-g_4MeCT';

// The released Candidate application must not silently use an old Supabase project.
if (import.meta.env.PROD && import.meta.env.VITE_CANDIDATE_PUBLIC_ONLY !== 'true' && SUPABASE_URL !== 'https://xfuxnljfrgvusbrpvxpa.supabase.co') {
  throw new Error('Candidate production release is configured for an unapproved HRIS database.');
}

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
