/**
 * Supabase Client Configuration
 *
 * Initializes and exports the Supabase client for authentication.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isLocalDev = import.meta.env.VITE_LOCAL_DEV_MODE === 'true' || 
                   (import.meta.env.DEV && supabaseUrl?.includes('dummy'));

if (!supabaseUrl || !supabaseAnonKey) {
  if (isLocalDev) {
    console.warn('[Supabase] Local dev mode: Using dummy Supabase credentials. Authentication will be bypassed.');
  } else {
    console.error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  }
}

// Use dummy values if missing (for local dev)
const finalUrl = supabaseUrl || 'https://dummy-project.supabase.co';
const finalKey = supabaseAnonKey || 'dummy-anon-key-for-local-dev';

export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Use PKCE flow for better security
    flowType: 'pkce',
    // Storage key for the session
    storageKey: 'lokus-auth',
  },
});

export default supabase;
