import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { _setKeyForTests, open, seal } from '../src/crypto';

beforeAll(() => _setKeyForTests(randomBytes(32)));
afterAll(() => _setKeyForTests(undefined));

describe('credential sealing', () => {
  it('round-trips', () => expect(open(seal('euler_secret', 'agency-1'), 'agency-1')).toBe('euler_secret'));
  it('does not reveal plaintext and is randomised', () => {
    const a = seal('euler_secret', 'agency-1');
    expect(a).not.toContain('euler_secret');
    expect(a).not.toBe(seal('euler_secret', 'agency-1'));
  });
  it('binds the ciphertext to its agency', () => expect(() => open(seal('x', 'agency-1'), 'agency-2')).toThrow());
  it('detects tampering', () => {
    const parts = seal('x', 'a').split('.');
    parts[3] = Buffer.from('y').toString('base64url');
    expect(() => open(parts.join('.'), 'a')).toThrow();
  });
});
