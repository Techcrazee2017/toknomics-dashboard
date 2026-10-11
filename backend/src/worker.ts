// Persistent Euler Stream ingestion worker.
// One socket per distinct creator that any agency tracks (as a target or as a battle opponent);
// gifts fan out to every agency tracking that creator. Each socket authenticates with the API key of
// a tracking agency whose Euler connection is live, so disconnecting on Data source pauses ingestion.
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createWebSocketUrl, SchemaVersion, ClientCloseCode as C } from '@eulerstream/euler-websocket-sdk';
import { log, redact, serviceClient, need } from './env';
import { open } from './crypto';
import { parseFrame, giftToRows, isGift, isViewerCount, roomIdOf, viewerCountOf, type GiftCatalog } from './euler';
import { GiftBuffer } from './sink';

const MAX_SOCKETS = Number(process.env.MAX_SOCKETS ?? 200);
const RECONCILE_MS = 30_000;
const CATALOG_MS = 10 * 60_000;
const STALE_MS = 45_000;      // no frame or pong for this long → terminate and reconnect
const PING_MS = 15_000;
const STABLE_MS = 60_000;     // connection this old resets the backoff counter
const STATUS_EVERY_MS = 10_000;

/** SDK builds the URL (schema v2, bundled frames, key as a query param). EULER_WS_URL overrides the host via the SDK. */
export function socketUrl(uniqueId: string, apiKey: string): string {
  return createWebSocketUrl({ uniqueId, apiKey, features: { schemaVersion: SchemaVersion.v2, bundleEvents: true } });
}

type Policy = { reconnect: boolean; minDelay: number; status: string; resetAttempts?: boolean };

// Close codes via the SDK's ClientCloseCode enum (mirrors CLOSE_CODES in @toknomics/shared)
export function policyFor(code: number): Policy {
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
export function backoff(attempt: number, minDelay: number, rand = Math.random): number {
  const cap = minDelay >= 60_000 ? 5 * 60_000 : 30_000;
  const exp = Math.min(cap, Math.max(1_000, minDelay) * 2 ** attempt);
  return Math.max(minDelay, Math.round(rand() * exp));
}

export class StreamConnection {
  private ws?: WebSocket;
  private attempts = 0;
  private openedAt = 0;
  private lastSeen = 0;
  private retryTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private roomId: string | null = null;
  private storedRoomId: string | null = null;
  private viewers: number | null = null;
  private events = 0;
  private lastStatusWrite = 0;
  private stopped = false;
  /** Last status written. Every upsert carries it: a partial row would fail stream_status.status NOT NULL on the insert path. */
  private status = 'connecting';
  agencyIds: string[] = [];

  constructor(readonly uniqueId: string, public apiKey: string, private db: SupabaseClient, private gifts: GiftBuffer, private catalog: () => GiftCatalog) {}

  async start() {
    this.stopped = false;
    const { data } = await this.db.from('stream_status').select('room_id, events_ingested').eq('unique_id', this.uniqueId).maybeSingle();
    this.storedRoomId = data?.room_id ?? null;
    this.events = Number(data?.events_ingested ?? 0);
    this.connect();
  }

  stop(status: 'stopped' | 'paused' = 'stopped') {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.ws?.close(1000, 'untracked');
    void this.setStatus({ status, next_retry_at: null, connected_at: null, viewer_count: null });
  }

  /** Swaps the key (e.g. the agency that owned it disconnected) by reconnecting with the new one. */
  rekey(apiKey: string) {
    if (apiKey === this.apiKey) return;
    this.apiKey = apiKey;
    clearTimeout(this.retryTimer);
    this.attempts = 0;
    const old = this.ws;
    this.ws = undefined;
    old?.close(1000, 'rekey');
    this.connect();
  }

  private connect() {
    if (this.stopped) return;
    const url = socketUrl(this.uniqueId, this.apiKey);
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
      void this.setStatus({ status: 'live', close_code: null, last_error: null, connected_at: new Date().toISOString() });
    });

    ws.on('pong', () => { this.lastSeen = Date.now(); });

    ws.on('message', (raw: Buffer) => {
      if (this.ws !== ws) return;
      this.lastSeen = Date.now();
      for (const ev of parseFrame(raw)) {
        this.events++;
        if (!this.roomId) {
          const rid = roomIdOf(ev);
          if (rid) this.onRoom(rid);
        }
        if (isGift(ev)) this.gifts.push(giftToRows(ev, { creatorUniqueId: this.uniqueId, roomId: this.roomId, agencyIds: this.agencyIds, catalog: this.catalog() }));
        else if (isViewerCount(ev)) this.viewers = viewerCountOf(ev) ?? this.viewers;
      }
      if (Date.now() - this.lastStatusWrite > STATUS_EVERY_MS) {
        void this.setStatus({ last_event_at: new Date().toISOString(), room_id: this.roomId, viewer_count: this.viewers, events_ingested: this.events });
      }
    });

    ws.on('error', err => log({ level: 'warn', msg: 'socket error', uid: this.uniqueId, err: err.message }));

    // 'close' always follows 'error' in ws, so all reconnect logic lives here
    ws.on('close', (code: number, reason: Buffer) => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      const p = policyFor(code);
      const why = reason.toString() || undefined;
      if (Date.now() - this.openedAt > STABLE_MS || p.resetAttempts) this.attempts = 0;
      if (p.status === 'offline') { this.roomId = null; this.viewers = null; }
      if (this.stopped || !p.reconnect) {
        log({ level: code === C.INVALID_OPTIONS ? 'error' : 'info', msg: 'closed', uid: this.uniqueId, code, why });
        if (code === C.INVALID_OPTIONS) void this.setStatus({ status: p.status, close_code: code, last_error: why ?? 'Invalid uniqueId', next_retry_at: null, connected_at: null });
        return;
      }
      const delay = backoff(this.attempts++, p.minDelay);
      log({ level: code === C.INVALID_AUTH || code === C.NO_PERMISSION ? 'error' : 'info', msg: 'closed, retrying', uid: this.uniqueId, code, why, delay });
      void this.setStatus({ status: p.status, close_code: code, last_error: why ?? null, connected_at: null, viewer_count: p.status === 'offline' ? null : this.viewers, next_retry_at: new Date(Date.now() + delay).toISOString() });
      this.retryTimer = setTimeout(() => this.connect(), delay);
    });
  }

  /** A new room id means a new LIVE session: live-target totals restart from here. */
  private onRoom(rid: string) {
    this.roomId = rid;
    const patch: Record<string, unknown> = { room_id: rid };
    if (rid !== this.storedRoomId) patch.session_started_at = new Date().toISOString();
    this.storedRoomId = rid;
    void this.setStatus(patch);
  }

  private async setStatus(patch: Record<string, unknown>) {
    this.lastStatusWrite = Date.now();
    if (typeof patch.status === 'string') this.status = patch.status;
    const { error } = await this.db.from('stream_status').upsert({ unique_id: this.uniqueId, updated_at: new Date().toISOString(), status: this.status, ...patch }, { onConflict: 'unique_id' });
    if (error) log({ level: 'warn', msg: 'status write failed', uid: this.uniqueId, err: error.message });
  }
}

export type Desired = Map<string, { agencyIds: string[]; apiKey: string | null }>;

/** Pure: which creators need a socket, which agencies receive their gifts, and whose key opens it. */
export function desiredSockets(
  targets: { agency_id: string; unique_id: string; opponent_unique_id: string | null }[],
  keys: ReadonlyMap<string, string>,
): Desired {
  const out: Desired = new Map();
  for (const t of targets) {
    for (const uid of [t.unique_id, t.opponent_unique_id]) {
      if (!uid) continue;
      const e = out.get(uid) ?? { agencyIds: [], apiKey: null };
      if (!e.agencyIds.includes(t.agency_id)) e.agencyIds.push(t.agency_id);
      out.set(uid, e);
    }
  }
  for (const e of out.values()) {
    e.agencyIds.sort();
    const owner = e.agencyIds.find(a => keys.has(a));
    e.apiKey = owner ? keys.get(owner)! : null;
  }
  return out;
}

class Supervisor {
  private conns = new Map<string, StreamConnection>();
  private reconciling = false;
  private again = false;
  private catalog: GiftCatalog = new Map();

  constructor(private db: SupabaseClient, private gifts: GiftBuffer) {}

  async loadCatalog() {
    const map = new Map<number, { name: string; diamondCount: number; giftType: number | null }>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.db.from('gift_catalog').select('gift_id, name, diamond_count, gift_type').range(from, from + 999);
      if (error) { log({ level: 'warn', msg: 'catalog load failed', err: error.message }); return; }
      for (const g of data ?? []) map.set(g.gift_id, { name: g.name, diamondCount: g.diamond_count, giftType: g.gift_type });
      if (!data || data.length < 1000) break;
    }
    this.catalog = map;
    log({ msg: 'catalog loaded', gifts: map.size });
  }

  /** API keys of agencies with a live Euler connection, decrypted in memory only. */
  private async liveKeys(agencyIds: string[]): Promise<Map<string, string>> {
    const keys = new Map<string, string>();
    if (!agencyIds.length) return keys;
    const { data: conns, error } = await this.db.from('euler_connections').select('agency_id').eq('status', 'connected').in('agency_id', agencyIds);
    if (error) throw error;
    const live = (conns ?? []).map(c => c.agency_id);
    if (!live.length) return keys;
    const { data: creds, error: e2 } = await this.db.from('euler_credentials').select('agency_id, api_key_enc').in('agency_id', live);
    if (e2) throw e2;
    for (const c of creds ?? []) {
      if (!c.api_key_enc) continue;
      try { keys.set(c.agency_id, open(c.api_key_enc, c.agency_id)); }
      catch (e) { log({ level: 'error', msg: 'credential decrypt failed', agency: c.agency_id, err: (e as Error).message }); }
    }
    return keys;
  }

  /** Diff desired set (active tracked_targets + opponents) against open sockets. Safe to call repeatedly. */
  async reconcile() {
    if (this.reconciling) { this.again = true; return; }
    this.reconciling = true;
    try {
      const { data, error } = await this.db.from('tracked_targets').select('agency_id, unique_id, opponent_unique_id').eq('active', true);
      if (error) throw error;
      const rows = data ?? [];
      const want = desiredSockets(rows, await this.liveKeys([...new Set(rows.map(r => r.agency_id))]));

      for (const [uid, c] of this.conns) {
        const w = want.get(uid);
        if (!w || !w.apiKey) { c.stop(w ? 'paused' : 'stopped'); this.conns.delete(uid); log({ msg: w ? 'paused (no live connection)' : 'untracked', uid }); }
      }
      for (const [uid, w] of want) {
        if (!w.apiKey) { if (!this.conns.has(uid)) await this.markPaused(uid); continue; }
        let c = this.conns.get(uid);
        if (!c) {
          if (this.conns.size >= MAX_SOCKETS) { log({ level: 'warn', msg: 'MAX_SOCKETS reached', skipped: uid }); continue; }
          c = new StreamConnection(uid, w.apiKey, this.db, this.gifts, () => this.catalog);
          this.conns.set(uid, c);
          c.agencyIds = w.agencyIds;
          await c.start();
          log({ msg: 'tracked', uid, agencies: w.agencyIds.length });
        } else {
          c.agencyIds = w.agencyIds;
          c.rekey(w.apiKey);
        }
      }
    } catch (e) {
      log({ level: 'error', msg: 'reconcile failed', err: (e as Error).message });
    } finally {
      this.reconciling = false;
      if (this.again) { this.again = false; void this.reconcile(); }
    }
  }

  private async markPaused(uid: string) {
    await this.db.from('stream_status').upsert({ unique_id: uid, status: 'paused', next_retry_at: null, connected_at: null, updated_at: new Date().toISOString() }, { onConflict: 'unique_id' });
  }

  listen() {
    // Realtime gives sub-second pickup when the dashboard upserts or a connection changes; the interval covers missed events.
    const kick = () => void this.reconcile();
    this.db.channel('worker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracked_targets' }, kick)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'euler_connections' }, kick)
      .subscribe(s => log({ msg: 'realtime', status: s }));
    setInterval(kick, RECONCILE_MS);
    setInterval(() => void this.loadCatalog(), CATALOG_MS);
  }

  stopAll() { for (const c of this.conns.values()) c.stop(); }
}

async function main() {
  need('CREDENTIALS_KEY');
  const db = serviceClient();
  const gifts = new GiftBuffer(db);
  const sup = new Supervisor(db, gifts);
  await sup.loadCatalog();
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e); process.exit(1); });
