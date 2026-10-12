import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const optional = (name: string): string | undefined => process.env[name]?.trim() || undefined;

/** Fails fast if the worker/API was handed an anon/publishable key — the usual cause of RLS violations on insert. */
export function assertServiceKey(key: string): void {
  if (key.startsWith('sb_secret_')) return;
  if (key.startsWith('sb_publishable_')) throw new Error('SUPABASE_SERVICE_ROLE_KEY is a publishable key; use the secret key');
  if (key.startsWith('eyJ')) {
    const role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role;
    if (role !== 'service_role') throw new Error(`SUPABASE_SERVICE_ROLE_KEY has role "${role}", expected "service_role"`);
    return;
  }
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not a recognised Supabase key');
}

export function serviceClient(): SupabaseClient {
  const key = need('SUPABASE_SERVICE_ROLE_KEY');
  assertServiceKey(key);
  return createClient(need('SUPABASE_URL'), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const redact = (url: string) => url.replace(/(apiKey|jwtKey)=[^&]+/gi, '$1=***');

export const log = (o: Record<string, unknown>) => console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));
