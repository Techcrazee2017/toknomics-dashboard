import { describe, expect, it } from 'vitest';
import { giftToRows, parseFrame, roomIdOf, isViewerCount, viewerCountOf } from '../src/euler';

const gift = (over: Record<string, unknown> = {}) => ({
  type: 'WebcastGiftMessage',
  data: {
    common: { msgId: '7391', createTime: '1760000000000', roomId: '7400000000000000000' },
    giftId: 5655, repeatCount: 7, repeatEnd: 1,
    user: { userId: '700', uniqueId: 'TN.Vault', nickname: 'Vault' },
    giftDetails: { giftName: 'Rose', diamondCount: 1, giftType: 1 },
    ...over,
  },
});
const ctx = { creatorUniqueId: 'nova_shift', roomId: null, agencyIds: ['a', 'b'] };

describe('parseFrame', () => {
  it('unwraps a ClientMessageBundle', () => {
    expect(parseFrame(JSON.stringify({ timestamp: 1, messages: [gift(), { type: 'roomInfo', data: {} }] }))).toHaveLength(2);
  });
  it('accepts arrays and single events, drops junk', () => {
    expect(parseFrame(JSON.stringify([gift()]))).toHaveLength(1);
    expect(parseFrame(JSON.stringify(gift()))).toHaveLength(1);
    expect(parseFrame('not json')).toEqual([]);
    expect(parseFrame(JSON.stringify({ messages: [null, 3, { nope: 1 }] }))).toEqual([]);
  });
});

describe('giftToRows', () => {
  it('books a finished streak once per tracking agency', () => {
    const rows = giftToRows(gift() as never, ctx);
    expect(rows.map(r => r.agency_id)).toEqual(['a', 'b']);
    expect(rows[0]).toMatchObject({ msg_id: '7391', gift_id: 5655, diamond_count: 1, repeat_count: 7, sender_unique_id: 'tn.vault', room_id: '7400000000000000000', occurred_at: new Date(1760000000000).toISOString() });
  });
  it('skips streak ticks until repeatEnd', () => {
    expect(giftToRows(gift({ repeatEnd: 0 }) as never, ctx)).toEqual([]);
  });
  it('books non-streak gifts immediately', () => {
    expect(giftToRows(gift({ repeatEnd: 0, giftDetails: { giftName: 'Lion', diamondCount: 29999, giftType: 2 } }) as never, ctx)).toHaveLength(2);
  });
  it('prices from the catalog when giftDetails is missing', () => {
    const catalog = new Map([[5655, { name: 'Rose', diamondCount: 1, giftType: 1 }]]);
    const rows = giftToRows(gift({ giftDetails: undefined }) as never, { ...ctx, catalog });
    expect(rows[0]).toMatchObject({ gift_name: 'Rose', diamond_count: 1 });
    expect(giftToRows(gift({ giftDetails: undefined }) as never, ctx)).toEqual([]);
  });
  it('ignores non-gift events and gifts without a msgId', () => {
    expect(giftToRows({ type: 'WebcastChatMessage', data: {} } as never, ctx)).toEqual([]);
    expect(giftToRows(gift({ common: {} }) as never, ctx)).toEqual([]);
  });
});

describe('room + viewers', () => {
  it('reads room id from common or the roomInfo frame', () => {
    expect(roomIdOf(gift() as never)).toBe('7400000000000000000');
    expect(roomIdOf({ type: 'roomInfo', data: { id_str: '7411' } } as never)).toBe('7411');
    expect(roomIdOf({ type: 'roomInfo', data: { id: 'abc' } } as never)).toBeNull();
  });
  it('reads viewer counts', () => {
    const e = { type: 'WebcastRoomUserSeqMessage', data: { viewerCount: 8342 } };
    expect(isViewerCount(e as never) && viewerCountOf(e as never)).toBe(8342);
  });
});
