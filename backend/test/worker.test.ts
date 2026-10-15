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

/** A fake db that records stream_status writes, and answers `update ... select` with `updated` rows. */
function statusDb(updated: unknown[]) {
  const calls: { op: string; row?: Record<string, unknown>; opts?: Record<string, unknown>; eq: [string, unknown][] }[] = [];
  const db = { from: () => ({
    upsert: async (row: Record<string, unknown>, opts: Record<string, unknown>) => { calls.push({ op: 'upsert', row, opts, eq: [] }); return { error: null }; },
    update: (row: Record<string, unknown>) => {
      const c = { op: 'update', row, eq: [] as [string, unknown][] }; calls.push(c);
      const q: any = { eq: (k: string, v: unknown) => { c.eq.push([k, v]); return q; }, select: async () => ({ data: updated, error: null }) };
      return q;
    },
  }) };
  return { db: db as never, calls };
}
const setStatusOf = (c: unknown) => (c as { setStatus: (p: Record<string, unknown>, m?: 'claim' | 'owned') => Promise<void> }).setStatus.bind(c);

describe('StreamConnection status writes', () => {
  it('always includes status so partial writes pass stream_status.status NOT NULL', async () => {
    const { StreamConnection } = await import('../src/worker');
    const { db, calls } = statusDb([{ unique_id: 'nova_shift' }]);
    const c = new StreamConnection('agency-1', 'nova_shift', 'k', db, {} as never, () => new Map());
    const set = setStatusOf(c);
    await set({ status: 'live' });
    await set({ room_id: '7400', viewer_count: 12 });
    expect(calls[1]!.row).toMatchObject({ status: 'live', room_id: '7400', viewer_count: 12 });
  });

  it('claims the row with an upsert, then only writes while it still owns it', async () => {
    const { StreamConnection } = await import('../src/worker');
    const { db, calls } = statusDb([{ unique_id: 'nova_shift' }]);
    const set = setStatusOf(new StreamConnection('agency-1', 'nova_shift', 'k', db, {} as never, () => new Map()));
    await set({ status: 'connecting' }, 'claim');
    expect(calls[0]).toMatchObject({ op: 'upsert', row: { agency_id: 'agency-1', unique_id: 'nova_shift' }, opts: { onConflict: 'agency_id,unique_id' } });
    expect(typeof calls[0]!.row!.worker_id).toBe('string');
    await set({ status: 'live' });
    expect(calls[1]).toMatchObject({ op: 'update' });
    expect(calls[1]!.eq.map(e => e[0]).sort()).toEqual(['agency_id', 'unique_id', 'worker_id']);
    expect(calls[1]!.eq.find(e => e[0] === 'worker_id')![1]).toBe(calls[0]!.row!.worker_id);
    expect(calls).toHaveLength(2); // the update matched: no fallback insert
  });

  it('never takes a row back from a newer process: the fallback insert ignores existing rows', async () => {
    const { StreamConnection } = await import('../src/worker');
    const { db, calls } = statusDb([]); // update matched nothing: another worker owns the row (or it is missing)
    await setStatusOf(new StreamConnection('agency-1', 'nova_shift', 'k', db, {} as never, () => new Map()))({ status: 'live' });
    expect(calls[1]).toMatchObject({ op: 'upsert', opts: { ignoreDuplicates: true } });
  });
});

describe('StreamConnection.start', () => {
  it('still opens the socket when the status lookup hangs', async () => {
    vi.useFakeTimers();
    try {
      const { StreamConnection } = await import('../src/worker');
      const hang = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => new Promise(() => {}) }) }) }) }) };
      const c = new StreamConnection('agency-1', 'nova_shift', 'k', hang as never, {} as never, () => new Map());
      const connect = vi.spyOn(c as unknown as { connect: () => void }, 'connect').mockImplementation(() => {});
      const started = c.start();
      await vi.advanceTimersByTimeAsync(20_001);
      await started;
      expect(connect).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it('does not connect if it was stopped while the lookup was pending', async () => {
    const { StreamConnection } = await import('../src/worker');
    let release!: (v: unknown) => void;
    const writes = statusDb([{ unique_id: 'nova_shift' }]);
    const base = (writes.db as unknown as { from: () => Record<string, unknown> }).from();
    const slow = { from: () => ({ ...base, select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => new Promise(r => { release = r; }) }) }) }) }) };
    const c = new StreamConnection('agency-1', 'nova_shift', 'k', slow as never, {} as never, () => new Map());
    const connect = vi.spyOn(c as unknown as { connect: () => void }, 'connect');
    const started = c.start();
    c.stop();
    release({ data: null });
    await started;
    expect(connect).toHaveBeenCalledTimes(1);
    // connect() itself returns early when stopped: no socket is opened.
    expect((c as unknown as { ws?: unknown }).ws).toBeUndefined();
  });
});
