import { describe, expect, it } from 'vitest';
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

  it('does not report a shared opponent as over capacity when another admitted battle already runs it', () => {
    const p = planSockets([t('a', 'c1', 'shared'), t('a', 'c2', 'shared')], keys, new Map([['a', 2]]), 100);
    expect(run(p)).toEqual(['a:c1', 'a:shared']);
    expect(p.capacity).toEqual([{ agencyId: 'a', uid: 'c2' }]);
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

describe('StreamConnection status writes', () => {
  it('always includes status so partial upserts pass stream_status NOT NULL', async () => {
    const { StreamConnection } = await import('../src/worker');
    const writes: Record<string, unknown>[] = [];
    const db = { from: () => ({ upsert: async (row: Record<string, unknown>) => { writes.push(row); return { error: null }; } }) };
    const c = new StreamConnection('agency-1', 'nova_shift', 'k', db as never, {} as never, () => new Map());
    const set = (c as unknown as { setStatus: (p: Record<string, unknown>) => Promise<void> }).setStatus.bind(c);
    await set({ status: 'live' });
    await set({ room_id: '7400', viewer_count: 12 });
    expect(writes[1]).toMatchObject({ agency_id: 'agency-1', unique_id: 'nova_shift', status: 'live', room_id: '7400', viewer_count: 12 });
  });
});
