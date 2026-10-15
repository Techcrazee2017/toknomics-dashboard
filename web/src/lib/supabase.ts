import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
// Production builds have no localhost API to fall back to, so a missing VITE_API_URL is a config error there
export const configError = !url || !anon ? 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env'
  : import.meta.env.PROD && !apiUrl ? 'Set VITE_API_URL to the TokNomics API server URL' : null;

/** Browser client: anon key + the signed-in user's JWT, so RLS scopes every query. */
export const supabase = createClient(url ?? 'http://localhost:54321', anon ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
