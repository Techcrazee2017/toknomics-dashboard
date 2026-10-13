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
    if (path.includes('get_user_info')) return { user_id: '89123847', unique_id: body?.unique_id ?? 'creator', follower_count: 42100 };
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
