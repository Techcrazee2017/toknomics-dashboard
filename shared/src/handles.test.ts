import { describe, expect, it } from 'vitest';
import { normalizeUniqueId, TOOL_INPUTS, UpdateConnectionBody } from './index';

describe('normalizeUniqueId', () => {
  it('accepts handles, @handles and profile URLs', () => {
    expect(normalizeUniqueId('@Nova_Shift')).toBe('nova_shift');
    expect(normalizeUniqueId('https://www.tiktok.com/@midnight.wren/live')).toBe('midnight.wren');
  });
  it('rejects junk', () => {
    expect(() => normalizeUniqueId('a')).toThrow();
    expect(() => normalizeUniqueId('drop table;')).toThrow();
  });
});

describe('tool inputs', () => {
  it('requires numeric ids for moderation', () => {
    expect(TOOL_INPUTS['bans-ban_room_user'].safeParse({ room_id: '7400000000000000000', tiktok_user_id: '@spam' }).success).toBe(false);
    expect(TOOL_INPUTS['mutes-mute_room_user'].parse({ room_id: '7400000000000000000', user_id: '7000000000000000001', duration: 300 }).duration).toBe(300);
  });
  it('rejects unsupported mute durations', () => {
    expect(TOOL_INPUTS['mutes-mute_room_user'].safeParse({ room_id: '7400000000000000000', user_id: '7000000000000000001', duration: 10 }).success).toBe(false);
  });
});

describe('connection body', () => {
  it('requires sessionid in cookie headers', () => {
    expect(UpdateConnectionBody.safeParse({ cookie: 'tt_csrf=1' }).success).toBe(false);
    expect(UpdateConnectionBody.safeParse({ cookie: 'sessionid=abc; tt-target-idc=useast5' }).success).toBe(true);
  });
});
