// Persistent Euler Stream ingestion worker.
// One socket per distinct active tracked_targets.unique_id; gifts fan out to every agency tracking that creator.
import WebSocket from 'ws';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createWebSocketUrl, SchemaVersion, ClientCloseCode as C } from '@eulerstream/euler-websocket-sdk';
import { need, redact, serviceClient } from './env';
import { parseFrame, giftToRows, isGift, roomIdOf } from './euler';
import { GiftBuffer } from './sink';

const EULER_WS = process.env.EULER_WS_URL; // optional override; SDK default is wss://ws.eulerstream.com

/** SDK builds the URL (schema v2, bundled frames); apiKey is appended if the SDK didn't set it. */
function socketUrl(uniqueId: string): string {
  const u = new URL(createWebSocketUrl({ uniqueId, features: { schemaVersion: SchemaVersion.v2, bundleEvents: true } }));
  if (EULER_WS) { const o = new URL(EULER_WS); u.protocol = o.protocol; u.host = o.host; }
  if (!u.searchParams.has('apiKey')) u.searchParams.set('apiKey', EULER_API_KEY);
  return u.toString();
}
const EULER_API_KEY = need('EULER_API_KEY');
const MAX_SOCKETS = Number(process.env.MAX_SOCKETS ?? 200);
const RECONCILE_MS = 30_000;
const STALE_MS = 45_000;      // no frame or pong for this long → terminate and reconnect
const PING_MS = 15_000;
const STABLE_MS = 60_000;     // connection this old resets the backoff counter

type Policy = { reconnect: boolean; minDelay: number; status: string; resetAttempts?: boolean };

// Close codes via the SDK's ClientCloseCode enum (matches the Data source screen)
function policyFor(code: number): Policy {
  switch (code) {
    case C.NORMAL:                return { reconnect: false, minDelay: 0, status: 'stopped' };
    case C.INVALID_OPTIONS:       return { reconnect: false, minDelay: 0, status: 'invalid' };     // bad uniqueId, retrying won't help
    case C.MAX_LIFETIME_EXCEEDED: return { reconnect: true, minDelay: 250, status: 'connecting', resetAttempts: true }; // 8h cap
    case C.NO_MESSAGES_TIMEOUT:   return { reconnect: true, minDelay: 1_000, status: 'backoff' };
    case C.NOT_LIVE:
    case C.STREAM_END:            return { reconnect: true, minDelay: 60_000, status: 'offline' };   // poll slowly
    case C.TOO_MANY_CONNECTIONS:  return { reconnect: true, minDelay: 30_000, status: 'backoff' };
    case C.INVALID_AUTH:
    case C.NO_PERMISSION:         return { reconnect: true, minDelay: 10 * 60_000, status: 'auth_error' };
    // TIKTOK_CLOSED_CONNECTION, INTERNAL_SERVER_ERROR, WEBCAST_FETCH_ERROR, ROOM_INFO_FETCH_ERROR, 1006 drops
    default:                      return { reconnect: true, minDelay: 1_000, status: 'backoff' };
  }
}

/** Full-jitter exponential backoff. Fast during battles (1s → 30s cap); offline/rate-limit floors come from policy. */
function backoff(attempt: number, minDelay: number): number {
  const cap = minDelay >= 60_000 ? 5 * 60_000 : 30_000;
  const exp = Math.min(cap, Math.max(1_000, minDelay) * 2 ** attempt);
  return Math.max(minDelay, Math.round(Math.random() * exp));
}

const log = (o: Record<string, unknown>) => console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));

class StreamConnection {
  private ws?: WebSocket;
  private attempts = 0;
  private openedAt = 0;
  private lastSeen = 0;
  private retryTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private roomId: string | null = null;
  private lastStatusWrite = 0;
  private stopped = false;
  agencyIds: string[] = [];

  constructor(readonly uniqueId: string, private db: SupabaseClient, private gifts: GiftBuffer) {}

  start() { this.stopped = false; this.connect(); }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.ws?.close(1000, 'untracked');
    void this.setStatus({ status: 'stopped', next_retry_at: null });
  }

  private connect() {
    if (this.stopped) return;
    const url = socketUrl(this.uniqueId);
    log({ msg: 'connect', uid: this.uniqueId, attempt: this.attempts, url: redact(url) });
    void this.setStatus({ status: 'connecting', next_retry_at: null });

    const ws = new WebSocket(url, { handshakeTimeout: 15_000 });
    this.ws = ws;

    ws.on('open', () => {
      this.openedAt = this.lastSeen = Date.now();
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (Date.now() - this.lastSeen > STALE_MS) { log({ msg: 'stale socket, terminating', uid: this.uniqueId }); ws.terminate(); return; }
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, PING_MS);
      void this.setStatus({ status: 'live', close_code: null, last_error: null });
    });

    ws.on('pong', () => { this.lastSeen = Date.now(); });

    ws.on('message', (raw: Buffer) => {
      this.lastSeen = Date.now();
      // First frame carries room info (room ID, profile); roomIdOf picks it up from there or from any event's common block
      for (const ev of parseFrame(raw)) {
        this.roomId ??= roomIdOf(ev);
        if (isGift(ev)) this.gifts.push(giftToRows(ev, { creatorUniqueId: this.uniqueId, roomId: this.roomId, agencyIds: this.agencyIds }));
      }
      if (Date.now() - this.lastStatusWrite > 10_000) void this.setStatus({ last_event_at: new Date().toISOString(), room_id: this.roomId });
    });

    ws.on('error', err => log({ level: 'warn', msg: 'socket error', uid: this.uniqueId, err: err.message }));

    // 'close' always follows 'error' in ws, so all reconnect logic lives here
    ws.on('close', (code: number, reason: Buffer) => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      const p = policyFor(code);
      const why = reason.toString() || undefined;
      if (Date.now() - this.openedAt > STABLE_MS || p.resetAttempts) this.attempts = 0;
      if (p.status === 'offline') this.roomId = null;
      if (this.stopped || !p.reconnect) {
        log({ level: code === C.INVALID_OPTIONS ? 'error' : 'info', msg: 'closed', uid: this.uniqueId, code, why });
        if (code === C.INVALID_OPTIONS) void this.setStatus({ status: p.status, close_code: code, last_error: why ?? 'Invalid uniqueId', next_retry_at: null });
        return;
      }
      const delay = backoff(this.attempts++, p.minDelay);
      log({ level: code === C.INVALID_AUTH || code === C.NO_PERMISSION ? 'error' : 'info', msg: 'closed, retrying', uid: this.uniqueId, code, why, delay });
      void this.setStatus({ status: p.status, close_code: code, last_error: why ?? null, next_retry_at: new Date(Date.now() + delay).toISOString() });
      this.retryTimer = setTimeout(() => this.connect(), delay);
    });
  }

  private async setStatus(patch: Record<string, unknown>) {
    this.lastStatusWrite = Date.now();
    const { error } = await this.db.from('stream_status').upsert({ unique_id: this.uniqueId, updated_at: new Date().toISOString(), ...patch }, { onConflict: 'unique_id' });
    if (error) log({ level: 'warn', msg: 'status write failed', uid: this.uniqueId, err: error.message });
  }
}

class Supervisor {
  private conns = new Map<string, StreamConnection>();
  private reconciling = false;
  private again = false;

  constructor(private db: SupabaseClient, private gifts: GiftBuffer) {}

  /** Diff desired set (active tracked_targets) against open sockets. Safe to call repeatedly. */
  async reconcile() {
    if (this.reconciling) { this.again = true; return; }
    this.reconciling = true;
    try {
      const { data, error } = await this.db.from('tracked_targets').select('agency_id, unique_id').eq('active', true);
      if (error) throw error;
      const want = new Map<string, string[]>();
      for (const r of data ?? []) want.set(r.unique_id, [...(want.get(r.unique_id) ?? []), r.agency_id]);

      for (const [uid, c] of this.conns) if (!want.has(uid)) { c.stop(); this.conns.delete(uid); log({ msg: 'untracked', uid }); }
      for (const [uid, agencies] of want) {
        let c = this.conns.get(uid);
        if (!c) {
          if (this.conns.size >= MAX_SOCKETS) { log({ level: 'warn', msg: 'MAX_SOCKETS reached', skipped: uid }); continue; }
          c = new StreamConnection(uid, this.db, this.gifts);
          this.conns.set(uid, c);
          c.agencyIds = agencies;
          c.start();
          log({ msg: 'tracked', uid, agencies: agencies.length });
        } else c.agencyIds = agencies;
      }
    } catch (e: any) {
      log({ level: 'error', msg: 'reconcile failed', err: e.message });
    } finally {
      this.reconciling = false;
      if (this.again) { this.again = false; void this.reconcile(); }
    }
  }

  listen() {
    // Realtime gives sub-second pickup when the dashboard upserts; the interval covers missed events.
    this.db.channel('tracked_targets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracked_targets' }, () => void this.reconcile())
      .subscribe(s => log({ msg: 'realtime', status: s }));
    setInterval(() => void this.reconcile(), RECONCILE_MS);
  }

  stopAll() { for (const c of this.conns.values()) c.stop(); }
}

async function main() {
  const db = serviceClient();
  const gifts = new GiftBuffer(db);
  const sup = new Supervisor(db, gifts);
  await sup.reconcile();
  sup.listen();

  const shutdown = async (sig: string) => {
    log({ msg: 'shutdown', sig });
    sup.stopAll();
    await gifts.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch(e => { console.error(e); process.exit(1); });
