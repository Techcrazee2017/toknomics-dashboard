import { describe, expect, it } from 'vitest';
import { backoff, desiredSockets, policyFor, socketUrl } from '../src/worker';

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

describe('desiredSockets', () => {
  const targets = [
    { agency_id: 'b', unique_id: 'nova_shift', opponent_unique_id: 'lumen.rise' },
    { agency_id: 'a', unique_id: 'nova_shift', opponent_unique_id: null },
    { agency_id: 'c', unique_id: 'kairo.dev', opponent_unique_id: null },
  ];
  it('opens one socket per creator, including battle opponents', () => {
    const d = desiredSockets(targets, new Map([['a', 'KA'], ['b', 'KB']]));
    expect([...d.keys()].sort()).toEqual(['kairo.dev', 'lumen.rise', 'nova_shift']);
    expect(d.get('nova_shift')).toEqual({ agencyIds: ['a', 'b'], apiKey: 'KA' });
    expect(d.get('lumen.rise')).toEqual({ agencyIds: ['b'], apiKey: 'KB' });
  });
  it('leaves creators without a connected agency keyless (paused)', () => {
    expect(desiredSockets(targets, new Map()).get('kairo.dev')?.apiKey).toBeNull();
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
    const c = new StreamConnection('nova_shift', 'k', db as never, {} as never, () => new Map());
    const set = (c as unknown as { setStatus: (p: Record<string, unknown>) => Promise<void> }).setStatus.bind(c);
    await set({ status: 'live' });
    await set({ room_id: '7400', viewer_count: 12 });
    expect(writes[1]).toMatchObject({ status: 'live', room_id: '7400', viewer_count: 12 });
  });
});
