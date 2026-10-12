import type { SupabaseClient } from '@supabase/supabase-js';
import type { GiftRow } from './euler';

/** Idempotent write: (agency_id, msg_id) is unique, duplicates from reconnect replays are dropped. */
export async function writeGiftRows(db: SupabaseClient, rows: GiftRow[]) {
  if (!rows.length) return { inserted: 0 };
  const { error, count } = await db
    .from('gift_transactions')
    .upsert(rows, { onConflict: 'agency_id,msg_id', ignoreDuplicates: true, count: 'exact' });
  if (error) throw Object.assign(new Error(`gift_transactions upsert: ${error.message}`), { code: error.code });
  return { inserted: count ?? rows.length };
}

/** Buffers rows and flushes every `intervalMs` or at `maxBatch`. Failed batches are retried, never dropped silently. */
export class GiftBuffer {
  private q: GiftRow[] = [];
  private timer: NodeJS.Timeout;
  private flushing = false;
  private failures = 0;

  constructor(private db: SupabaseClient, private intervalMs = 500, private maxBatch = 200, private maxQueued = 20000) {
    this.timer = setInterval(() => void this.flush(), intervalMs);
  }

  push(rows: GiftRow[]) {
    this.q.push(...rows);
    if (this.q.length > this.maxQueued) {
      const dropped = this.q.splice(0, this.q.length - this.maxQueued);
      console.error(JSON.stringify({ level: 'error', msg: 'gift buffer overflow', dropped: dropped.length, sample: dropped[0]?.msg_id }));
    }
    if (this.q.length >= this.maxBatch) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.q.length) return;
    this.flushing = true;
    const batch = this.q.slice(0, this.maxBatch);
    try {
      await writeGiftRows(this.db, batch);
      this.q.splice(0, batch.length);
      this.failures = 0;
    } catch (e: any) {
      this.failures++;
      console.error(JSON.stringify({ level: 'error', msg: 'gift flush failed', code: e.code, err: e.message, queued: this.q.length }));
      if (e.code === '42501') console.error('RLS violation on worker insert: the worker is not using the service role key.');
      await new Promise(r => setTimeout(r, Math.min(30000, 500 * 2 ** this.failures)));
    } finally {
      this.flushing = false;
    }
  }

  async close() {
    clearInterval(this.timer);
    for (let i = 0; i < 20 && this.q.length; i++) await this.flush();
  }
}
