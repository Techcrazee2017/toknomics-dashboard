import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { createWebSocketUrl } from '@eulerstream/euler-websocket-sdk';
import {
  CreateAgencyBody, UpdateConnectionBody, WsTokenBody, InviteBody, UpdateMemberBody, CheckoutBody,
  isToolName, planOf, AUTH_TOOLS, type ConnectResult, type TestResult, type WsTokenResult, type CheckoutResult, type GiftSyncResult,
} from '@toknomics/shared';
import { seal, sha256, randomToken } from '../crypto';
import { log } from '../env';
import { workerFresh, workerState } from '../health';
import { EulerService, eulerError, makeClient, oauthApp, OAUTH_SCOPES, type ClientFactory } from './euler';
import { HttpError, allow, jsonBody, parseBody, rateLimit, requireMember, requireUser, type AppEnv } from './http';
import { billingRoutes } from './billing';

export type AppConfig = { webOrigin: string; apiPublicUrl: string };
/** Overridable in tests so no call reaches Euler. */
export type AppDeps = { makeClient?: ClientFactory };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createApp(db: SupabaseClient, cfg: AppConfig, stripe: Stripe | null, deps: AppDeps = {}) {
  const make = deps.makeClient ?? makeClient;
  const euler = new EulerService(db, make);
  const app = new Hono<AppEnv>();

  app.use('*', secureHeaders());
  app.use('/api/*', bodyLimit({ maxSize: 1024 * 1024, onError: c => c.json({ error: 'Request body too large', code: 'too_large' }, 413) }));
  app.use('/api/*', cors({ origin: cfg.webOrigin, allowHeaders: ['authorization', 'content-type'], allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], maxAge: 600 }));

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message, code: err.code, fields: err.fields }, err.status);
    log({ level: 'error', msg: 'unhandled', path: c.req.path, err: err.message, stack: err.stack });
    return c.json({ error: 'Something went wrong on our side' }, 500);
  });

  // live: the process is up (Railway's health check). ready: it can serve and ingest (what an uptime monitor watches).
  app.get('/api/health', c => c.json({ ok: true }));
  app.get('/api/health/live', c => c.json({ ok: true }));
  app.get('/api/health/ready', async c => {
    let dbOk = false;
    try {
      const probe = db.from('agencies').select('id', { head: true }).limit(1).abortSignal(AbortSignal.timeout(2_000));
      dbOk = !(await probe).error;
    } catch { dbOk = false; }
    const workerOk = !workerState.expected || workerFresh();
    const ok = dbOk && workerOk;
    const w = workerState;
    return c.json({
      ok, db: dbOk,
      worker: {
        expected: w.expected, ok: workerOk, lastReconcileAt: w.lastReconcileAt ? new Date(w.lastReconcileAt).toISOString() : null,
        sockets: w.sockets, maxSockets: w.maxSockets, capacityPct: w.maxSockets ? Math.round((w.sockets / w.maxSockets) * 100) : 0,
      },
      version: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    }, ok ? 200 : 503);
  });

  // ── Stripe webhook + OAuth callback: authenticated by signature / state, not by session ──
  billingRoutes(app, db, stripe, cfg);
  app.get('/api/euler/oauth/callback', async c => {
    const back = (q: string) => c.redirect(`${cfg.webOrigin}/source?${q}`);
    const state = c.req.query('state') ?? '', code = c.req.query('code');
    const agencyId = state.split('.')[0] ?? '';
    if (c.req.query('error')) return back('euler_error=' + encodeURIComponent(c.req.query('error_description') ?? c.req.query('error') ?? 'Authorization denied'));
    if (!code || !/^[0-9a-f-]{36}$/.test(agencyId)) return back('euler_error=Invalid+OAuth+callback');
    const { data: cr } = await db.from('euler_credentials').select('oauth_state_hash, oauth_state_expires_at').eq('agency_id', agencyId).maybeSingle();
    if (!cr?.oauth_state_hash || cr.oauth_state_hash !== sha256(state) || Date.parse(cr.oauth_state_expires_at) < Date.now()) {
      return back('euler_error=OAuth+request+expired.+Try+again.');
    }
    try {
      const { clientId, clientSecret } = oauthApp();
      const client = make(await euler.apiKey(agencyId));
      const r = await client.general.exchangeToken({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri(cfg) });
      const t = r.data.data;
      if (!t?.access_token) throw new Error(r.data.error ? JSON.stringify(r.data.error) : 'No access token returned');
      await euler.storeTokens(agencyId, t);
      const info = (await client.general.getUserInfo(t.access_token)).data.user;
      await markConnected(agencyId, info?.uniqueId ? '@' + info.uniqueId : 'Euler OAuth session', client);
      return back('euler=connected');
    } catch (e) {
      await db.from('euler_connections').update({ status: 'disconnected', updated_at: now() }).eq('agency_id', agencyId);
      log({ level: 'warn', msg: 'oauth callback failed', agencyId, err: (e as Error).message });
      return back('euler_error=' + encodeURIComponent(e instanceof HttpError ? e.message : eulerError(e).message));
    }
  });

  // ── signed-in routes ──
  const authed = new Hono<AppEnv>();
  authed.use('*', requireUser(db));

  authed.post('/agencies', rateLimit('create-agency', 5, 3_600_000), async c => {
    const { name } = parseBody(CreateAgencyBody, await jsonBody(c));
    const { data: ag, error } = await db.from('agencies').insert({ name }).select('id').single();
    if (error) throw new HttpError(500, 'Could not create the agency');
    const m = await db.from('agency_members').insert({ agency_id: ag.id, user_id: c.get('user').id, role: 'founder', status: 'active' });
    if (m.error) { await db.from('agencies').delete().eq('id', ag.id); throw new HttpError(500, 'Could not create the agency'); }
    await db.from('euler_connections').insert({ agency_id: ag.id });
    return c.json({ id: ag.id }, 201);
  });

  const agency = new Hono<AppEnv>();
  agency.use('*', requireMember(db));

  agency.post('/hello', async c => {
    const uid = c.get('user').id;
    await Promise.all([
      db.from('agency_members').update({ status: 'active' }).eq('agency_id', c.get('agencyId')).eq('user_id', uid).eq('status', 'invited'),
      db.from('profiles').update({ last_seen_at: now() }).eq('user_id', uid),
    ]);
    return c.json({ role: c.get('role') });
  });

  // ── Euler connection ──
  // The API key alone powers live ingestion and every read-only tool, so saving it is the whole setup for most
  // agencies. OAuth / cookie is a separate, optional session that only room moderation needs.
  agency.put('/euler', rateLimit('euler-save', 20, 60_000), async c => {
    const body = parseBody(UpdateConnectionBody, await jsonBody(c));
    const aid = c.get('agencyId'), role = c.get('role');
    const founderOnly = body.apiKey !== undefined || body.cookie !== undefined || body.host !== undefined || body.mode === 'cookie' || body.cookieRisk !== undefined;
    if (founderOnly) allow(c, 'manageCredentials', 'Only Founders can change the host, API key or Cookie mode');
    else if (role !== 'founder' && role !== 'manager') throw new HttpError(403, 'Your role does not allow this');
    const conn = await euler.connection(aid);
    const patch: Record<string, unknown> = { updated_at: now() };
    const secrets: Record<string, unknown> = {};
    if (body.host !== undefined) patch.host = body.host;
    if (body.pinnedUserId !== undefined) patch.pinned_user_id = body.pinnedUserId || null;
    if (body.apiKey !== undefined) {
      // Verified before it is stored: a key Euler rejects never replaces a working one. The ciphertext and its verification
      // (last four, account id, status) are then written by one database function, so they can't end up from different saves.
      const account = await verifyKey(make(body.apiKey));
      const saved = await db.rpc('save_euler_key', { p_agency: aid, p_key_enc: seal(body.apiKey, aid), p_last4: body.apiKey.slice(-4), p_account_id: account.id });
      if (saved.error) throw new HttpError(500, 'Could not save the API key');
    }
    if (body.cookie !== undefined) { secrets.cookie_enc = body.cookie ? seal(body.cookie, aid) : null; patch.has_cookie = !!body.cookie; }
    // Cookie mode makes TikTok see a signed-in session; make the Founder acknowledge the risk once, and record it.
    // The acknowledgement can arrive on its own: an agency that stored a cookie before this existed has none on record.
    if (!conn.cookie_ack_at) {
      if ((body.cookie || body.mode === 'cookie') && !body.cookieRisk) throw new HttpError(400, 'Confirm that you accept the risk of cookie mode', 'validation', { cookieRisk: 'Confirm that you accept the risk of cookie mode' });
      if (body.cookieRisk) patch.cookie_ack_at = now();
    }
    // The moderation session's mode is fixed when it starts, so changing it ends it. (Saving a key ends it too; save_euler_key does that.)
    if (body.mode && body.mode !== conn.mode) {
      Object.assign(patch, { status: 'disconnected', connected_at: null, account_label: null });
      Object.assign(secrets, { oauth_access_enc: null, oauth_refresh_enc: null, oauth_expires_at: null });
    }
    if (body.mode) patch.mode = body.mode;
    if (Object.keys(secrets).length) {
      const r = await db.from('euler_credentials').upsert({ agency_id: aid, ...secrets, updated_at: now() }, { onConflict: 'agency_id' });
      if (r.error) throw new HttpError(500, 'Could not save credentials');
    }
    const { data, error } = await db.from('euler_connections').update(patch).eq('agency_id', aid).select('*').single();
    if (error) throw new HttpError(500, 'Could not save the connection');
    return c.json(data);
  });

  // Moderation session (optional). Needs a key Euler has accepted.
  agency.post('/euler/connect', rateLimit('connect', 10, 60_000), async c => {
    allow(c, 'manageCredentials', 'Ask a Founder to finish setup. Only Founders can add credentials.');
    const aid = c.get('agencyId');
    const s = await euler.session(aid, false);
    const conn = s.conn;
    const cr = await euler.credentials(aid);

    if (conn.mode === 'cookie') {
      if (!cr.cookie_enc) throw new HttpError(400, 'Paste the raw Cookie header. It must include sessionid=', 'validation', { cookie: 'Paste the raw Cookie header. It must include sessionid=' });
      if (!conn.cookie_ack_at) throw new HttpError(400, 'Confirm that you accept the risk of cookie mode', 'validation', { cookieRisk: 'Confirm that you accept the risk of cookie mode' });
      await markConnected(aid, 'Cookie session', s.client);
      return c.json({ status: 'connected' } satisfies ConnectResult);
    }

    const { clientId, authorizeUrl } = oauthApp();
    const state = `${aid}.${randomToken()}`;
    const r = await db.from('euler_credentials').upsert({ agency_id: aid, oauth_state_hash: sha256(state), oauth_state_expires_at: new Date(Date.now() + 600_000).toISOString(), updated_at: now() }, { onConflict: 'agency_id' });
    if (r.error) throw new HttpError(500, 'Could not start authorization');
    await db.from('euler_connections').update({ status: 'authorizing', updated_at: now() }).eq('agency_id', aid);
    const u = new URL(authorizeUrl);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('redirect_uri', redirectUri(cfg));
    u.searchParams.set('scope', OAUTH_SCOPES.join(' '));
    u.searchParams.set('state', state);
    // Euler's account picker is skipped when a cached session exists for this TikTok user
    if (conn.pinned_user_id) u.searchParams.set('login_user_id', conn.pinned_user_id);
    return c.json({ status: 'authorizing', authorizeUrl: u.toString() } satisfies ConnectResult);
  });

  agency.post('/euler/cancel', async c => {
    allow(c, 'manageCredentials');
    await db.from('euler_connections').update({ status: 'disconnected', updated_at: now() }).eq('agency_id', c.get('agencyId')).eq('status', 'authorizing');
    return c.json({ ok: true });
  });

  agency.post('/euler/disconnect', async c => {
    allow(c, 'manageCredentials', 'Only Founders can disconnect Euler Stream');
    const aid = c.get('agencyId');
    await db.from('euler_credentials').update({ oauth_access_enc: null, oauth_refresh_enc: null, oauth_expires_at: null, updated_at: now() }).eq('agency_id', aid);
    await db.from('euler_connections').update({ status: 'disconnected', connected_at: null, updated_at: now() }).eq('agency_id', aid);
    return c.json({ ok: true });
  });

  // Wipes every stored Euler secret and resets the connection. Founders only, and open on any plan so a lapsed agency can still remove its credentials.
  agency.post('/euler/credentials/delete', rateLimit('cred-delete', 5, 60_000), async c => {
    allow(c, 'manageCredentials', 'Only Founders can delete Euler credentials');
    const aid = c.get('agencyId');
    // One database function wipes the secrets and resets the connection together, so a failure or a concurrent key save can't
    // leave a "deleted" secret stored or a public status that disagrees with it.
    const wiped = await db.rpc('delete_euler_credentials', { p_agency: aid });
    if (wiped.error) throw new HttpError(500, 'Could not delete the credentials');
    return c.json({ ok: true });
  });

  agency.post('/euler/test', rateLimit('test', 10, 60_000), async c => {
    const aid = c.get('agencyId');
    const s = await euler.session(aid, false);
    const t0 = Date.now();
    let rateLimitInfo: TestResult['rateLimit'] = null;
    try {
      const r = await s.client.accounts.getRateLimits();
      if (r.data.minute) rateLimitInfo = { remaining: r.data.minute.remaining, max: r.data.minute.max };
    } catch (e) {
      const err = eulerError(e);
      // Euler no longer accepts the key: record it so the dashboard says so and ingestion pauses.
      // Only if the key that was tested is still the stored one: a late 401 must not invalidate a replacement saved meanwhile.
      if (err.code === 'euler_auth' && s.conn.api_key_last4) await db.from('euler_connections').update({ key_status: 'invalid', updated_at: now() }).eq('agency_id', aid).eq('api_key_last4', s.conn.api_key_last4);
      throw err;
    }
    const ms = Date.now() - t0;
    const { count } = await db.from('gift_transactions').select('id', { count: 'exact', head: true }).eq('agency_id', aid).gte('ingested_at', new Date(Date.now() - 60_000).toISOString());
    return c.json({ ok: true, ms, eventsPerMin: count ?? 0, rateLimit: rateLimitInfo } satisfies TestResult);
  });

  // ── tool proxy ──
  agency.post('/tools/:tool', rateLimit('tools', 120, 60_000), async c => {
    const tool = c.req.param('tool');
    if (!isToolName(tool)) throw new HttpError(404, `Unknown tool ${tool}`);
    if (AUTH_TOOLS.has(tool)) {
      allow(c, 'moderateRooms', 'Your role cannot moderate rooms');
      if (!tool.includes('get_')) await assertRoomTracked(c.get('agencyId'), await jsonBody(c));
    }
    const out = await euler.runTool(c.get('agencyId'), c.get('user').id, tool, await jsonBody(c));
    return c.json(out);
  });

  agency.post('/gifts/sync', rateLimit('gift-sync', 4, 60_000), async c => {
    allow(c, 'syncCatalog');
    const s = await euler.session(c.get('agencyId'), false);
    const rows: Record<string, unknown>[] = [];
    try {
      for (let page = 1; page <= 50; page++) {
        const r = (await s.client.gifts.listWebcastGifts(500, page)).data;
        for (const g of r.gifts ?? []) rows.push({ gift_id: g.giftId, name: g.giftName, diamond_count: g.diamondCount, gift_type: g.giftType, image_uri: g.imageUri || null, synced_at: now() });
        if (!r.totalPages || page >= r.totalPages) break;
      }
    } catch (e) { throw eulerError(e); }
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await db.from('gift_catalog').upsert(rows.slice(i, i + 1000), { onConflict: 'gift_id' });
      if (error) throw new HttpError(500, 'Could not save the gift catalog');
    }
    return c.json({ synced: rows.length } satisfies GiftSyncResult);
  });

  // Short-lived JWT so the browser can read one creator's live chat without ever seeing the API key
  agency.post('/ws-token', rateLimit('ws-token', 30, 60_000), async c => {
    allow(c, 'moderateRooms');
    const { unique_id } = parseBody(WsTokenBody, await jsonBody(c));
    const aid = c.get('agencyId');
    const { data: t } = await db.from('tracked_targets').select('id').eq('agency_id', aid).eq('unique_id', unique_id).eq('active', true).maybeSingle();
    if (!t) throw new HttpError(403, 'Track this creator before opening their chat');
    const s = await euler.session(aid, false);
    if (!s.conn.euler_account_id) throw new HttpError(409, 'Reconnect Euler Stream to enable live chat', 'no_account_id');
    try {
      const r = await s.client.authentication.createJWT(s.conn.euler_account_id, {
        expireAfter: 60,
        metadata: { version: 'v2', expireAfter: 60, name: `toknomics:${aid}:${unique_id}` },
        api: { enabled: false },
        websockets: { enabled: true, config: { allowedCreators: [unique_id], maxWebSockets: 1 } },
      });
      if (!r.data.token) throw new HttpError(502, r.data.message ?? 'Euler did not return a token', 'euler_error');
      const url = createWebSocketUrl({ uniqueId: unique_id, jwtKey: r.data.token, features: { bundleEvents: true } });
      return c.json({ url, expiresIn: 60 } satisfies WsTokenResult);
    } catch (e) { throw e instanceof HttpError ? e : eulerError(e); }
  });

  // ── team ──
  agency.post('/members', rateLimit('invite', 20, 3_600_000), async c => {
    allow(c, 'manageTeam', 'Only Founders can invite members');
    const body = parseBody(InviteBody, await jsonBody(c));
    const aid = c.get('agencyId');
    const { data: ag } = await db.from('agencies').select('plan').eq('id', aid).single();
    const plan = planOf(ag?.plan ?? 'starter');
    if (!plan.multiSeat) throw new HttpError(402, 'Multi-seat team access is a Scale feature. Upgrade on Plan & billing.', 'plan_limit');
    if (body.teamId) await assertTeam(aid, body.teamId);

    let userId: string | undefined;
    const { data: existing } = await db.from('profiles').select('user_id').eq('email', body.email).maybeSingle();
    if (existing) userId = existing.user_id;
    else {
      const inv = await db.auth.admin.inviteUserByEmail(body.email, { redirectTo: cfg.webOrigin });
      if (inv.error || !inv.data.user) throw new HttpError(502, inv.error?.message ?? 'Could not send the invite');
      userId = inv.data.user.id;
    }
    const { error } = await db.from('agency_members').insert({ agency_id: aid, user_id: userId, role: body.role, team_id: body.teamId, status: 'invited' });
    if (error?.code === '23505') throw new HttpError(409, 'Already on the team', 'validation', { email: 'Already on the team' });
    if (error) throw new HttpError(500, 'Could not add the member');
    return c.json({ ok: true }, 201);
  });

  agency.patch('/members/:userId', rateLimit('member-edit', 60, 3_600_000), async c => {
    allow(c, 'manageTeam');
    const body = parseBody(UpdateMemberBody, await jsonBody(c));
    const aid = c.get('agencyId'), uid = c.req.param('userId');
    if (!UUID.test(uid)) throw new HttpError(404, 'Member not found, or is a Founder');
    if (body.teamId) await assertTeam(aid, body.teamId);
    const patch: Record<string, unknown> = {};
    if (body.role) patch.role = body.role;
    if (body.teamId !== undefined) patch.team_id = body.teamId;
    const { data, error } = await db.from('agency_members').update(patch).eq('agency_id', aid).eq('user_id', uid).neq('role', 'founder').select('user_id');
    if (error) throw new HttpError(500, 'Could not update the member');
    if (!data?.length) throw new HttpError(404, 'Member not found, or is a Founder');
    return c.json({ ok: true });
  });

  agency.delete('/members/:userId', rateLimit('member-edit', 60, 3_600_000), async c => {
    allow(c, 'manageTeam');
    if (!UUID.test(c.req.param('userId'))) throw new HttpError(404, 'Member not found, or is a Founder');
    const { data, error } = await db.from('agency_members').delete().eq('agency_id', c.get('agencyId')).eq('user_id', c.req.param('userId')).neq('role', 'founder').select('user_id');
    if (error) throw new HttpError(500, 'Could not remove the member');
    if (!data?.length) throw new HttpError(404, 'Member not found, or is a Founder');
    return c.json({ ok: true });
  });

  authed.route('/agencies/:agencyId', agency);
  app.route('/api', authed);
  return app;

  // ── helpers ──
  async function markConnected(agencyId: string, label: string, client: ReturnType<ClientFactory>) {
    const account = await verifyKey(client);
    const { error } = await db.from('euler_connections').update({
      status: 'connected', account_label: label, euler_account_id: account.id, connected_at: now(), updated_at: now(),
    }).eq('agency_id', agencyId);
    if (error) throw new HttpError(500, 'Could not save the connection');
  }

  async function assertTeam(agencyId: string, teamId: string) {
    const { data } = await db.from('teams').select('id').eq('agency_id', agencyId).eq('id', teamId).maybeSingle();
    if (!data) throw new HttpError(400, 'Unknown team', 'validation', { teamId: 'Unknown team' });
  }

  /** Room actions are limited to rooms of creators this agency tracks. */
  async function assertRoomTracked(agencyId: string, body: unknown) {
    const b = (body ?? {}) as { room_id?: unknown; anchor_id?: unknown };
    const { data: targets } = await db.from('tracked_targets').select('unique_id, anchor_id').eq('agency_id', agencyId).eq('active', true);
    const ids = (targets ?? []).map(t => t.unique_id);
    if (typeof b.anchor_id === 'string') {
      if (!(targets ?? []).some(t => t.anchor_id === b.anchor_id)) throw new HttpError(403, 'That room is not one of your tracked targets');
      return;
    }
    if (typeof b.room_id === 'string') {
      const { data } = await db.from('stream_status').select('unique_id').eq('agency_id', agencyId).eq('room_id', b.room_id).in('unique_id', ids.length ? ids : ['-']).limit(1);
      if (!data?.length) throw new HttpError(403, 'That room is not one of your tracked targets');
    }
  }
}

async function verifyKey(client: ReturnType<ClientFactory>) {
  try {
    const r = await client.accounts.retrieveAccountSelf();
    if (!r.data.account) throw new HttpError(400, r.data.message ?? 'Euler did not accept this API key', 'validation', { apiKey: 'Euler did not accept this API key' });
    return r.data.account;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const err = eulerError(e);
    if (err.code === 'euler_auth') throw new HttpError(400, 'Euler did not accept this API key', 'validation', { apiKey: 'Euler did not accept this API key' });
    throw err;
  }
}

const redirectUri = (cfg: AppConfig) => `${cfg.apiPublicUrl}/api/euler/oauth/callback`;
const now = () => new Date().toISOString();
