import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApp } from '../src/api/app';
import { subscriptionPatch } from '../src/api/billing';
import { _setKeyForTests, seal } from '../src/crypto';
import type { ClientFactory } from '../src/api/euler';

const AGENCY = '0f8b8c3e-7a3b-4c4e-9a59-3f4d2a1b0c11';
type Op = { table: string; method: string; args: unknown[] };

/** Chainable stand-in for supabase-js: records every call and answers from `respond`. */
function fakeDb(roles: Record<string, string>, respond: (table: string, ops: Op[]) => unknown = () => ({ data: null, error: null }), rpcError: string | null = null) {
  const log: Op[] = [];
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => { rpcs.push({ name, args }); return { data: null, error: rpcError ? { message: rpcError } : null }; },
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
  return { db: db as unknown as SupabaseClient, log, rpcs };
}

const app = (roles: Record<string, string>, respond?: (t: string, o: Op[]) => unknown, client?: unknown, rpcError: string | null = null) => {
  const f = fakeDb(roles, respond, rpcError);
  const makeClient = (client ? () => client : undefined) as ClientFactory | undefined;
  return { ...f, app: createApp(f.db, { webOrigin: 'http://web.test', apiPublicUrl: 'http://api.test' }, null, { makeClient }) };
};
/** A fake Euler client: accepts the key and answers get_user_id. */
const goodClient = { accounts: { retrieveAccountSelf: async () => ({ data: { account: { id: 42 } } }) }, anchors: { retrieveWebcastUserId: async () => ({ data: { numeric_user_id: '123' } }) } };
const badKeyClient = { accounts: { retrieveAccountSelf: async () => { throw { response: { status: 401, data: { message: 'Invalid API key' } } }; } } };
/** Connection / credential rows for an agency with the given Euler state. */
const euler = (conn: Record<string, unknown>) => (table: string, ops: Op[]) => {
  if (table === 'euler_connections' && ops.some(o => o.method === 'maybeSingle')) return { data: { agency_id: AGENCY, mode: 'oauth', status: 'disconnected', key_status: 'unknown', cookie_ack_at: null, ...conn }, error: null };
  if (table === 'euler_credentials' && ops.some(o => o.method === 'maybeSingle')) return { data: { api_key_enc: seal('euler_live_123456', AGENCY) }, error: null };
  return { data: { agency_id: AGENCY }, error: null };
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
  it('stores keys sealed, never in plaintext, and writes the key and its metadata in one database call', async () => {
    const { app: a, log, rpcs } = app({ f: 'founder' }, euler({ status: 'connected' }), goodClient);
    const r = await req(a, 'PUT', `/api/agencies/${AGENCY}/euler`, 'f', { apiKey: 'euler_live_123456' });
    expect(r.status).toBe(200);
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]).toMatchObject({ name: 'save_euler_key', args: { p_agency: AGENCY, p_last4: '3456', p_account_id: 42 } });
    expect(String(rpcs[0]!.args.p_key_enc)).toMatch(/^v1\./);
    expect(JSON.stringify([log, rpcs])).not.toContain('euler_live_123456');
    // No separate statement writes the key or its metadata, so they can't come from different saves.
    expect(log.some(o => o.table === 'euler_credentials' && o.method === 'upsert')).toBe(false);
    const updates = log.filter(o => o.table === 'euler_connections' && o.method === 'update').map(o => o.args[0] as Record<string, unknown>);
    expect(updates.every(u => !('api_key_last4' in u) && !('key_status' in u) && !('euler_account_id' in u))).toBe(true);
  });
  it('reports a failed key save instead of claiming success', async () => {
    const { app: a } = app({ f: 'founder' }, euler({}), goodClient, 'boom');
    const r = await req(a, 'PUT', `/api/agencies/${AGENCY}/euler`, 'f', { apiKey: 'euler_live_123456' });
    expect(r.status).toBe(500);
  });
  it('rejects unknown tools and moderation by viewers', async () => {
    const { app: a } = app({ v: 'viewer' });
    expect((await req(a, 'POST', `/api/agencies/${AGENCY}/tools/drop_tables`, 'v', {})).status).toBe(404);
    expect((await req(a, 'POST', `/api/agencies/${AGENCY}/tools/toggle_room_comments`, 'v', { room_id: '7400000000000000000', enabled: false })).status).toBe(403);
  });
  it('refuses tool calls until Euler has accepted an API key', async () => {
    const { app: a } = app({ m: 'manager' }, euler({ key_status: 'unknown' }), goodClient);
    const r = await req(a, 'POST', `/api/agencies/${AGENCY}/tools/get_user_id`, 'm', { unique_id: 'nova_shift' });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { code: string }).code).toBe('no_api_key');
  });
  it('says so when Euler rejected the saved key', async () => {
    const { app: a } = app({ m: 'manager' }, euler({ key_status: 'invalid' }), goodClient);
    const r = await req(a, 'POST', `/api/agencies/${AGENCY}/tools/get_user_id`, 'm', { unique_id: 'nova_shift' });
    expect(((await r.json()) as { code: string }).code).toBe('invalid_api_key');
  });
  it('runs read-only tools on the API key alone, with no OAuth or cookie session', async () => {
    const { app: a } = app({ m: 'manager' }, euler({ key_status: 'valid', status: 'disconnected' }), goodClient);
    const r = await req(a, 'POST', `/api/agencies/${AGENCY}/tools/get_user_id`, 'm', { unique_id: 'nova_shift' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ user_id: '123' });
  });
  it('still needs the moderation session for tools that act on a room', async () => {
    const { app: a } = app({ f: 'founder' }, euler({ key_status: 'valid', status: 'disconnected' }), goodClient);
    const r = await req(a, 'POST', `/api/agencies/${AGENCY}/tools/mutes-get_muted_users`, 'f', { room_id: '7400000000000000000', page: 1 });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { code: string }).code).toBe('not_connected');
  });
  it('does not store a key Euler rejects', async () => {
    const { app: a, log, rpcs } = app({ f: 'founder' }, euler({ key_status: 'valid' }), badKeyClient);
    const r = await req(a, 'PUT', `/api/agencies/${AGENCY}/euler`, 'f', { apiKey: 'euler_live_wrong' });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { fields: Record<string, string> }).fields.apiKey).toMatch(/did not accept/);
    expect(log.some(o => o.table === 'euler_credentials' && o.method === 'upsert')).toBe(false);
    expect(rpcs).toHaveLength(0);
  });
  it('marks the key verified and records the Euler account when it is saved', async () => {
    const { app: a, rpcs } = app({ f: 'founder' }, euler({}), goodClient);
    await req(a, 'PUT', `/api/agencies/${AGENCY}/euler`, 'f', { apiKey: 'euler_live_123456' });
    expect(rpcs[0]!.args).toMatchObject({ p_account_id: 42, p_last4: '3456' });   // the function sets key_status = 'valid' with them
  });
  it('requires an explicit risk acknowledgement before cookie mode, and records it', async () => {
    const { app: a, log } = app({ f: 'founder' }, euler({}), goodClient);
    const url = `/api/agencies/${AGENCY}/euler`;
    const no = await req(a, 'PUT', url, 'f', { cookie: 'sessionid=abc' });
    expect(no.status).toBe(400);
    expect(((await no.json()) as { fields: Record<string, string> }).fields.cookieRisk).toBeTruthy();
    expect(log.some(o => o.table === 'euler_credentials')).toBe(false);
    expect((await req(a, 'PUT', url, 'f', { cookie: 'sessionid=abc', cookieRisk: true })).status).toBe(200);
    expect((log.find(o => o.table === 'euler_connections' && o.method === 'update')!.args[0] as Record<string, unknown>).cookie_ack_at).toBeTruthy();
  });
  it('records the risk acknowledgement on its own for a cookie stored before it existed', async () => {
    const { app: a, log } = app({ f: 'founder' }, euler({ mode: 'cookie', has_cookie: true }), goodClient);
    const r = await req(a, 'PUT', `/api/agencies/${AGENCY}/euler`, 'f', { cookieRisk: true });
    expect(r.status).toBe(200);
    expect((log.find(o => o.table === 'euler_connections' && o.method === 'update')!.args[0] as Record<string, unknown>).cookie_ack_at).toBeTruthy();
    const mgr = app({ m: 'manager' }, euler({ mode: 'cookie', has_cookie: true }), goodClient);
    expect((await req(mgr.app, 'PUT', `/api/agencies/${AGENCY}/euler`, 'm', { cookieRisk: true })).status).toBe(403);
  });
  it('does not invalidate a replacement key when a late test of the old key returns 401', async () => {
    const rejecting = { accounts: { getRateLimits: async () => { throw { response: { status: 401, data: { message: 'Invalid API key' } } }; } } };
    const { app: a, log } = app({ f: 'founder' }, euler({ key_status: 'valid', api_key_last4: '3456' }), rejecting);
    const r = await req(a, 'POST', `/api/agencies/${AGENCY}/euler/test`, 'f');
    expect(r.status).toBe(502);
    const eqs = log.filter(o => o.table === 'euler_connections' && o.method === 'eq').map(o => o.args as [string, unknown]);
    // The invalidation is conditional on the tested key's last4, so a replacement (different last4) is untouched.
    expect(eqs).toContainEqual(['api_key_last4', '3456']);
    expect(log.some(o => o.table === 'euler_connections' && o.method === 'update' && (o.args[0] as Record<string, unknown>).key_status === 'invalid')).toBe(true);
  });
  it('lets only Founders delete Euler credentials, in one database call', async () => {
    const mgr = app({ m: 'manager' }, euler({}), goodClient);
    expect((await req(mgr.app, 'POST', `/api/agencies/${AGENCY}/euler/credentials/delete`, 'm')).status).toBe(403);
    expect(mgr.rpcs).toHaveLength(0);
    const { app: a, log, rpcs } = app({ f: 'founder' }, euler({ key_status: 'valid' }), goodClient);
    expect((await req(a, 'POST', `/api/agencies/${AGENCY}/euler/credentials/delete`, 'f')).status).toBe(200);
    expect(rpcs).toEqual([{ name: 'delete_euler_credentials', args: { p_agency: AGENCY } }]);
    // Secrets and the public connection are reset by that one function, never by two statements that could part.
    expect(log.some(o => o.table === 'euler_credentials' && o.method === 'upsert')).toBe(false);
    expect(log.some(o => o.table === 'euler_connections' && o.method === 'update')).toBe(false);
  });
  it('reports a failed credential delete instead of claiming success', async () => {
    const { app: a } = app({ f: 'founder' }, euler({ key_status: 'valid' }), goodClient, 'boom');
    expect((await req(a, 'POST', `/api/agencies/${AGENCY}/euler/credentials/delete`, 'f')).status).toBe(500);
  });
  it('only lets founders invite', async () => {
    const { app: a } = app({ m: 'manager' });
    expect((await req(a, 'POST', `/api/agencies/${AGENCY}/members`, 'm', { email: 'x@y.co', role: 'moderator', teamId: null })).status).toBe(403);
  });
});

describe('API hardening', () => {
  it('answers /api/health/live and /ready without auth', async () => {
    const { app: a } = app({});
    expect((await req(a, 'GET', '/api/health/live')).status).toBe(200);
    const ready = await req(a, 'GET', '/api/health/ready');
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ ok: true, db: true });
  });
  it('reports not ready when the database probe fails', async () => {
    const { app: a } = app({}, table => (table === 'agencies' ? { data: null, error: { message: 'down' } } : { data: null, error: null }));
    const r = await req(a, 'GET', '/api/health/ready');
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ ok: false, db: false });
  });
  it('rejects bodies over 1 MB', async () => {
    const { app: a } = app({ f: 'founder' });
    const r = await req(a, 'PUT', `/api/agencies/${AGENCY}/euler`, 'f', { cookie: 'x'.repeat(1_100_000) });
    expect(r.status).toBe(413);
  });
  it('404s a malformed member id before touching the database', async () => {
    const { app: a, log } = app({ f: 'founder' });
    expect((await req(a, 'DELETE', `/api/agencies/${AGENCY}/members/not-a-uuid`, 'f')).status).toBe(404);
    expect((await req(a, 'PATCH', `/api/agencies/${AGENCY}/members/not-a-uuid`, 'f', { role: 'manager' })).status).toBe(404);
    expect(log.some(o => o.method === 'delete' || o.method === 'update')).toBe(false);
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
