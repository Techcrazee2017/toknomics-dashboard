/** Normalises "@Handle", "tiktok.com/@handle/live" etc. to the lowercase unique_id the database stores. */
export function normalizeUniqueId(input: string): string {
  const id = input
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]!
    .toLowerCase();
  if (!UNIQUE_ID.test(id)) throw new Error(`"${input}" is not a valid TikTok handle`);
  return id;
}

export const UNIQUE_ID = /^[a-z0-9._]{2,24}$/;
export const NUMERIC_ID = /^\d{5,24}$/;

export function isHandle(input: string): boolean {
  try { normalizeUniqueId(input); return true; } catch { return false; }
}
