// Persistent Euler Stream ingestion worker.
// One socket per (agency, creator) pair, where the creator is a tracked target or a battle opponent. Each
// socket authenticates with that agency's own Euler API key and books gifts to that agency only, so one
// customer's key, quota and data never serve another. An agency whose key is missing or rejected is paused;
// agencies over their socket budget, or crowding out others past MAX_SOCKETS, are marked 'capacity'.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import type { SupabaseClient } from '@supabase/supabase-js';
import { planOf } from '@toknomics/shared';
import { createWebSocketUrl, SchemaVersion, ClientCloseCode as C } from '@eulerstream/euler-websocket-sdk';
import { log, redact, serviceClient, need } from './env';
import { open } from './crypto';
import { parseFrame, giftToRows, isGift, isViewerCount, roomIdOf, viewerCountOf, type GiftCatalog } from './euler';
import { GiftBuffer } from './sink';
import { workerState } from './health';

const MAX_SOCKETS = Number(process.env.MAX_SOCKETS?.trim() || 200);
/** Sockets one agency may hold: its roster limit, doubled to leave room for battle opponents. */
export const socketBudget = (plan: string) => planOf(plan).limit * 2;
/** A stuck Supabase call must not wedge the reconcile loop. */
const DB_TIMEOUT_MS = 20_000;
const WORKER_ID = `${process.env.RAILWAY_DEPLOYMENT_ID ?? 'local'}:${process.pid}:${randomUUID().slice(0, 8)}`;
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

export type StreamHooks = {
  /** Euler closed with 4401: the agency's key is no longer accepted. */
  onInvalidKey?: (agencyId: string) => void;
};

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

  constructor(
    readonly agencyId: string, readonly uniqueId: string, public apiKey: string,
    private db: SupabaseClient, private gifts: GiftBuffer, private catalog: () => GiftCatalog, private hooks: StreamHooks = {},
  ) {}

  async start() {
    this.stopped = false;
    const { data } = await this.db.from('stream_status').select('room_id, events_ingested')
      .eq('agency_id', this.agencyId).eq('unique_id', this.uniqueId).maybeSingle();
    this.storedRoomId = data?.room_id ?? null;
    this.events = Number(data?.events_ingested ?? 0);
    this.connect();
  }

  stop(status: 'stopped' | 'paused' | 'capacity' = 'stopped') {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.ws?.close(1000, 'untracked');
    // Guarded by worker_id: during a redeploy the old process stops after the new one has taken over, and must not overwrite its rows.
    void this.setStatus({ status, next_retry_at: null, connected_at: null, viewer_count: null }, true);
  }

  /** Swaps the key (e.g. the agency pasted a new one) by reconnecting with it. */
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
    log({ msg: 'connect', agency: this.agencyId, uid: this.uniqueId, attempt: this.attempts, url: redact(url) });
    void this.setStatus({ status: 'connecting', next_retry_at: null });

    const ws = new WebSocket(url, { handshakeTimeout: 15_000 });
    this.ws = ws;

    ws.on('open', () => {
      this.openedAt = this.lastSeen = Date.now();
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (Date.now() - this.lastSeen > STALE_MS) { log({ msg: 'stale socket, terminating', agency: this.agencyId, uid: this.uniqueId }); ws.terminate(); return; }
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
        if (isGift(ev)) this.gifts.push(giftToRows(ev, { creatorUniqueId: this.uniqueId, roomId: this.roomId, agencyIds: [this.agencyId], catalog: this.catalog() }));
        else if (isViewerCount(ev)) this.viewers = viewerCountOf(ev) ?? this.viewers;
      }
      if (Date.now() - this.lastStatusWrite > STATUS_EVERY_MS) {
        void this.setStatus({ last_event_at: new Date().toISOString(), room_id: this.roomId, viewer_count: this.viewers, events_ingested: this.events });
      }
    });

    ws.on('error', err => log({ level: 'warn', msg: 'socket error', agency: this.agencyId, uid: this.uniqueId, err: err.message }));

    // 'close' always follows 'error' in ws, so all reconnect logic lives here
    ws.on('close', (code: number, reason: Buffer) => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      const p = policyFor(code);
      const why = reason.toString() || undefined;
      if (Date.now() - this.openedAt > STABLE_MS || p.resetAttempts) this.attempts = 0;
      if (p.status === 'offline') { this.roomId = null; this.viewers = null; }
      if (this.stopped || !p.reconnect) {
        log({ level: code === C.INVALID_OPTIONS ? 'error' : 'info', msg: 'closed', agency: this.agencyId, uid: this.uniqueId, code, why });
        if (code === C.INVALID_OPTIONS) void this.setStatus({ status: p.status, close_code: code, last_error: why ?? 'Invalid uniqueId', next_retry_at: null, connected_at: null });
        return;
      }
      const delay = backoff(this.attempts++, p.minDelay);
      log({ level: code === C.INVALID_AUTH || code === C.NO_PERMISSION ? 'error' : 'info', msg: 'closed, retrying', agency: this.agencyId, uid: this.uniqueId, code, why, delay });
      void this.setStatus({ status: p.status, close_code: code, last_error: why ?? null, connected_at: null, viewer_count: p.status === 'offline' ? null : this.viewers, next_retry_at: new Date(Date.now() + delay).toISOString() });
      if (code === C.INVALID_AUTH) this.hooks.onInvalidKey?.(this.agencyId);
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

  private async setStatus(patch: Record<string, unknown>, onlyIfOwner = false) {
    this.lastStatusWrite = Date.now();
    if (typeof patch.status === 'string') this.status = patch.status;
    const now = new Date().toISOString();
    const { error } = onlyIfOwner
      ? await this.db.from('stream_status').update({ updated_at: now, status: this.status, ...patch })
          .eq('agency_id', this.agencyId).eq('unique_id', this.uniqueId).eq('worker_id', WORKER_ID)
      : await this.db.from('stream_status').upsert({ agency_id: this.agencyId, unique_id: this.uniqueId, worker_id: WORKER_ID, updated_at: now, status: this.status, ...patch }, { onConflict: 'agency_id,unique_id' });
    if (error) log({ level: 'warn', msg: 'status write failed', agency: this.agencyId, uid: this.uniqueId, err: error.message });
  }
}

export type Target = { agency_id: string; unique_id: string; opponent_unique_id: string | null };
export type Slot = { agencyId: string; uid: string; apiKey: string };
export type SocketPlan = {
  run: Map<string, Slot>;
  /** Wanted but the agency has no accepted Euler key. */
  paused: { agencyId: string; uid: string }[];
  /** Wanted and keyed, but over the agency's budget or squeezed out by MAX_SOCKETS. */
  capacity: { agencyId: string; uid: string }[];
};
export const slotKey = (agencyId: string, uid: string) => `${agencyId}:${uid}`;

/**
 * Pure: which (agency, creator) sockets run. A tracked target and its battle opponent form one unit, and a unit is
 * admitted whole or not at all: keeping only one side would show a live battle with the other side's gifts missing.
 * An agency is capped at its budget; if the total still exceeds `max`, units are handed out round-robin across
 * agencies so a big agency can't starve a small one. Units with a socket already open go first inside an agency,
 * which keeps a stable set instead of churning on every reconcile.
 */
export function planSockets(
  targets: readonly Target[],
  keys: ReadonlyMap<string, string>,
  budgets: ReadonlyMap<string, number>,
  max: number,
  open: ReadonlySet<string> = new Set(),
): SocketPlan {
  const unitsOf = new Map<string, Map<string, string[]>>();
  for (const t of targets) {
    const unit = [...new Set([t.unique_id, ...(t.opponent_unique_id ? [t.opponent_unique_id] : [])])];
    const m = unitsOf.get(t.agency_id) ?? new Map<string, string[]>();
    m.set(unit.join('|'), unit);
    unitsOf.set(t.agency_id, m);
  }
  const plan: SocketPlan = { run: new Map(), paused: [], capacity: [] };
  const spill: { agencyId: string; uid: string }[] = [];
  const queues: { agencyId: string; apiKey: string; groups: string[][] }[] = [];

  for (const agencyId of [...unitsOf.keys()].sort()) {
    const units = [...unitsOf.get(agencyId)!.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, u]) => u);
    const apiKey = keys.get(agencyId);
    if (!apiKey) {
      for (const uid of new Set(units.flat())) plan.paused.push({ agencyId, uid });
      continue;
    }
    const isOpen = (u: string[]) => u.some(uid => open.has(slotKey(agencyId, uid)));
    const ordered = [...units.filter(isOpen), ...units.filter(u => !isOpen(u))];
    const budget = budgets.get(agencyId) ?? Infinity;
    const admitted = new Set<string>();
    const groups: string[][] = [];
    for (const unit of ordered) {
      const fresh = unit.filter(uid => !admitted.has(uid));
      if (admitted.size + fresh.length <= budget) { fresh.forEach(uid => admitted.add(uid)); if (fresh.length) groups.push(fresh); }
      else for (const uid of fresh) spill.push({ agencyId, uid });
    }
    queues.push({ agencyId, apiKey, groups });
  }

  let used = 0;
  for (let round = 0; ; round++) {
    let more = false;
    for (const q of queues) {
      const group = q.groups[round];
      if (!group) continue;
      more = true;
      if (used + group.length > max) { for (const uid of group) spill.push({ agencyId: q.agencyId, uid }); continue; }
      for (const uid of group) plan.run.set(slotKey(q.agencyId, uid), { agencyId: q.agencyId, uid, apiKey: q.apiKey });
      used += group.length;
    }
    if (!more) break;
  }
  // A creator can sit in an admitted unit and a rejected one (a shared opponent): it runs, so it is not over capacity.
  const seen = new Set<string>();
  for (const x of spill) {
    const k = slotKey(x.agencyId, x.uid);
    if (plan.run.has(k) || seen.has(k)) continue;
    seen.add(k);
    plan.capacity.push(x);
  }
  return plan;
}

const withTimeout = <T>(p: PromiseLike<T>, what: string, ms = DB_TIMEOUT_MS): Promise<T> =>
  Promise.race([Promise.resolve(p), new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms}ms`)), ms).unref())]);

class Supervisor {
  private conns = new Map<string, StreamConnection>();
  /** Last status written for wanted slots that have no socket (paused / capacity), so we write on change only. */
  private idle = new Map<string, string>();
  private reconciling = false;
  private again = false;
  private catalog: GiftCatalog = new Map();
  private capacityAlerted = false;

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

  /** All active targets, paged: PostgREST caps a response at 1000 rows. */
  private async loadTargets(): Promise<Target[]> {
    const out: Target[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await withTimeout(
        this.db.from('tracked_targets').select('agency_id, unique_id, opponent_unique_id').eq('active', true).order('id').range(from, from + 999), 'load targets');
      if (error) throw error;
      out.push(...(data ?? []));
      if (!data || data.length < 1000) return out;
    }
  }

  /** API keys of agencies whose key Euler accepted, decrypted in memory only. */
  private async validKeys(agencyIds: string[]): Promise<Map<string, string>> {
    const keys = new Map<string, string>();
    if (!agencyIds.length) return keys;
    const { data: conns, error } = await withTimeout(this.db.from('euler_connections').select('agency_id').eq('key_status', 'valid').in('agency_id', agencyIds), 'load connections');
    if (error) throw error;
    const valid = (conns ?? []).map(c => c.agency_id);
    if (!valid.length) return keys;
    const { data: creds, error: e2 } = await withTimeout(this.db.from('euler_credentials').select('agency_id, api_key_enc').in('agency_id', valid), 'load credentials');
    if (e2) throw e2;
    for (const c of creds ?? []) {
      if (!c.api_key_enc) continue;
      try { keys.set(c.agency_id, open(c.api_key_enc, c.agency_id)); }
      catch (e) { log({ level: 'error', msg: 'credential decrypt failed', agency: c.agency_id, err: (e as Error).message }); }
    }
    return keys;
  }

  private async budgets(agencyIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!agencyIds.length) return out;
    const { data, error } = await withTimeout(this.db.from('agencies').select('id, plan').in('id', agencyIds), 'load plans');
    if (error) throw error;
    for (const a of data ?? []) out.set(a.id, socketBudget(a.plan));
    return out;
  }

  /** Diff the desired (agency, creator) sockets against the open ones. Safe to call repeatedly. */
  async reconcile() {
    if (this.reconciling) { this.again = true; return; }
    this.reconciling = true;
    try {
      const rows = await this.loadTargets();
      const agencyIds = [...new Set(rows.map(r => r.agency_id))];
      const [keys, budgets] = await Promise.all([this.validKeys(agencyIds), this.budgets(agencyIds)]);
      const plan = planSockets(rows, keys, budgets, MAX_SOCKETS, new Set(this.conns.keys()));

      for (const [k, c] of this.conns) {
        if (plan.run.has(k)) continue;
        const reason = plan.paused.some(p => slotKey(p.agencyId, p.uid) === k) ? 'paused' : plan.capacity.some(p => slotKey(p.agencyId, p.uid) === k) ? 'capacity' : 'stopped';
        c.stop(reason); this.conns.delete(k);
        log({ msg: reason === 'stopped' ? 'untracked' : reason, agency: c.agencyId, uid: c.uniqueId });
      }
      for (const [k, slot] of plan.run) {
        this.idle.delete(k);
        const existing = this.conns.get(k);
        if (existing) { existing.rekey(slot.apiKey); continue; }
        const c = new StreamConnection(slot.agencyId, slot.uid, slot.apiKey, this.db, this.gifts, () => this.catalog, { onInvalidKey: a => void this.markKeyInvalid(a) });
        this.conns.set(k, c);
        await withTimeout(c.start(), 'start socket');
        log({ msg: 'tracked', agency: slot.agencyId, uid: slot.uid });
      }
      await this.markIdle(plan.paused, 'paused');
      await this.markIdle(plan.capacity, 'capacity');

      workerState.sockets = this.conns.size;
      workerState.maxSockets = MAX_SOCKETS;
      workerState.lastReconcileAt = Date.now();
      const pct = this.conns.size / MAX_SOCKETS;
      if (pct >= 0.8 && !this.capacityAlerted) { this.capacityAlerted = true; log({ level: 'error', msg: 'socket capacity at 80%', sockets: this.conns.size, max: MAX_SOCKETS }); }
      else if (pct < 0.7) this.capacityAlerted = false;
      if (plan.capacity.length) log({ level: 'warn', msg: 'targets over capacity', count: plan.capacity.length });
    } catch (e) {
      log({ level: 'error', msg: 'reconcile failed', err: (e as Error).message });
    } finally {
      this.reconciling = false;
      if (this.again) { this.again = false; void this.reconcile(); }
    }
  }

  /** Writes a status for wanted slots that have no socket, once per change. */
  private async markIdle(slots: { agencyId: string; uid: string }[], status: 'paused' | 'capacity') {
    const rows = slots.filter(s => this.idle.get(slotKey(s.agencyId, s.uid)) !== status);
    if (!rows.length) return;
    const now = new Date().toISOString();
    const { error } = await this.db.from('stream_status').upsert(
      rows.map(s => ({ agency_id: s.agencyId, unique_id: s.uid, status, worker_id: WORKER_ID, next_retry_at: null, connected_at: null, viewer_count: null, updated_at: now })),
      { onConflict: 'agency_id,unique_id' });
    if (error) { log({ level: 'warn', msg: 'idle status write failed', status, err: error.message }); return; }
    for (const s of rows) this.idle.set(slotKey(s.agencyId, s.uid), status);
  }

  /** Euler rejected the agency's key: record it so the dashboard says so and ingestion stops until a new key is saved. */
  private async markKeyInvalid(agencyId: string) {
    const { error } = await this.db.from('euler_connections').update({ key_status: 'invalid', updated_at: new Date().toISOString() }).eq('agency_id', agencyId).eq('key_status', 'valid');
    if (error) log({ level: 'warn', msg: 'could not flag invalid key', agency: agencyId, err: error.message });
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

export async function main() {
  need('CREDENTIALS_KEY');
  workerState.expected = true;
  const db = serviceClient();
  const gifts = new GiftBuffer(db);
  const sup = new Supervisor(db, gifts);

  // Registered before the first await so a SIGTERM during boot (e.g. a redeploy) still flushes buffered gifts.
  let stopping = false;
  const shutdown = async (sig: string) => {
    if (stopping) return;
    stopping = true;
    log({ msg: 'shutdown', sig });
    sup.stopAll();
    await gifts.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await sup.loadCatalog();
  await sup.reconcile();
  sup.listen();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e); process.exit(1); });
