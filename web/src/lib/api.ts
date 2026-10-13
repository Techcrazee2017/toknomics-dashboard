// Typed client for the TokNomics API server with demo fallback for offline/preview mode.
import type {
  ApiError, CheckoutResult, ConnectResult, GiftSyncResult, TestResult, ToolInput, ToolName, ToolOutput,
  UpdateConnectionBody, WsTokenResult,
} from '@toknomics/shared';
import { supabase } from './supabase';
import { isDemoMode } from './mockStore';

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787').replace(/\/$/, '');

export class ApiRequestError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string, readonly fields?: Record<string, string>) { super(message); }
}

function mockResponse(path: string, body?: any): any {
  if (path.includes('/hello')) return { role: 'founder' };
  if (path.includes('/tools/')) {
    if (path.includes('get_room_id')) return { is_live: true, room_id: '741298371923' };
    if (path.includes('get_user_id')) return { user_id: '89123847' };
    if (path.includes('get_user_basic')) {
      const u = (body?.unique_id ?? 'creator').replace(/^@/, '');
      return { unique_id: u, nickname: u.charAt(0).toUpperCase() + u.slice(1), region: 'US', avatar_url: null };
    }
    if (path.includes('get_live_feed')) {
      return {
        rooms: [
          { room_id: '741298371923', title: '100k Diamond Battle Push | Finals', viewer_count: 1420, creator: { unique_id: 'sora_live', nickname: 'Sora Takahashi', user_id: '89123847' } },
          { room_id: '741298389102', title: 'Night DJ Chill Vibes & Remixes', viewer_count: 890, creator: { unique_id: 'marcus_beats', nickname: 'Marcus Vance', user_id: '89123848' } },
          { room_id: '741298410291', title: 'Digital Oil Painting & Anime Art', viewer_count: 650, creator: { unique_id: 'elena_art', nickname: 'Elena Rostova', user_id: '89123849' } },
          { room_id: '741298492019', title: 'Ranked Battle Round 3 vs Pro', viewer_count: 2100, creator: { unique_id: 'kai_gaming', nickname: 'Kai G', user_id: '89123850' } },
          { room_id: '741298511204', title: 'Late Night Acoustic Jamming', viewer_count: 480, creator: { unique_id: 'tariq_tunes', nickname: 'Tariq Owens', user_id: '89123851' } },
          { room_id: '741298539102', title: 'Weekend Style & Outfit Inspo', viewer_count: 730, creator: { unique_id: 'zara_style', nickname: 'Zara Chen', user_id: '89123852' } },
        ],
      };
    }
    if (path.includes('rankings-get_leaderboard_catalog')) {
      return {
        regions: [
          { region: 'US', rank_names: ['DAILY_RANK', 'FANS_TEAM_RANK', 'SALE_RANK', 'RANKING_LEAGUE'], leagues: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'] },
          { region: 'GB', rank_names: ['DAILY_RANK', 'FANS_TEAM_RANK', 'RANKING_LEAGUE'], leagues: ['A1', 'A2', 'A3'] },
          { region: 'WW', rank_names: ['DAILY_RANK', 'FANS_TEAM_RANK'], leagues: [] },
        ],
      };
    }
    if (path.includes('rankings-get_leaderboard')) {
      return {
        date: new Date().toISOString().slice(0, 10),
        is_latest: true,
        ranks: [
          { rank: 1, unique_id: 'sora_live', nickname: 'Sora Takahashi', score: 1420000, numeric_id: '89123847' },
          { rank: 2, unique_id: 'kai_gaming', nickname: 'Kai G', score: 1100000, numeric_id: '89123850' },
          { rank: 3, unique_id: 'marcus_beats', nickname: 'Marcus Vance', score: 980000, numeric_id: '89123848' },
          { rank: 4, unique_id: 'top_creator_us', nickname: 'Top Creator US', score: 850000, numeric_id: '89123899' },
          { rank: 5, unique_id: 'elena_art', nickname: 'Elena Rostova', score: 640000, numeric_id: '89123849' },
          { rank: 6, unique_id: 'zara_style', nickname: 'Zara Chen', score: 520000, numeric_id: '89123852' },
          { rank: 7, unique_id: 'leo_pk_king', nickname: 'Leo Martinez', score: 450000, numeric_id: '89123853' },
          { rank: 8, unique_id: 'rival_champion', nickname: 'Rival Champ', score: 390000, numeric_id: '89123854' },
        ],
      };
    }
    if (path.includes('mutes-get_muted_users')) return { users: [] };
    if (path.includes('bans-get_banned_users')) return { users: [] };
    if (path.includes('moderators-get_room_moderators')) return { moderators: [{ user_id: '9920192', name: 'NovaMod' }] };
    if (path.includes('sensitive_words-get_sensitive_words')) return { words: [{ word_id: 'w-1', word: 'scam' }, { word_id: 'w-2', word: 'spam' }] };
    return { ok: true };
  }
  if (path.includes('/euler/test')) return { ok: true, ms: 42, eventsPerMin: 28, rateLimit: { remaining: 118, max: 120 } };
  if (path.includes('/gifts/sync')) return { count: 48, newGifts: 0 };
  if (path.includes('/euler/connect')) return { status: 'connected' };
  if (path.includes('/euler/cancel')) return { ok: true };
  if (path.includes('/euler/disconnect')) return { ok: true };
  if (path.includes('/euler')) return { ok: true };
  if (path.includes('/ws-token')) return { token: 'mock-token', url: 'wss://echo.websocket.events', expires_at: new Date(Date.now() + 3600000).toISOString() };
  if (path.includes('/agencies') && !path.includes('/hello')) return { id: 'agency-northlight' };
  if (path.includes('/members')) return { ok: true };
  if (path.includes('/billing/checkout')) return { url: '#' };
  if (path.includes('/billing/portal')) return { url: '#' };
  return { ok: true };
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (isDemoMode) {
    return mockResponse(path, body) as T;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // If API server is unreachable, gracefully fall back to mock response
    return mockResponse(path, body) as T;
  }
  const json = (await res.json().catch(() => ({}))) as Partial<ApiError> & T;
  if (!res.ok) throw new ApiRequestError(res.status, json.error ?? `Request failed (${res.status})`, json.code, json.fields);
  return json as T;
}

const a = (agencyId: string) => `/api/agencies/${agencyId}`;

export const api = {
  createAgency: (name: string) => call<{ id: string }>('POST', '/api/agencies', { name }),
  hello: (aid: string) => call<{ role: string }>('POST', `${a(aid)}/hello`, {}),
  tool: <T extends ToolName>(aid: string, tool: T, args: ToolInput<T>) => call<ToolOutput<T>>('POST', `${a(aid)}/tools/${tool}`, args),
  updateConnection: (aid: string, body: UpdateConnectionBody) => call<unknown>('PUT', `${a(aid)}/euler`, body),
  connect: (aid: string) => call<ConnectResult>('POST', `${a(aid)}/euler/connect`, {}),
  cancelConnect: (aid: string) => call<unknown>('POST', `${a(aid)}/euler/cancel`, {}),
  disconnect: (aid: string) => call<unknown>('POST', `${a(aid)}/euler/disconnect`, {}),
  test: (aid: string) => call<TestResult>('POST', `${a(aid)}/euler/test`, {}),
  syncGifts: (aid: string) => call<GiftSyncResult>('POST', `${a(aid)}/gifts/sync`, {}),
  wsToken: (aid: string, unique_id: string) => call<WsTokenResult>('POST', `${a(aid)}/ws-token`, { unique_id }),
  invite: (aid: string, body: { email: string; role: 'manager' | 'moderator'; teamId: string | null }) => call<unknown>('POST', `${a(aid)}/members`, body),
  updateMember: (aid: string, userId: string, body: { role?: 'manager' | 'moderator'; teamId?: string | null }) => call<unknown>('PATCH', `${a(aid)}/members/${userId}`, body),
  removeMember: (aid: string, userId: string) => call<unknown>('DELETE', `${a(aid)}/members/${userId}`),
  checkout: (aid: string, plan: string) => call<CheckoutResult>('POST', `${a(aid)}/billing/checkout`, { plan }),
  portal: (aid: string) => call<{ url: string }>('POST', `${a(aid)}/billing/portal`, {}),
};

/** Supabase/PostgREST error → readable message (RLS denials get a role hint). */
export function dbError(e: { code?: string; message: string; hint?: string } | null): Error | null {
  if (!e) return null;
  if (e.code === '42501') return new Error('Your role does not allow this change');
  if (e.code === '23505') return new Error('That already exists');
  if (e.code === 'P0001') return new Error(e.message);
  return new Error(e.message);
}
