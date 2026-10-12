import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApp } from '../src/api/app';
import { subscriptionPatch } from '../src/api/billing';
import { _setKeyForTests } from '../src/crypto';

const AGENCY = '0f8b8c3e-7a3b-4c4e-9a59-3f4d2a1b0c11';
type Op = { table: string; method: string; args: unknown[] };

/** Chainable stand-in for supabase-js: records every call and answers from `respond`. */
function fakeDb(roles: Record<string, string>, respond: (table: string, ops: Op[]) => unknown = () => ({ data: null, error: null })) {
  const log: Op[] = [];
  const db = {
    auth: { getUser: async (t: string) => (roles[t] ? { data: { user: { id: t, email: `${t}@x.test` } }, error: null } : { data: { user: null }, error: { message: 'bad' } }) },
    from(table: string) {
      const ops: Op[] = [];
      const q: any = new Proxy({}, {
        get(_, m: string) {
          if (m === 'then') {
            const r = table === 'agency_members' && ops.some(o => o.method === 'select')
              ? { data: roleRow(ops), error: null }
              : respond(table, ops);
            return (res: (v: unknown) => void) => res(r);
          }
          return (...args: unknown[]) => { const op = { table, method: m, args }; ops.push(op); log.push(op); return q; };
        },
      });
      return q;
    },
  };
  function roleRow(ops: Op[]) {
    const uid = ops.find(o => o.method === 'eq' && o.args[0] === 'user_id')?.args[1] as string;
    return roles[uid] ? { role: roles[uid] } : null;
  }
  return { db: db as unknown as SupabaseClient, log };
}

const app = (roles: Record<string, string>, respond?: (t: string, o: Op[]) => unknown) => {
  const f = fakeDb(roles, respond);
  return { ...f, app: createApp(f.db, { webOrigin: 'http://web.test', apiPublicUrl: 'http://api.test' }, null) };
};
const req = (a: ReturnType<typeof app>['app'], method: string, path: string, user?: string, body?: unknown) =>
  a.request(path, { method, headers: { ...(user ? { authorization: `Bearer ${user}` } : {}), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeAll(() => _setKeyForTests(randomBytes(32)));

describe('API auth & roles', () => {
  it('rejects anonymous calls', async () => {
    const { app: a } = app({});
    expect((await req(a, 'POST', `/api/agencies/${AGENCY}/euler/test`)).status).toBe(401);
  });
  it('hides agencies the caller is not a member of', async () => {
    const { app: a } = app({ outsider: '' });
    const r = await req(a, 'POST', `/api/agencies/${AGENCY}/hello`, 'outsider');
    expect([401, 404]).toContain(r.status);
  });
  it('blocks managers from setting the API key', async () => {
    const { app: a, log } = app({ mgr: 'manager' });
    const r = await req(a, 'PUT', `/api/agencies/${AGENCY}/euler`, 'mgr', { apiKey: 'euler_live_123456' });
    expect(r.status).toBe(403);
    expect(log.some(o => o.table === 'euler_credentials')).toBe(false);
  });
  it('validates cookie headers before storing them', async () => {
    const { app: a } = app({ f: 'founder' });
    const r = await req(a, 'PUT', `/api/agencies/${AGENCY}/euler`, 'f', { cookie: 'tt_csrf=1' });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { fields: Record<string, string> }).fields.cookie).toMatch(/sessionid/);
  });
  it('stores keys sealed, never in plaintext', async () => {
    const { app: a, log } = app({ f: 'founder' }, (table, ops) => {
      if (table === 'euler_connections' && ops.some(o => o.method === 'maybeSingle')) return { data: { agency_id: AGENCY, mode: 'oauth', status: 'connected' }, error: null };
      return { data: { agency_id: AGENCY }, error: null };
    });
    const r = await req(a, 'PUT', `/api/agencies/${AGENCY}/euler`, 'f', { apiKey: 'euler_live_123456' });
    expect(r.status).toBe(200);
    const upsert = log.find(o => o.table === 'euler_credentials' && o.method === 'upsert')!.args[0] as Record<string, string>;
    expect(upsert.api_key_enc).toMatch(/^v1\./);
    expect(JSON.stringify(log)).not.toContain('euler_live_123456');
    const update = log.find(o => o.table === 'euler_connections' && o.method === 'update')!.args[0] as Record<string, string>;
    expect(update).toMatchObject({ api_key_last4: '3456', status: 'disconnected' });
  });
  it('rejects unknown tools and moderation by viewers', async () => {
    const { app: a } = app({ v: 'viewer' });
    expect((await req(a, 'POST', `/api/agencies/${AGENCY}/tools/drop_tables`, 'v', {})).status).toBe(404);
    expect((await req(a, 'POST', `/api/agencies/${AGENCY}/tools/toggle_room_comments`, 'v', { room_id: '7400000000000000000', enabled: false })).status).toBe(403);
  });
  it('refuses tool calls while disconnected', async () => {
    const { app: a } = app({ m: 'manager' }, (table, ops) =>
      table === 'euler_connections' && ops.some(o => o.method === 'maybeSingle') ? { data: { agency_id: AGENCY, status: 'disconnected', mode: 'oauth' }, error: null } : { data: null, error: null });
    const r = await req(a, 'POST', `/api/agencies/${AGENCY}/tools/get_user_id`, 'm', { unique_id: 'nova_shift' });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { code: string }).code).toBe('not_connected');
  });
  it('only lets founders invite', async () => {
    const { app: a } = app({ m: 'manager' });
    expect((await req(a, 'POST', `/api/agencies/${AGENCY}/members`, 'm', { email: 'x@y.co', role: 'moderator', teamId: null })).status).toBe(403);
  });
});

describe('subscriptionPatch', () => {
  it('maps price ids to plans and falls back to starter when cancelled', () => {
    process.env.STRIPE_PRICE_GROWTH = 'price_growth';
    const sub = (status: string) => ({ id: 'sub_1', status, customer: 'cus_1', items: { data: [{ price: { id: 'price_growth' }, current_period_end: 1767225600 }] } }) as never;
    expect(subscriptionPatch(sub('active'))).toMatchObject({ plan: 'growth', plan_renews_at: '2026-01-01T00:00:00.000Z', stripe_subscription_id: 'sub_1' });
    expect(subscriptionPatch(sub('canceled'))).toMatchObject({ plan: 'starter', stripe_subscription_id: null });
  });
});
