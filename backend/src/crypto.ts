// AES-256-GCM for Euler credentials at rest. The agency id is bound as AAD, so a ciphertext
// copied onto another agency's row fails to decrypt instead of leaking that agency's key.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { need } from './env';

let cached: Buffer | undefined;
function key(): Buffer {
  if (cached) return cached;
  const k = Buffer.from(need('CREDENTIALS_KEY'), 'base64');
  if (k.length !== 32) throw new Error('CREDENTIALS_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)');
  return (cached = k);
}

export function seal(plaintext: string, agencyId: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  c.setAAD(Buffer.from(agencyId));
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function open(sealed: string, agencyId: string): string {
  const [v, iv, tag, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unrecognised credential format');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAAD(Buffer.from(agencyId));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Test hook: lets unit tests inject a key without touching process.env ordering. */
export function _setKeyForTests(k: Buffer | undefined) { cached = k; }
