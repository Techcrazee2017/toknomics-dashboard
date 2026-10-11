import type { Context, MiddlewareHandler } from 'hono';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { CAN, type Role } from '@toknomics/shared';
import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(readonly status: 400 | 401 | 402 | 403 | 404 | 409 | 429 | 500 | 502 | 503, message: string, readonly code?: string, readonly fields?: Record<string, string>) {
    super(message);
  }
}

export type AppEnv = {
  Variables: {
    user: User;
    agencyId: string;
    role: Role;
  };
};

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
  throw new HttpError(400, Object.values(fields)[0] ?? 'Invalid request', 'validation', fields);
}

export async function jsonBody(c: Context): Promise<unknown> {
  try { return await c.req.json(); } catch { throw new HttpError(400, 'Expected a JSON body'); }
}

/** Verifies the Supabase access token. Every /api/agencies route sits behind this. */
export function requireUser(db: SupabaseClient): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new HttpError(401, 'Sign in required');
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'Session expired. Sign in again.');
    c.set('user', data.user);
    await next();
  };
}

/** Resolves the caller's role in :agencyId; non-members get 404 so agency ids can't be probed. */
export function requireMember(db: SupabaseClient): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const agencyId = c.req.param('agencyId') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(agencyId)) throw new HttpError(404, 'Agency not found');
    const { data, error } = await db.from('agency_members').select('role').eq('agency_id', agencyId).eq('user_id', c.get('user').id).maybeSingle();
    if (error) throw new HttpError(500, 'Could not load membership');
    if (!data) throw new HttpError(404, 'Agency not found');
    c.set('agencyId', agencyId);
    c.set('role', data.role as Role);
    await next();
  };
}

export function allow(c: Context<AppEnv>, check: keyof typeof CAN, message?: string) {
  if (!CAN[check](c.get('role'))) throw new HttpError(403, message ?? 'Your role does not allow this');
}

/** Fixed-window limiter per user+bucket; enough to stop a runaway client from burning the agency's Euler quota. */
export function rateLimit(bucket: string, max: number, windowMs: number): MiddlewareHandler<AppEnv> {
  const hits = new Map<string, { n: number; reset: number }>();
  return async (c, next) => {
    const k = `${bucket}:${c.get('user')?.id ?? c.req.header('x-forwarded-for') ?? 'anon'}`;
    const now = Date.now();
    const h = hits.get(k);
    if (!h || h.reset < now) hits.set(k, { n: 1, reset: now + windowMs });
    else if (++h.n > max) throw new HttpError(429, 'Too many requests. Slow down for a moment.');
    if (hits.size > 10_000) for (const [key, v] of hits) if (v.reset < now) hits.delete(key);
    await next();
  };
}
