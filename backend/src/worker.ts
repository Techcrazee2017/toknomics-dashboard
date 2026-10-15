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

const withTimeout = <T>(p: PromiseLike<T>, what: string, ms = DB_TIMEOUT_MS): Promise<T> =>
  Promise.race([Promise.resolve(p), new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms}ms`)), ms).unref())]);

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

  /**
   * Claims the status row, restores the stored room and event count, then opens the socket. The lookup is best-effort:
   * if it fails or hangs the socket still opens with defaults (worst case the live-session clock restarts), so a slow
   * database never leaves a tracked creator without a socket. stop() during the lookup is honoured by connect().
   */
  async start() {
    this.stopped = false;
    try {
      const { data } = await withTimeout(this.db.from('stream_status').select('room_id, events_ingested')
        .eq('agency_id', this.agencyId).eq('unique_id', this.uniqueId).maybeSingle(), 'load stream status');
      this.storedRoomId = data?.room_id ?? null;
      this.events = Number(data?.events_ingested ?? 0);
    } catch (e) {
      log({ level: 'warn', msg: 'stream status lookup failed, connecting with defaults', agency: this.agencyId, uid: this.uniqueId, err: (e as Error).message });
    }
    // The newest process to start a socket owns the row. Every later write is fenced on worker_id, so during a rolling
    // deploy the old process can no longer touch what the new one now reports.
    // Bounded like the lookup above: a hung write must not keep the socket from opening or stall the supervisor.
    try { await withTimeout(this.setStatus({ status: 'connecting', next_retry_at: null }, 'claim'), 'claim stream status'); }
    catch (e) { log({ level: 'warn', msg: 'status claim failed, connecting anyway', agency: this.agencyId, uid: this.uniqueId, err: (e as Error).message }); }
    this.connect();
  }

  stop(status: 'stopped' | 'paused' | 'capacity' = 'stopped') {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.ws?.close(1000, 'untracked');
    void this.setStatus({ status, next_retry_at: null, connected_at: null, viewer_count: null });
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

  /**
   * claim: take ownership (upsert). Otherwise the write only lands while this process still owns the row; if the row
   * does not exist yet it is created without taking anything from another owner.
   */
  private async setStatus(patch: Record<string, unknown>, mode: 'claim' | 'owned' = 'owned') {
    this.lastStatusWrite = Date.now();
    if (typeof patch.status === 'string') this.status = patch.status;
    const now = new Date().toISOString();
    const row = { updated_at: now, status: this.status, ...patch };
    const key = { agency_id: this.agencyId, unique_id: this.uniqueId };
    let error: { message: string } | null = null;
    if (mode === 'claim') {
      ({ error } = await this.db.from('stream_status').upsert({ ...key, worker_id: WORKER_ID, ...row }, { onConflict: 'agency_id,unique_id' }));
    } else {
      const upd = await this.db.from('stream_status').update(row).eq('agency_id', this.agencyId).eq('unique_id', this.uniqueId).eq('worker_id', WORKER_ID).select('unique_id');
      error = upd.error;
      // Nothing matched: either the row is missing (create it) or another process owns it (leave it alone).
      if (!error && !upd.data?.length) ({ error } = await this.db.from('stream_status').upsert({ ...key, worker_id: WORKER_ID, ...row }, { onConflict: 'agency_id,unique_id', ignoreDuplicates: true }));
    }
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

/** Union-find over creators that appear together in a target/opponent pair. Each group is sorted; groups are sorted. */
function connectedGroups(pairs: readonly [string, string | null][]): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    for (let c = x; c !== r;) { const n = parent.get(c)!; parent.set(c, r); c = n; }
    return r;
  };
  for (const [a, b] of pairs) {
    for (const u of [a, b]) if (u && !parent.has(u)) parent.set(u, u);
    if (b) parent.set(find(a), find(b));
  }
  const groups = new Map<string, string[]>();
  for (const u of parent.keys()) { const r = find(u); (groups.get(r) ?? groups.set(r, []).get(r)!).push(u); }
  return [...groups.values()].map(g => g.sort()).sort((x, y) => (x[0]! < y[0]! ? -1 : x[0]! > y[0]! ? 1 : 0));
}

/**
 * Pure: which (agency, creator) sockets run. Battles that share a creator (A vs B, and B vs C) form one connected
 * group, and a group is admitted whole or not at all: keeping part of it would show a live battle with the other
 * side's gifts missing. An agency is capped at its budget; if the total still exceeds `max`, groups are handed
 * out round-robin across agencies so a big agency can't starve a small one. Groups with a socket already open go
 * first inside an agency, which keeps a stable set instead of churning on every reconcile.
 */
export function planSockets(
  targets: readonly Target[],
  keys: ReadonlyMap<string, string>,
  budgets: ReadonlyMap<string, number>,
  max: number,
  open: ReadonlySet<string> = new Set(),
): SocketPlan {
  const pairs = new Map<string, [string, string | null][]>();
  for (const t of targets) {
    const list = pairs.get(t.agency_id) ?? [];
    list.push([t.unique_id, t.opponent_unique_id]);
    pairs.set(t.agency_id, list);
  }
  const plan: SocketPlan = { run: new Map(), paused: [], capacity: [] };
  const spill: { agencyId: string; uid: string }[] = [];
  const queues: { agencyId: string; apiKey: string; groups: string[][] }[] = [];

  for (const agencyId of [...pairs.keys()].sort()) {
    const groups = connectedGroups(pairs.get(agencyId)!);
    const apiKey = keys.get(agencyId);
    if (!apiKey) {
      for (const uid of groups.flat()) plan.paused.push({ agencyId, uid });
      continue;
    }
    const isOpen = (g: string[]) => g.some(uid => open.has(slotKey(agencyId, uid)));
    const ordered = [...groups.filter(isOpen), ...groups.filter(g => !isOpen(g))];
    const budget = budgets.get(agencyId) ?? Infinity;
    let admitted = 0;
    const admittedGroups: string[][] = [];
    for (const g of ordered) {
      if (admitted + g.length <= budget) { admitted += g.length; admittedGroups.push(g); }
      else for (const uid of g) spill.push({ agencyId, uid });
    }
    queues.push({ agencyId, apiKey, groups: admittedGroups });
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
        try { await c.start(); }
        catch (e) {
          // start() handles its own lookup failures; anything else must not leave a socketless entry that counts against capacity.
          c.stop(); this.conns.delete(k);
          log({ level: 'error', msg: 'could not start socket', agency: slot.agencyId, uid: slot.uid, err: (e as Error).message });
          continue;
        }
        log({ msg: 'tracked', agency: slot.agencyId, uid: slot.uid });
      }
      await this.markIdle(plan.paused, 'paused');
      await this.markIdle(plan.capacity, 'capacity');  // each write is bounded by withTimeout, so a hung database can't wedge the loop

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
    const { error } = await withTimeout(this.db.from('stream_status').upsert(
      rows.map(s => ({ agency_id: s.agencyId, unique_id: s.uid, status, worker_id: WORKER_ID, next_retry_at: null, connected_at: null, viewer_count: null, updated_at: now })),
      { onConflict: 'agency_id,unique_id' }), 'write idle status');
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
