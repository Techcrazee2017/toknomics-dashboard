// Per-agency Euler access. Credentials are decrypted only here, only server-side, and never returned.
import EulerStreamApiClient from 'tiktok-live-api-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTH_TOOLS, TOOL_INPUTS, type ToolName, type ToolOutput, type RoomUser } from '@toknomics/shared';
import { open, seal } from '../crypto';
import { optional } from '../env';
import { HttpError } from './http';

export type Connection = {
  agency_id: string; mode: 'oauth' | 'cookie'; host: string; status: 'disconnected' | 'authorizing' | 'connected';
  api_key_last4: string | null; has_cookie: boolean; pinned_user_id: string | null; account_label: string | null;
  euler_account_id: number | null; connected_at: string | null;
  /** Whether Euler accepted the stored API key. Live ingestion and read-only tools need only this. */
  key_status: 'unknown' | 'valid' | 'invalid';
  cookie_ack_at: string | null;
};
type Credentials = {
  api_key_enc: string | null; cookie_enc: string | null; oauth_access_enc: string | null;
  oauth_refresh_enc: string | null; oauth_expires_at: string | null;
};

export type EulerSession = {
  client: EulerStreamApiClient;
  conn: Connection;
  /** Present for tools that act on a room: exactly one of the two, per the connection mode. */
  oauthToken?: string;
  cookie?: string;
};

/**
 * Every call has a 10s timeout. baseOptions deliberately omits the SDK's default `validateStatus: () => true`:
 * with it, a 401/429/500 resolves like a success and callers would read an error body as data. Without it, axios
 * throws on non-2xx and eulerError() maps the status.
 */
export const makeClient = (apiKey: string) =>
  new EulerStreamApiClient({
    apiKey, baseOptions: { timeout: 10_000 },
    ...(optional('EULER_API_BASE') ? { basePath: optional('EULER_API_BASE') } : {}),
  });
export type ClientFactory = typeof makeClient;

/** Axios errors from the SDK carry Euler's message in response.data; surface that, never the request config. */
export function eulerError(e: unknown): HttpError {
  const ax = e as { code?: string; response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
  if (ax.code === 'ECONNABORTED' || ax.code === 'ETIMEDOUT') return new HttpError(502, 'Euler Stream did not respond in time. Try again.', 'euler_timeout');
  const status = ax.response?.status;
  const msg = ax.response?.data?.message ?? ax.response?.data?.error ?? ax.message ?? 'Euler Stream request failed';
  if (status === 401 || status === 403) return new HttpError(502, `Euler rejected the credentials: ${msg}`, 'euler_auth');
  if (status === 429) return new HttpError(429, 'Euler rate limit reached. Try again shortly.', 'euler_rate_limit');
  if (status === 404) return new HttpError(502, msg, 'euler_not_found');
  return new HttpError(502, msg, 'euler_error');
}

export class EulerService {
  private secCache = new Map<string, { v: string; exp: number }>();

  constructor(private db: SupabaseClient, private make: ClientFactory = makeClient) {}

  async connection(agencyId: string): Promise<Connection> {
    const { data, error } = await this.db.from('euler_connections').select('*').eq('agency_id', agencyId).maybeSingle();
    if (error) throw new HttpError(500, 'Could not load the Euler connection');
    if (data) return data as Connection;
    const { data: created, error: e2 } = await this.db.from('euler_connections').insert({ agency_id: agencyId }).select('*').single();
    if (e2) throw new HttpError(500, 'Could not create the Euler connection');
    return created as Connection;
  }

  async credentials(agencyId: string): Promise<Credentials> {
    const { data, error } = await this.db.from('euler_credentials')
      .select('api_key_enc, cookie_enc, oauth_access_enc, oauth_refresh_enc, oauth_expires_at').eq('agency_id', agencyId).maybeSingle();
    if (error) throw new HttpError(500, 'Could not load credentials');
    return (data ?? { api_key_enc: null, cookie_enc: null, oauth_access_enc: null, oauth_refresh_enc: null, oauth_expires_at: null }) as Credentials;
  }

  async apiKey(agencyId: string): Promise<string> {
    const cr = await this.credentials(agencyId);
    if (!cr.api_key_enc) throw new HttpError(409, 'Add an Euler API key on Data source first', 'no_api_key');
    return open(cr.api_key_enc, agencyId);
  }

  /**
   * Session for a tool call. Read-only calls need only an API key Euler accepted. Calls that act on a room
   * (needsAuth) also need the OAuth / cookie moderation session, which is optional for an agency.
   */
  async session(agencyId: string, needsAuth: boolean): Promise<EulerSession> {
    const conn = await this.connection(agencyId);
    if (conn.key_status === 'invalid') throw new HttpError(409, 'Euler rejected the saved API key. Paste a new one on Data source.', 'invalid_api_key');
    if (conn.key_status !== 'valid') throw new HttpError(409, 'Add your Euler API key on Data source first', 'no_api_key');
    const cr = await this.credentials(agencyId);
    if (!cr.api_key_enc) throw new HttpError(409, 'Add your Euler API key on Data source first', 'no_api_key');
    const s: EulerSession = { client: this.make(open(cr.api_key_enc, agencyId)), conn };
    if (!needsAuth) return s;
    if (conn.status !== 'connected') throw new HttpError(409, 'Room moderation needs an OAuth or cookie session. Connect one on Data source.', 'not_connected');
    if (conn.mode === 'cookie') {
      if (!cr.cookie_enc) throw new HttpError(409, 'Cookie mode needs an x-cookie-header on Data source', 'no_cookie');
      s.cookie = open(cr.cookie_enc, agencyId);
    } else {
      s.oauthToken = await this.oauthAccessToken(agencyId, cr, s.client);
    }
    return s;
  }

  /** Returns a valid access token, refreshing (and re-sealing) it when it is within a minute of expiry. */
  private async oauthAccessToken(agencyId: string, cr: Credentials, client: EulerStreamApiClient): Promise<string> {
    if (!cr.oauth_access_enc) throw new HttpError(409, 'Authorize with Euler OAuth on Data source', 'no_oauth');
    const exp = cr.oauth_expires_at ? Date.parse(cr.oauth_expires_at) : Infinity;
    if (exp - Date.now() > 60_000) return open(cr.oauth_access_enc, agencyId);
    const { clientId, clientSecret } = oauthApp();
    if (!cr.oauth_refresh_enc) throw new HttpError(409, 'OAuth session expired. Authorize again.', 'oauth_expired');
    try {
      const r = await client.general.exchangeToken({
        client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: open(cr.oauth_refresh_enc, agencyId),
      });
      const t = r.data.data;
      if (!t?.access_token) throw new Error(r.data.error ? JSON.stringify(r.data.error) : 'No token returned');
      await this.storeTokens(agencyId, t);
      return t.access_token;
    } catch (e) {
      await this.db.from('euler_connections').update({ status: 'disconnected', updated_at: new Date().toISOString() }).eq('agency_id', agencyId);
      throw new HttpError(409, 'OAuth session expired and could not be refreshed. Authorize again.', 'oauth_expired');
    }
  }

  async storeTokens(agencyId: string, t: { access_token: string; refresh_token?: string; expires_in?: number }) {
    const { error } = await this.db.from('euler_credentials').upsert({
      agency_id: agencyId,
      oauth_access_enc: seal(t.access_token, agencyId),
      ...(t.refresh_token ? { oauth_refresh_enc: seal(t.refresh_token, agencyId) } : {}),
      oauth_expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
      oauth_state_hash: null, oauth_state_expires_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agency_id' });
    if (error) throw new HttpError(500, 'Could not store OAuth tokens');
  }

  /** sensitive_words tools need the room owner's sec_uid; resolve it from room info and cache for an hour. */
  private async secUid(s: EulerSession, uniqueId: string): Promise<string> {
    const hit = this.secCache.get(uniqueId);
    if (hit && hit.exp > Date.now()) return hit.v;
    const r = await s.client.anchors.retrieveRoomInfo(uniqueId);
    const v = r.data.data?.user?.sec_uid;
    if (!v) throw new HttpError(502, `Could not resolve sec_uid for @${uniqueId}`, 'euler_error');
    this.secCache.set(uniqueId, { v, exp: Date.now() + 3_600_000 });
    return v;
  }

  /** Validates input, calls Euler, normalises output and records the call for the Data source log. */
  async runTool<T extends ToolName>(agencyId: string, userId: string, tool: T, rawArgs: unknown): Promise<ToolOutput<T>> {
    const parsed = TOOL_INPUTS[tool].safeParse(rawArgs ?? {});
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid arguments', 'validation');
    const args = parsed.data as Record<string, unknown>;
    const needsAuth = AUTH_TOOLS.has(tool);
    const t0 = Date.now();
    let s: EulerSession | undefined;
    try {
      s = await this.session(agencyId, needsAuth);
      const out = await this.exec(s, tool, args);
      await this.record(agencyId, userId, tool, args, true, Date.now() - t0, s, null);
      return out as ToolOutput<T>;
    } catch (e) {
      const err = e instanceof HttpError ? e : eulerError(e);
      await this.record(agencyId, userId, tool, args, false, Date.now() - t0, s, err.message);
      throw err;
    }
  }

  private async record(agencyId: string, userId: string, tool: string, args: Record<string, unknown>, ok: boolean, ms: number, s: EulerSession | undefined, error: string | null) {
    const auth = AUTH_TOOLS.has(tool as ToolName) && s ? (s.conn.mode === 'oauth' ? 'x-oauth-token' : 'x-cookie-header') : null;
    const { error: e } = await this.db.from('euler_calls').insert({ agency_id: agencyId, user_id: userId, tool, args, ok, ms, auth, error });
    if (e) console.error(JSON.stringify({ level: 'warn', msg: 'euler_calls insert failed', err: e.message }));
  }

  private async exec(s: EulerSession, tool: ToolName, a: Record<string, any>): Promise<unknown> {
    const { client: c, oauthToken: tok, cookie: ck } = s;
    const ok = (r: { data: { code?: number; message?: string } }) => {
      if ((r.data.code ?? 200) >= 400) throw new HttpError(502, r.data.message ?? 'Euler request failed', 'euler_error');
      return { ok: true as const };
    };
    const users = (list: any[] | undefined): RoomUser[] => (list ?? []).map(u => ({
      user_id: String(u.id_str ?? u.id ?? u.user_id ?? ''), name: u.display_id ? '@' + u.display_id : (u.nickname ?? ''),
    })).filter(u => u.user_id);

    switch (tool) {
      case 'get_user_id': {
        const r = await c.anchors.retrieveWebcastUserId(a.unique_id);
        if (!r.data.numeric_user_id) throw new HttpError(502, r.data.message ?? `No TikTok user @${a.unique_id}`, 'euler_not_found');
        return { user_id: r.data.numeric_user_id };
      }
      case 'get_user_basic': {
        const u = (await c.tikTokUsers.retrieveTikTokUserBasic(a.unique_id)).data.user;
        if (!u) throw new HttpError(502, `No TikTok user @${a.unique_id}`, 'euler_not_found');
        return { unique_id: u.unique_id, nickname: u.nickname, region: u.region, avatar_url: u.avatar_thumb?.[0] ?? null };
      }
      case 'get_room_id': {
        const r = (await c.anchors.retrieveRoomId(a.unique_id)).data;
        return { room_id: r.is_live && r.room_id ? r.room_id : null, is_live: !!r.is_live };
      }
      case 'get_live_feed': {
        const items = (await c.webcast.retrieveWebcastFeed(a.region)).data.response?.data.data ?? [];
        return {
          rooms: items.map(i => i.data).filter(d => d?.owner?.display_id).map(d => ({
            room_id: d.id_str, title: d.title, viewer_count: d.user_count ?? d.stats?.total_user ?? 0,
            creator: { unique_id: d.owner.display_id.toLowerCase(), nickname: d.owner.nickname, user_id: d.owner.id_str },
          })).sort((x, y) => y.viewer_count - x.viewer_count),
        };
      }
      case 'rankings-get_leaderboard_catalog': {
        const r = (await c.rankings.getAvailableRankings()).data;
        return { regions: Object.entries(r.regions ?? {}).map(([region, o]) => ({ region, rank_names: [...o.rankings], leagues: [...o.leagues] })) };
      }
      case 'rankings-get_leaderboard': {
        const r = (await c.rankings.getLeaderboard(a.rank_name, a.region, a.date, a.rank_name === 'RANKING_LEAGUE' ? a.league : undefined)).data;
        if (r.code >= 400) throw new HttpError(502, r.message ?? 'No snapshot for that date', 'euler_error');
        return {
          date: r.date ?? null, is_latest: !!r.is_latest,
          ranks: (r.ranks ?? []).map(x => ({ rank: x.rank, score: x.score, unique_id: x.user.unique_id, nickname: x.user.nickname, numeric_id: x.user.numeric_id })),
        };
      }
      case 'toggle_room_comments': return ok(await c.moderation.toggleRoomComments(a.room_id, a.enabled, tok, ck));
      case 'mutes-get_muted_users': return { users: users((await c.moderation.retrieveRoomMutedUsers(a.room_id, a.page, tok, ck)).data.response?.data.data) };
      // comment_msg_id exceeds Number.MAX_SAFE_INTEGER; pass the digit string through untouched (it is serialised as a query param)
      case 'mutes-mute_room_user': return ok(await c.moderation.muteRoomUser(a.room_id, a.user_id, a.duration, a.comment_msg_id as unknown as number, tok, ck));
      case 'mutes-unmute_room_user': return ok(await c.moderation.unmuteRoomUser(a.room_id, a.user_id, tok, ck));
      case 'bans-get_banned_users': return { users: users((await c.moderation.retrieveRoomBannedUsers(a.room_id, a.page, tok, ck)).data.response?.data.data) };
      case 'bans-ban_room_user': return ok(await c.moderation.kickRoomUser(a.room_id, a.tiktok_user_id, a.comment_msg_id, tok, ck));
      case 'bans-unban_room_user': return ok(await c.moderation.unbanRoomUser(a.room_id, a.tiktok_user_id, tok, ck));
      case 'moderators-get_room_moderators': return { moderators: users((await c.anchors.retrieveRoomModerators(a.anchor_id, tok, ck)).data.response?.data.data) };
      case 'moderators-add_room_moderator': return ok(await c.anchors.addRoomModerator(a.to_user_id, a.anchor_id, tok, ck));
      case 'moderators-remove_room_moderator': return ok(await c.anchors.removeRoomModerator(a.to_user_id, a.anchor_id, tok, ck));
      case 'sensitive_words-get_sensitive_words': {
        const words = (await c.moderation.getSensitiveWords(await this.secUid(s, a.unique_id), a.room_id, tok, ck)).data.response?.data.data.words ?? [];
        return { words: words.map((w: any) => ({ word_id: String(w.word_id ?? w.id ?? w.id_str ?? ''), word: String(w.word ?? w.content ?? '') })).filter(w => w.word_id && w.word) };
      }
      case 'sensitive_words-add_sensitive_word': return ok(await c.moderation.addSensitiveWord(a.word, await this.secUid(s, a.unique_id), a.room_id, tok, ck));
      case 'sensitive_words-delete_sensitive_word': return ok(await c.moderation.deleteSensitiveWord(a.word_id, await this.secUid(s, a.unique_id), a.room_id, tok, ck));
    }
  }
}

export function oauthApp() {
  const clientId = optional('EULER_OAUTH_CLIENT_ID'), clientSecret = optional('EULER_OAUTH_CLIENT_SECRET'), authorizeUrl = optional('EULER_OAUTH_AUTHORIZE_URL');
  if (!clientId || !clientSecret || !authorizeUrl) throw new HttpError(503, 'Euler OAuth is not configured on the server (EULER_OAUTH_CLIENT_ID, _SECRET, _AUTHORIZE_URL)', 'oauth_unconfigured');
  return { clientId, clientSecret, authorizeUrl };
}

export const OAUTH_SCOPES = ['user:info', 'webcast:mute', 'webcast:ban', 'webcast:comments', 'webcast:moderators', 'webcast:sensitive_words'];
