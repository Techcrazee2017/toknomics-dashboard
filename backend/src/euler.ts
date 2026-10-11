// Frame parsing + gift mapping. Shared by worker.ts and scripts/verify-gift-pipeline.ts
// so the verification exercises the exact production code path.
// Shapes come from @eulerstream/euler-websocket-sdk 1.0.0: with bundleEvents the server sends a
// ClientMessageBundle `{ timestamp, messages: DecodedData[] }`; each entry is `{ type, data }` with
// `data` typed by tiktok-live-proto v2 (WebcastGiftMessage, WebcastRoomUserSeqMessage, …).
import type { DecodedData, WebcastGiftMessage, WebcastRoomUserSeqMessage } from '@eulerstream/euler-websocket-sdk';

export type EulerEvent = DecodedData | { type: string; data: unknown };
export type GiftEvent = { type: 'WebcastGiftMessage'; data: WebcastGiftMessage };
export type ViewerEvent = { type: 'WebcastRoomUserSeqMessage'; data: WebcastRoomUserSeqMessage };

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

/** Coin prices from gift_catalog, used when a gift event arrives without giftDetails. */
export type GiftCatalog = ReadonlyMap<number, { name: string; diamondCount: number; giftType: number | null }>;

/** Accepts a bundle `{ messages: [...] }`, a bare array, or a single `{ type, data }`. Never throws. */
export function parseFrame(raw: string | Buffer): EulerEvent[] {
  let j: unknown;
  try { j = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')); } catch { return []; }
  const list: unknown[] = Array.isArray(j) ? j : Array.isArray((j as { messages?: unknown })?.messages) ? (j as { messages: unknown[] }).messages : [j];
  return list.filter((m): m is EulerEvent => !!m && typeof m === 'object' && typeof (m as { type?: unknown }).type === 'string');
}

export const isGift = (e: EulerEvent): e is GiftEvent => e.type === 'WebcastGiftMessage' && !!e.data && typeof e.data === 'object';
export const isViewerCount = (e: EulerEvent): e is ViewerEvent => e.type === 'WebcastRoomUserSeqMessage' && !!e.data && typeof e.data === 'object';

/**
 * Streakable gifts (giftType 1) emit one message per combo tick with a running repeatCount; only the
 * final tick (repeatEnd = 1) is booked, so a 7× Rose streak becomes one row of repeat_count 7.
 */
export function giftToRows(
  e: EulerEvent,
  ctx: { creatorUniqueId: string; roomId: string | null; agencyIds: string[]; catalog?: GiftCatalog },
): GiftRow[] {
  if (!isGift(e)) return [];
  const d = e.data;
  const cat = ctx.catalog?.get(d.giftId);
  const giftType = d.giftDetails?.giftType ?? cat?.giftType ?? null;
  if (giftType === 1 && !d.repeatEnd) return [];

  const msgId = d.common?.msgId;
  const diamonds = d.giftDetails?.diamondCount || cat?.diamondCount;
  if (!msgId || !d.giftId || diamonds === undefined) return [];

  const created = Number(d.common?.createTime);
  const roomId = d.common?.roomId || ctx.roomId;
  const base = {
    creator_unique_id: ctx.creatorUniqueId,
    room_id: roomId ? String(roomId) : null,
    msg_id: String(msgId),
    sender_user_id: d.user?.userId || null,
    sender_unique_id: d.user?.uniqueId ? d.user.uniqueId.toLowerCase() : null,
    sender_nickname: d.user?.nickname || null,
    gift_id: d.giftId,
    gift_name: d.giftDetails?.giftName || cat?.name || null,
    diamond_count: diamonds,
    repeat_count: Math.max(1, d.repeatCount || 1),
    // createTime is epoch ms as a string in v2; tolerate seconds
    occurred_at: new Date(created > 1e11 ? created : created > 0 ? created * 1000 : Date.now()).toISOString(),
    raw: d,
  };
  return ctx.agencyIds.map(agency_id => ({ agency_id, ...base }));
}

/** Room id from any event's common block, or from the roomInfo frame Euler sends first. */
export function roomIdOf(e: EulerEvent): string | null {
  const d = e.data as { common?: { roomId?: string }; id?: unknown; roomId?: unknown; room_id?: unknown; id_str?: unknown } | null;
  if (!d || typeof d !== 'object') return null;
  if (e.type === 'roomInfo') {
    const v = d.id_str ?? d.id ?? d.roomId ?? d.room_id;
    return v != null && /^\d+$/.test(String(v)) ? String(v) : null;
  }
  return d.common?.roomId && d.common.roomId !== '0' ? String(d.common.roomId) : null;
}

export const viewerCountOf = (e: ViewerEvent): number | null =>
  Number.isFinite(e.data.viewerCount) && e.data.viewerCount > 0 ? e.data.viewerCount : null;
