// Display formatting, ported from the prototype's F / Fs / ago / stamp helpers.
export type Unit = 'usd' | 'coins' | 'diamonds';
export type Rates = { coinUsd: number; diamondUsd: number; cutPct: number };

export const compact = (n: number) => {
  const a = Math.abs(n);
  return a >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toLocaleString('en-US');
};

/** Formats a USD amount in the selected unit (USD, or its equivalent in coins / diamonds). */
export function money(usd: number, unit: Unit, r: Rates): string {
  const neg = usd < 0, a = Math.abs(usd);
  const s = unit === 'usd'
    ? '$' + (a >= 100 ? Math.round(a).toLocaleString('en-US') : a.toFixed(2))
    : unit === 'coins' ? compact(a / r.coinUsd) + ' coins' : compact(a / r.diamondUsd) + ' diamonds';
  return (neg ? '−' : '') + s;
}
export const signed = (usd: number, unit: Unit, r: Rates) => (usd >= 0 ? '+' : '') + money(usd, unit, r);
export const usdWhole = (v: number) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');

export function ago(ts: number | string | null | undefined, now = Date.now()): string {
  if (ts == null) return '—';
  const t = typeof ts === 'string' ? Date.parse(ts) : ts;
  const s = Math.max(1, Math.round((now - t) / 1000));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function stamp(ts: string | number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s % 60).padStart(2, '0');
};

export const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0).toFixed(1) + '%';
export const roi = (net: number, invest: number) => (invest ? (net >= 0 ? '+' : '−') + Math.abs(Math.round((net / invest) * 100)) + '%' : '—');
export const mono = (handle: string) => handle.replace(/^@/, '').slice(0, 2).toUpperCase();
export const at = (h: string) => '@' + h.replace(/^@/, '');

export const RANGES = { '24h': { days: 1, label: 'last 24 hours', buckets: 24 }, '7d': { days: 7, label: 'last 7 days', buckets: 7 }, '30d': { days: 30, label: 'last 30 days', buckets: 15 } } as const;
export type Range = keyof typeof RANGES;
