import { describe, expect, it, vi } from 'vitest';
import { GiftBuffer } from '../src/sink';
import type { GiftRow } from '../src/euler';

const row = (msg_id: string, agency_id = 'a'): GiftRow => ({
  agency_id, creator_unique_id: 'nova_shift', room_id: null, msg_id, sender_user_id: null, sender_unique_id: null, sender_nickname: null,
  gift_id: 1, gift_name: 'Rose', diamond_count: 1, repeat_count: 1, occurred_at: new Date().toISOString(), raw: {},
});

/** A fake Supabase client whose upsert fails with `code` whenever the batch contains a row from `poisonAgency`. */
function fakeDb(poisonAgency: string, code: string) {
  const written: string[] = [];
  const db = { from: () => ({ upsert: async (rows: GiftRow[]) => {
    if (rows.some(r => r.agency_id === poisonAgency)) return { error: { code, message: 'violates constraint' }, count: null };
    written.push(...rows.map(r => r.msg_id));
    return { error: null, count: rows.length };
  } }) };
  return { db: db as never, written };
}

describe('GiftBuffer', () => {
  it('drops a row the database will never accept and keeps the rest', async () => {
    const { db, written } = fakeDb('gone', '23503');
    const q = new GiftBuffer(db, 60_000);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    q.push([row('1'), row('2', 'gone'), row('3')]);
    await q.flush();
    expect(written).toEqual(['1', '3']);
    await q.flush(); // nothing left queued: the poison row is gone, not retried forever
    expect(written).toEqual(['1', '3']);
    expect(err.mock.calls.some(c => String(c[0]).includes('dropped unwritable gift row'))).toBe(true);
    err.mockRestore();
    await q.close();
  });

  it('keeps every row queued when the failure is transient', async () => {
    const { db, written } = fakeDb('a', '08006');
    const q = new GiftBuffer(db, 60_000);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    q.push([row('1')]);
    const t0 = Date.now();
    await q.flush();
    expect(written).toEqual([]);
    expect((q as unknown as { q: unknown[] }).q.length).toBe(1);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(900); // backs off before the next try
    err.mockRestore();
    clearInterval((q as unknown as { timer: NodeJS.Timeout }).timer);
  });
});
