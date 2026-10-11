import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CAN, PLANS, planOf, type PlanKey } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { api } from '../lib/api';
import { keys, useCreators, useMembers } from '../lib/data';
import { PageHeader } from '../components/Shell';
import { Dialog } from '../components/ui';

export function Billing() {
  const { agency, role, toast } = useAgency();
  const qc = useQueryClient();
  const creators = useCreators(agency.id);
  const members = useMembers(agency.id);
  const [pick, setPick] = useState<PlanKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const cur = planOf(agency.plan);
  const paying = agency.subscription_status === 'active' || agency.subscription_status === 'trialing' || agency.subscription_status === 'past_due';
  const nCreators = creators.data?.length ?? 0, nSeats = members.data?.length ?? 1;
  const canBill = CAN.manageBilling(role);

  useEffect(() => {
    const r = params.get('checkout');
    if (r === 'success') { toast('Payment received. Your plan updates in a few seconds.'); void qc.invalidateQueries({ queryKey: keys.memberships }); }
    if (r === 'cancelled') toast('Checkout cancelled');
    if (r) setParams({}, { replace: true });
  }, [params, setParams, toast, qc]);

  const p = pick ? planOf(pick) : null;
  const warnings: string[] = [];
  if (p) {
    if (p.limit !== null && nCreators > p.limit) warnings.push(`You track ${nCreators} creators. ${p.short} allows ${p.limit}; you won't be able to add more until you're under the limit.`);
    if (!p.multiSeat && nSeats > 1) warnings.push(`Multi-seat team access is a Scale feature. ${nSeats - 1} teammates can't be invited on ${p.short}.`);
  }
  const confirm = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      const r = await api.checkout(agency.id, pick);
      if ('url' in r) return window.location.assign(r.url);
      toast(`Plan switches to ${planOf(pick).short} at the next renewal`);
      setPick(null);
      setTimeout(() => void qc.invalidateQueries({ queryKey: keys.memberships }), 2500);
    } catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };
  const portal = async () => {
    try { window.location.assign((await api.portal(agency.id)).url); } catch (e) { toast((e as Error).message); }
  };
  const renews = agency.plan_renews_at ? new Date(agency.plan_renews_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <>
      <PageHeader title="Plan & billing" subtitle="Priced by roster size and team seats.">
        {canBill && paying && <button className="btn btn-secondary" onClick={() => void portal()}><i className="ph ph-receipt" />Invoices & payment</button>}
      </PageHeader>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 'var(--space-6)' }}>
        <div className="card elev-sm tn-card">
          <span className="card-kicker">Current plan</span>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 24, fontFamily: 'var(--font-heading)', fontWeight: 500, letterSpacing: '-0.015em' }}>{cur.name}</span>
            <span className="tnum"><span style={{ fontSize: 20 }}>{cur.price}</span><span style={{ color: 'var(--color-neutral-500)' }}> / month</span></span>
          </div>
          <div style={{ color: 'var(--color-neutral-400)' }}>
            {paying ? (renews ? `Renews ${renews}` : 'Active') : agency.subscription_status === 'canceled' ? 'Subscription cancelled' : 'No active subscription. Choose a plan below.'}
            {agency.subscription_status === 'past_due' && ' · payment past due'}
          </div>
        </div>
        <div className="card elev-sm tn-card gap-6">
          <span className="card-kicker">Usage</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="tn-between"><span>Creators on roster</span><span className="tnum" style={{ color: 'var(--color-neutral-300)' }}>{nCreators} of {cur.limit ?? 'unlimited'}</span></div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--color-neutral-900)' }}><span style={{ display: 'block', height: '100%', borderRadius: 3, background: 'var(--color-accent-500)', width: (cur.limit ? Math.min(100, (nCreators / cur.limit) * 100) : Math.min(100, nCreators)) + '%' }} /></div>
          </div>
          <div className="tn-between"><span>Team seats</span><span className="tnum" style={{ color: 'var(--color-neutral-300)' }}>{nSeats} {nSeats === 1 ? 'seat' : 'seats'}{cur.multiSeat ? '' : ' · single seat plan'}</span></div>
        </div>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-6)' }}>
        {PLANS.map(t => {
          const current = t.key === cur.key && paying;
          return (
            <div key={t.key} className="card tn-card gap-6" style={{ boxShadow: t.key === cur.key ? '0 0 0 1px var(--color-accent)' : 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="tn-between"><span className="card-title">{t.name}</span>{t.key === cur.key && <span className="tag tag-outline">Current</span>}</div>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>{t.who}</span>
              </div>
              <div><span className="tnum" style={{ fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 500, letterSpacing: '-0.02em' }}>{t.price}</span><span style={{ color: 'var(--color-neutral-500)' }}> / month</span></div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {t.feats.map(f => <li key={f} style={{ display: 'flex', gap: 8, alignItems: 'baseline', color: 'var(--color-neutral-200)' }}><i className="ph ph-check" style={{ color: 'var(--color-accent)', flex: 'none' }} />{f}</li>)}
              </ul>
              {current ? <button className="btn btn-block" disabled style={{ borderColor: 'var(--color-divider)' }}>Your plan</button>
                : canBill ? <button className="btn btn-secondary btn-block" onClick={() => setPick(t.key)}>{paying ? `Switch to ${t.short}` : `Choose ${t.short}`}</button>
                : <button className="btn btn-block" disabled style={{ borderColor: 'var(--color-divider)' }}>Founders manage billing</button>}
            </div>
          );
        })}
      </section>
      {p && (
        <Dialog title={`${paying ? 'Switch' : 'Subscribe'} to ${p.name}?`} onClose={() => setPick(null)}
          body={paying ? `Your plan changes to ${p.price} / month from the next renewal.` : `You'll continue to Stripe to pay ${p.price} / month.`}
          actions={<><button className="btn btn-secondary" onClick={() => setPick(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>{paying ? 'Confirm switch' : 'Continue to checkout'}</button></>}>
          {warnings.map(w => <div key={w} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--color-accent-300)' }}><i className="ph ph-warning" style={{ flex: 'none', marginTop: 2 }} />{w}</div>)}
        </Dialog>
      )}
    </>
  );
}
