// Frame parsing + gift mapping. Shared by worker.ts and scripts/verify-gift-pipeline.ts
// so the verification exercises the exact production code path.
import type { WebcastChatMessage, WebcastGiftMessage } from '@eulerstream/euler-websocket-sdk/v2';

// `& Loose` keeps fallback paths compiling until the v2 field names are confirmed against a live frame
type Loose = Record<string, any>;
export type GiftEvent = { type: 'WebcastGiftMessage'; data: WebcastGiftMessage & Loose };
export type ChatEvent = { type: 'WebcastChatMessage'; data: WebcastChatMessage & Loose };
export type OtherEvent = { type: string; data: Loose };
export type EulerEvent = GiftEvent | ChatEvent | OtherEvent;

export type GiftRow = {
  agency_id: string;
  creator_unique_id: string;
  room_id: string | null;
  msg_id: string;
  sender_user_id: string | null;
  sender_unique_id: string | null;
  sender_nickname: string | null;
  gift_id: number;
  gift_name: string | null;
  diamond_count: number;
  repeat_count: number;
  occurred_at: string;
  raw: unknown;
};

/**
 * Accepts `{ messages: [{ type, data }] }`, a bare array, or a single `{ type, data }`.
 * Payloads use the v2 schema requested by the worker (types from @eulerstream/euler-websocket-sdk/v2).
 */
export function parseFrame(raw: string | Buffer): EulerEvent[] {
  let j: any;
  try { j = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')); } catch { return []; }
  const list = Array.isArray(j) ? j : Array.isArray(j?.messages) ? j.messages : j?.type ? [j] : [];
  return list.filter((m: any) => m && typeof m.type === 'string').map((m: any) => ({ type: m.type, data: m.data ?? m }));
}

const first = (...v: any[]) => v.find(x => x !== undefined && x !== null && x !== '');
const num = (v: any) => (v === undefined || v === null || v === '' ? undefined : Number(v));

export const isGift = (e: EulerEvent): e is GiftEvent => e.type === 'WebcastGiftMessage' || e.type === 'gift';
export const isChat = (e: EulerEvent): e is ChatEvent => e.type === 'WebcastChatMessage' || e.type === 'chat';

/**
 * Streakable gifts (type 1) emit one message per combo tick; only the final tick (repeatEnd) is booked.
 * Field paths cover raw-proto JSON and tiktok-live-connector v1/v2 shapes.
 */
export function giftToRows(
  e: EulerEvent,
  ctx: { creatorUniqueId: string; roomId: string | null; agencyIds: string[] },
): GiftRow[] {
  if (!isGift(e)) return [];
  const d = e.data ?? ({} as GiftEvent['data']);
  const g: Loose = d.gift ?? d.giftDetails ?? {};
  const giftType = num(first(g.type, g.giftType, d.giftType));
  const repeatEnd = Boolean(num(first(d.repeatEnd, d.repeat_end)) ?? false);
  if (giftType === 1 && !repeatEnd) return [];

  const msgId = String(first(d.common?.msgId, d.msgId, d.common?.msg_id) ?? '');
  const giftId = num(first(d.giftId, g.id));
  const diamonds = num(first(g.diamondCount, g.diamond_count, d.diamondCount));
  if (!msgId || giftId === undefined || diamonds === undefined) return [];

  const created = num(first(d.common?.createTime, d.createTime));
  const u = d.user ?? {};
  const base = {
    creator_unique_id: ctx.creatorUniqueId,
    room_id: first(d.common?.roomId, ctx.roomId) != null ? String(first(d.common?.roomId, ctx.roomId)) : null,
    msg_id: msgId,
    sender_user_id: first(u.userId, u.id) != null ? String(first(u.userId, u.id)) : null,
    sender_unique_id: first(u.uniqueId, u.displayId) ?? null,
    sender_nickname: u.nickname ?? null,
    gift_id: giftId,
    gift_name: first(g.name, g.giftName, d.giftName) ?? null,
    diamond_count: diamonds,
    repeat_count: Math.max(1, num(first(d.repeatCount, d.comboCount)) ?? 1),
    occurred_at: new Date(created && created > 1e11 ? created : created ? created * 1000 : Date.now()).toISOString(),
    raw: d,
  };
  return ctx.agencyIds.map(agency_id => ({ agency_id, ...base }));
}

export function roomIdOf(e: EulerEvent): string | null {
  const v = first(e.data?.common?.roomId, e.data?.roomId, e.data?.roomInfo?.id, e.data?.id_str);
  return v != null ? String(v) : null;
}
