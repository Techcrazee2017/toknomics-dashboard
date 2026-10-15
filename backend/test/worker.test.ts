import { describe, expect, it, vi } from 'vitest';
import { backoff, planSockets, policyFor, slotKey, socketBudget, socketUrl, type Target } from '../src/worker';

describe('policyFor', () => {
  it('maps Euler close codes', () => {
    expect(policyFor(1000)).toMatchObject({ reconnect: false, status: 'stopped' });
    expect(policyFor(4400)).toMatchObject({ reconnect: false, status: 'invalid' });
    expect(policyFor(4404)).toMatchObject({ reconnect: true, minDelay: 60_000, status: 'offline' });
    expect(policyFor(4555)).toMatchObject({ reconnect: true, resetAttempts: true });
    expect(policyFor(4429).minDelay).toBe(30_000);
    expect(policyFor(4401).status).toBe('auth_error');
    expect(policyFor(1006)).toMatchObject({ reconnect: true, minDelay: 1_000 });
  });
});

describe('backoff', () => {
  it('respects floors and caps', () => {
    expect(backoff(0, 1_000, () => 0)).toBe(1_000);
    expect(backoff(20, 1_000, () => 1)).toBe(30_000);
    expect(backoff(20, 60_000, () => 1)).toBe(300_000);
    expect(backoff(3, 60_000, () => 0)).toBe(60_000);
  });
});

describe('planSockets', () => {
  const t = (agency_id: string, unique_id: string, opponent_unique_id: string | null = null): Target => ({ agency_id, unique_id, opponent_unique_id });
  const keys = new Map([['a', 'KA'], ['b', 'KB']]);
  const run = (p: ReturnType<typeof planSockets>) => [...p.run.keys()].sort();

  it('opens one socket per (agency, creator), with that agency\'s own key', () => {
    const p = planSockets([t('b', 'nova_shift', 'lumen.rise'), t('a', 'nova_shift'), t('c', 'kairo.dev')], keys, new Map(), 100);
    expect(run(p)).toEqual(['a:nova_shift', 'b:lumen.rise', 'b:nova_shift']);
    // Both agencies track nova_shift; each socket uses its own agency's key, never the other's.
    expect(p.run.get('a:nova_shift')?.apiKey).toBe('KA');
    expect(p.run.get('b:nova_shift')?.apiKey).toBe('KB');
    expect(p.run.get('b:lumen.rise')?.apiKey).toBe('KB');
  });

  it('pauses an agency with no accepted key without touching the others', () => {
    const p = planSockets([t('a', 'x'), t('c', 'kairo.dev')], keys, new Map(), 100);
    expect(run(p)).toEqual(['a:x']);
    expect(p.paused).toEqual([{ agencyId: 'c', uid: 'kairo.dev' }]);
  });

  it('dedupes a creator that is both a target and an opponent of the same agency', () => {
    expect(run(planSockets([t('a', 'x', 'y'), t('a', 'y')], keys, new Map(), 100))).toEqual(['a:x', 'a:y']);
  });

  it('caps an agency at its budget and reports the rest as capacity', () => {
    const p = planSockets([t('a', 'c1'), t('a', 'c2'), t('a', 'c3')], keys, new Map([['a', 2]]), 100);
    expect(run(p)).toEqual(['a:c1', 'a:c2']);
    expect(p.capacity).toEqual([{ agencyId: 'a', uid: 'c3' }]);
  });

  it('shares MAX_SOCKETS round-robin so a large agency cannot starve a small one', () => {
    const big = Array.from({ length: 10 }, (_, i) => t('a', `a${String(i).padStart(2, '0')}`));
    const p = planSockets([...big, t('b', 'b00'), t('b', 'b01')], keys, new Map(), 6);
    expect(p.run.size).toBe(6);
    expect([...p.run.values()].filter(s => s.agencyId === 'b').length).toBe(2);
    expect([...p.run.values()].filter(s => s.agencyId === 'a').length).toBe(4);
    expect(p.capacity.length).toBe(6);
    expect(new Set([...run(p), ...p.capacity.map(c => slotKey(c.agencyId, c.uid))]).size).toBe(12);
  });

  it('keeps sockets that are already open when the cap bites', () => {
    const targets = ['c1', 'c2', 'c3'].map(u => t('a', u));
    const p = planSockets(targets, keys, new Map([['a', 2]]), 100, new Set([slotKey('a', 'c3')]));
    expect(run(p)).toEqual(['a:c1', 'a:c3'].sort());
  });

  it('keeps a battle target and its opponent together when an agency hits its budget', () => {
    // Budget 3: c1 (1 socket) and the battle c2+opp (2 sockets) fit; the next battle c3+opp3 needs 2 more and is dropped whole.
    const targets = [t('a', 'c1'), t('a', 'c2', 'opp2'), t('a', 'c3', 'opp3')];
    const p = planSockets(targets, keys, new Map([['a', 3]]), 100);
    expect(run(p)).toEqual(['a:c1', 'a:c2', 'a:opp2']);
    expect(p.capacity.map(c => c.uid).sort()).toEqual(['c3', 'opp3']);
  });

  it('keeps a battle together at the global cap, never splitting the pair', () => {
    const p = planSockets([t('a', 'c1', 'o1'), t('a', 'c2', 'o2'), t('b', 'x')], keys, new Map(), 4);
    // Round 1: a gets c1+o1 (2), b gets x (1) = 3. Round 2: a's c2+o2 needs 2 more, only 1 left: neither runs.
    expect(run(p)).toEqual(['a:c1', 'a:o1', 'b:x']);
    expect(p.capacity.map(c => c.uid).sort()).toEqual(['c2', 'o2']);
    for (const [k] of p.run) expect(k.startsWith('a:') ? ['a:c1', 'a:o1'].includes(k) : true).toBe(true);
  });

  it('treats battles that share a creator as one group: A-B and B-C are admitted together or not at all', () => {
    const targets = [t('a', 'A', 'B'), t('a', 'B', 'C')];
    // Room for only two sockets: the old pairwise check kept A+B and dropped C while B still ran, so B-C looked live with C's gifts missing.
    const tight = planSockets(targets, keys, new Map([['a', 2]]), 100);
    expect(run(tight)).toEqual([]);
    expect(tight.capacity.map(c => c.uid).sort()).toEqual(['A', 'B', 'C']);
    expect(run(planSockets(targets, keys, new Map([['a', 3]]), 100))).toEqual(['a:A', 'a:B', 'a:C']);
    // The same at the global cap.
    expect(run(planSockets(targets, keys, new Map(), 2))).toEqual([]);
  });

  it('keeps a group that shares an opponent whole, and still lets unrelated battles run', () => {
    const targets = [t('a', 'c1', 'shared'), t('a', 'c2', 'shared'), t('a', 'solo')];
    const p = planSockets(targets, keys, new Map([['a', 2]]), 100);
    expect(run(p)).toEqual(['a:solo']);
    expect(p.capacity.map(c => c.uid).sort()).toEqual(['c1', 'c2', 'shared']);
  });

  it('guarantees each agency a fair share of sockets, so one large connected group cannot starve a small tenant', () => {
    // Agency a: six creators sharing one opponent = a single 7-socket group. Agency b: two singles. Cap 8, fair share 4.
    const big = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(c => t('a', c, 'shared'));
    const p = planSockets([...big, t('b', 'b1'), t('b', 'b2')], keys, new Map(), 8);
    // Whole-group round-robin would admit a's group (7 of 8) first and push b to capacity.
    expect(run(p).filter(k => k.startsWith('b:'))).toEqual(['b:b1', 'b:b2']);
    expect(run(p).filter(k => k.startsWith('a:'))).toEqual([]);   // 7 > what is left (6): over capacity, whole
    expect(p.capacity.filter(c => c.agencyId === 'a')).toHaveLength(7);
  });

  it('still admits a large group from the spare sockets once everyone has their share', () => {
    const big = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(c => t('a', c, 'shared'));
    const p = planSockets([...big, t('b', 'b1')], keys, new Map(), 12);
    expect(p.run.size).toBe(8);                                   // a's 7-socket group + b1, all fit
    expect(p.capacity).toEqual([]);
  });

  it('admits every group that fits from the spare sockets, in order, without skipping any', () => {
    // Three agencies, cap 10. a has three two-socket battles; b and c have one socket each. Fair share is 3.
    const targets = [t('a', 'c1', 'o1'), t('a', 'c2', 'o2'), t('a', 'c3', 'o3'), t('b', 'b1'), t('c', 'c9')];
    const k3 = new Map([['a', 'KA'], ['b', 'KB'], ['c', 'KC']]);
    const p = planSockets(targets, k3, new Map(), 10);
    // 2 + 1 + 1 in the guaranteed pass, then a's remaining two battles from the 6 spare sockets: 8 of 10 used, nothing over capacity.
    expect(p.run.size).toBe(8);
    expect(p.capacity).toEqual([]);
  });

  it('derives the per-agency budget from the plan roster limit', () => {
    expect(socketBudget('starter')).toBe(20);
    expect(socketBudget('scale')).toBe(300);
  });
});

describe('socketUrl', () => {
  it('builds the SDK URL with v2 schema, bundling and the key', () => {
    const u = new URL(socketUrl('nova_shift', 'k123'));
    expect(u.searchParams.get('uniqueId')).toBe('nova_shift');
    expect(u.searchParams.get('apiKey')).toBe('k123');
    expect(u.searchParams.get('features.schemaVersion')).toBe('v2');
    expect(u.searchParams.get('features.bundleEvents')).toBe('true');
  });
});

/** A fake db for StreamConnection: records upserts to stream_status; `select` answers the start-up lookup. */
function connDb(opts: { stored?: Record<string, unknown> | null; hangLookup?: boolean } = {}) {
  const upserts: { row: Record<string, unknown>; opts: Record<string, unknown> }[] = [];
  const db = { from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => (opts.hangLookup ? new Promise(() => {}) : Promise.resolve({ data: opts.stored ?? null })) }) }) }),
    upsert: async (row: Record<string, unknown>, o: Record<string, unknown>) => { upserts.push({ row, opts: o }); return { error: null }; },
  }) };
  return { db: db as never, upserts };
}
const setStatusOf = (c: unknown) => (c as { setStatus: (p: Record<string, unknown>) => Promise<boolean> }).setStatus.bind(c);
const noConnect = (c: unknown) => vi.spyOn(c as { connect: () => void }, 'connect').mockImplementation(() => {});

describe('StreamConnection status writes', () => {
  it('upserts this socket\'s row and always includes status, so partial writes pass stream_status.status NOT NULL', async () => {
    const { StreamConnection } = await import('../src/worker');
    const { db, upserts } = connDb();
    const set = setStatusOf(new StreamConnection('agency-1', 'nova_shift', 'k', db, {} as never, () => new Map()));
    await set({ status: 'live' });
    await set({ room_id: '7400', viewer_count: 12 });
    expect(upserts[0]!.opts).toEqual({ onConflict: 'agency_id,unique_id' });
    expect(upserts[1]!.row).toMatchObject({ agency_id: 'agency-1', unique_id: 'nova_shift', status: 'live', room_id: '7400', viewer_count: 12 });
  });

  it('reports a failed write instead of throwing', async () => {
    const { StreamConnection } = await import('../src/worker');
    const db = { from: () => ({ upsert: async () => ({ error: { message: 'down' } }) }) };
    expect(await setStatusOf(new StreamConnection('agency-1', 'nova_shift', 'k', db as never, {} as never, () => new Map()))({ status: 'live' })).toBe(false);
  });
});

describe('StreamConnection.start', () => {
  it('still opens the socket when the status lookup hangs', async () => {
    vi.useFakeTimers();
    try {
      const { StreamConnection } = await import('../src/worker');
      const c = new StreamConnection('agency-1', 'nova_shift', 'k', connDb({ hangLookup: true }).db, {} as never, () => new Map());
      const connect = noConnect(c);
      const started = c.start();
      await vi.advanceTimersByTimeAsync(20_001);
      await started;
      expect(connect).toHaveBeenCalledTimes(1);
      c.stop();
    } finally { vi.useRealTimers(); }
  });

  it('does not connect if it was stopped while the lookup was pending', async () => {
    const { StreamConnection } = await import('../src/worker');
    let release!: (v: unknown) => void;
    const base = connDb().db as unknown as { from: () => Record<string, unknown> };
    const slow = { from: () => ({ ...base.from(), select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => new Promise(r => { release = r; }) }) }) }) }) };
    const c = new StreamConnection('agency-1', 'nova_shift', 'k', slow as never, {} as never, () => new Map());
    const connect = vi.spyOn(c as unknown as { connect: () => void }, 'connect');
    const started = c.start();
    c.stop();
    release({ data: null });
    await started;
    expect(connect).not.toHaveBeenCalled();
    expect((c as unknown as { ws?: unknown }).ws).toBeUndefined();
  });
});

describe('StreamConnection heartbeat', () => {
  it('rewrites its status on an interval, so a wrong label corrects itself, and stops when stopped', async () => {
    vi.useFakeTimers();
    try {
      const { StreamConnection } = await import('../src/worker');
      const { db, upserts } = connDb({ stored: { room_id: '7400', events_ingested: 5 } });
      const c = new StreamConnection('agency-1', 'nova_shift', 'k', db, {} as never, () => new Map());
      noConnect(c);
      await c.start();
      (c as unknown as { connectedAt: string }).connectedAt = '2026-10-15T20:00:00.000Z';   // what the socket's open handler records
      await setStatusOf(c)({ status: 'live', connected_at: '2026-10-15T20:00:00.000Z' });
      const before = upserts.length;
      // Something else (an old process, a stale request) overwrote the row; the next heartbeat puts this socket's truth back.
      await vi.advanceTimersByTimeAsync(30_001);
      expect(upserts.length).toBe(before + 1);
      expect(upserts.at(-1)!.row).toMatchObject({ agency_id: 'agency-1', unique_id: 'nova_shift', status: 'live', events_ingested: 5, connected_at: '2026-10-15T20:00:00.000Z' });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(upserts.length).toBe(before + 2);
      c.stop();
      const stopped = upserts.length;
      await vi.advanceTimersByTimeAsync(120_000);
      expect(upserts.length).toBe(stopped);                 // no heartbeat after stop (stop itself wrote once, counted above)
    } finally { vi.useRealTimers(); }
  });
});

describe('Supervisor', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

  it('looks agencies up in bounded chunks, so none is dropped past the row cap or the URL limit', async () => {
    const { Supervisor } = await import('../src/worker');
    const all = ids(250), seen: number[] = [];
    const db = { from: (table: string) => ({ select: () => ({
      eq: () => ({ in: (_c: string, v: string[]) => { seen.push(v.length); return Promise.resolve({ data: v.map(id => ({ agency_id: id })), error: null }); } }),
      in: (_c: string, v: string[]) => { seen.push(v.length); return Promise.resolve({ data: table === 'agencies' ? v.map(id => ({ id, plan: 'starter' })) : [], error: null }); },
    }) }) };
    const sup = new Supervisor(db as never, {} as never) as unknown as { budgets: (a: string[]) => Promise<Map<string, number>>; validKeys: (a: string[]) => Promise<Map<string, string>> };
    const budgets = await sup.budgets(all);
    expect(budgets.size).toBe(250);                  // every agency got its plan, none defaulted to unlimited
    await sup.validKeys(all);
    expect(Math.max(...seen)).toBeLessThanOrEqual(100);
    expect(seen.length).toBeGreaterThan(2);
  });

  it('only invalidates a key if the rejected key is still the stored one', async () => {
    const { Supervisor } = await import('../src/worker');
    const filters: [string, unknown][] = [];
    const q: any = { eq: (k: string, v: unknown) => { filters.push([k, v]); return q; }, then: (r: (v: unknown) => void) => r({ error: null }) };
    const db = { from: () => ({ update: () => q }) };
    const sup = new Supervisor(db as never, {} as never) as unknown as { markKeyInvalid: (a: string, key: string) => Promise<void> };
    await sup.markKeyInvalid('agency-1', 'euler_live_old_key_3456');
    // A replacement saved meanwhile has a different key; the compare-and-set on the stored last4 leaves it alone.
    expect(filters).toContainEqual(['api_key_last4', '3456']);
    expect(filters).toContainEqual(['key_status', 'valid']);
    expect(filters).toContainEqual(['agency_id', 'agency-1']);
  });

  describe('idle status writes', () => {
    /** Records the upserts markIdle makes. */
    function idleDb(fail = false, hang = false) {
      const upserts: { rows: { agency_id: string; unique_id: string; status: string }[]; opts: Record<string, unknown> }[] = [];
      const db = { from: () => ({
        upsert: (rows: never, opts: Record<string, unknown>) => {
          upserts.push({ rows, opts });
          return hang ? new Promise(() => {}) : Promise.resolve({ error: fail ? { message: 'down' } : null });
        },
      }) };
      return { db: db as never, upserts };
    }
    type Sup = { markIdle: (s: { agencyId: string; uid: string }[], st: 'paused' | 'capacity') => Promise<void> };

    it('writes every idle slot as last-writer-wins, and again on every reconcile', async () => {
      const { Supervisor } = await import('../src/worker');
      const { db, upserts } = idleDb();
      const sup = new Supervisor(db, {} as never) as unknown as Sup;
      const slots = [{ agencyId: 'a', uid: 'x' }, { agencyId: 'a', uid: 'y' }, { agencyId: 'b', uid: 'z' }];
      await sup.markIdle(slots, 'capacity');
      expect(upserts).toHaveLength(1);
      expect(upserts[0]!.opts).toEqual({ onConflict: 'agency_id,unique_id' });        // overwrites: no ownership, no ignoreDuplicates
      expect(upserts[0]!.rows.map(r => r.status)).toEqual(['capacity', 'capacity', 'capacity']);
      await sup.markIdle(slots, 'capacity');
      expect(upserts).toHaveLength(2);                                                // re-asserted, not cached: a stale row is corrected
    });

    it('writes in bounded batches', async () => {
      const { Supervisor } = await import('../src/worker');
      const { db, upserts } = idleDb();
      const sup = new Supervisor(db, {} as never) as unknown as Sup;
      await sup.markIdle(Array.from({ length: 250 }, (_, i) => ({ agencyId: 'a', uid: `c${i}` })), 'paused');
      expect(upserts.map(u => u.rows.length)).toEqual([100, 100, 50]);
    });

    it('logs a failed write and does not throw, so the reconcile carries on', async () => {
      const { Supervisor } = await import('../src/worker');
      const sup = new Supervisor(idleDb(true).db, {} as never) as unknown as Sup;
      await expect(sup.markIdle([{ agencyId: 'a', uid: 'x' }], 'paused')).resolves.toBeUndefined();
    });

    it('gives up on a write that hangs rather than wedging the reconcile', async () => {
      vi.useFakeTimers();
      try {
        const { Supervisor } = await import('../src/worker');
        const sup = new Supervisor(idleDb(false, true).db, {} as never) as unknown as Sup;
        const done = sup.markIdle([{ agencyId: 'a', uid: 'x' }], 'paused').catch(e => e as Error);
        await vi.advanceTimersByTimeAsync(20_001);
        expect(((await done) as Error).message).toMatch(/timed out/);
      } finally { vi.useRealTimers(); }
    });
  });
});
