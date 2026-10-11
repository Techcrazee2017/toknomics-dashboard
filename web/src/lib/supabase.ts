import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configError = !url || !anon ? 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env' : null;

/** Browser client: anon key + the signed-in user's JWT, so RLS scopes every query. */
export const supabase = createClient(url ?? 'http://localhost:54321', anon ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
