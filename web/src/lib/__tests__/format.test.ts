import { describe, expect, it } from 'vitest';
import { ago, compact, mmss, money, roi, signed } from '../format';
import { parseChat } from '../liveChat';
import { workerLine } from '../../screens/LiveTargets';

const r = { coinUsd: 0.0133, diamondUsd: 0.005, cutPct: 20 };

describe('money', () => {
  it('formats USD like the prototype', () => {
    expect(money(1234.4, 'usd', r)).toBe('$1,234');
    expect(money(12.345, 'usd', r)).toBe('$12.35');
    expect(money(-50, 'usd', r)).toBe('−$50.00');
    expect(signed(5, 'usd', r)).toBe('+$5.00');
  });
  it('converts to coins and diamonds', () => {
    expect(money(133, 'coins', r)).toBe('10.0k coins');
    expect(money(5, 'diamonds', r)).toBe('1,000 diamonds');
  });
  it('compacts and computes ROI', () => {
    expect(compact(2_500_000)).toBe('2.50M');
    expect(roi(-50, 100)).toBe('−50%');
    expect(roi(1, 0)).toBe('—');
  });
});

describe('time', () => {
  it('ago / mmss', () => {
    expect(ago(0, 30_000)).toBe('30s ago');
    expect(ago(0, 3_600_000 * 2)).toBe('2h ago');
    expect(mmss(372)).toBe('06:12');
    expect(mmss(3_725)).toBe('1:02:05');
  });
});

describe('parseChat', () => {
  it('reads WebcastChatMessage from bundles, newest last in frame order', () => {
    const f = JSON.stringify({ messages: [
      { type: 'WebcastChatMessage', data: { common: { msgId: '1', createTime: '1000' }, user: { userId: '7', uniqueId: 'zoe.kite' }, comment: 'gg' } },
      { type: 'WebcastGiftMessage', data: {} },
      { type: 'WebcastChatMessage', data: { common: {}, user: { userId: '8' }, comment: 'no id' } },
    ] });
    expect(parseChat(f)).toEqual([{ id: '1', userId: '7', user: 'zoe.kite', comment: 'gg', ts: 1000 }]);
    expect(parseChat('nope')).toEqual([]);
  });
});

describe('workerLine', () => {
  const base = { unique_id: 'x', room_id: null, last_error: null, last_event_at: null, viewer_count: null, connected_at: null, session_started_at: null, events_ingested: 0 };
  it('describes socket states', () => {
    expect(workerLine(undefined, 0).tone).toBe('wait');
    expect(workerLine({ ...base, status: 'live', close_code: null, next_retry_at: null }, 0).text).toMatch(/ingesting/);
    expect(workerLine({ ...base, status: 'offline', close_code: 4404, next_retry_at: new Date(61_000).toISOString() }, 1_000).text).toBe('Closed 4404 NOT_LIVE · retry in 60s');
    expect(workerLine({ ...base, status: 'auth_error', close_code: 4401, next_retry_at: null }, 0).tone).toBe('err');
  });
});
