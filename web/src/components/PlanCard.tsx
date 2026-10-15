import type { ReactNode } from 'react';
import type { PLANS } from '@toknomics/shared';

export type Plan = (typeof PLANS)[number];

/** One plan's price and features. Used by the public pricing page and the in-app Billing screen. */
export function PlanCard(p: { plan: Plan; current?: boolean; badge?: ReactNode; action: ReactNode }) {
  const t = p.plan;
  return (
    <div className="card tn-card gap-6" style={{ boxShadow: p.current ? '0 0 0 1px var(--color-accent)' : 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="tn-between"><span className="card-title">{t.name}</span>{p.badge}</div>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>{t.who}</span>
      </div>
      <div><span className="tnum" style={{ fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 500, letterSpacing: '-0.02em' }}>{t.price}</span><span style={{ color: 'var(--color-neutral-500)' }}> / month</span></div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {t.feats.map(f => <li key={f} style={{ display: 'flex', gap: 8, alignItems: 'baseline', color: 'var(--color-neutral-200)' }}><i className="ph ph-check" style={{ color: 'var(--color-accent)', flex: 'none' }} />{f}</li>)}
      </ul>
      {p.action}
    </div>
  );
}
