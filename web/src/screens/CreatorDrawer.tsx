import { createContext, useContext, useState, type ReactNode } from 'react';
import { CAN, PURPOSES } from '@toknomics/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useAgency } from '../lib/agency';
import { useCreators, useLedger, keys } from '../lib/data';
import { useRosterPL } from '../lib/derive';
import { ago, at, compact, money, mono, pct, signed, usdWhole } from '../lib/format';
import { supabase } from '../lib/supabase';
import { dbError } from '../lib/api';
import { Avatar, Drawer, IconBtn } from '../components/ui';

const Ctx = createContext<(uniqueId: string) => void>(() => {});
export const useCreatorDrawer = () => useContext(Ctx);

export function CreatorDrawerProvider(p: { children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  return <Ctx.Provider value={setOpen}>{p.children}{open && <CreatorDrawer uniqueId={open} onClose={() => setOpen(null)} />}</Ctx.Provider>;
}

function CreatorDrawer({ uniqueId, onClose }: { uniqueId: string; onClose: () => void }) {
  const { agency, rates, prefs, role, toast, now } = useAgency();
  const qc = useQueryClient();
  const pl = useRosterPL();
  const creators = useCreators(agency.id);
  const w = pl.window;
  const gifts = useLedger(agency.id, { from: w.from, to: w.to, creators: [uniqueId], purpose: null, query: '', limit: 500 });
  const F = (v: number) => money(v, prefs.unit, rates);
  const c = creators.data?.find(x => x.unique_id === uniqueId);
  const x = pl.rows.find(r => r.c.unique_id === uniqueId);
  const invest = x?.invest ?? 0, comm = x?.comm ?? 0, net = comm - invest;
  const netColor = net >= 0 ? 'var(--color-accent-300)' : 'var(--color-neutral-300)';

  const list = gifts.data ?? [];
  const byPurpose = [...PURPOSES.map(p => ({ key: p.key as string | null, label: p.label })), { key: null, label: 'Untagged' }]
    .map(p => ({ label: p.label, v: list.filter(e => e.purpose === p.key).reduce((a, e) => a + e.coins * rates.coinUsd, 0) }))
    .filter(p => p.v > 0);
  const pm = Math.max(1e-9, ...byPurpose.map(p => p.v));

  const remove = async () => {
    if (!c || !confirm(`Remove ${at(uniqueId)} from the roster? Gift history is kept.`)) return;
    const { error } = await supabase.from('creators').delete().eq('id', c.id);
    if (error) return toast(dbError(error)!.message);
    void qc.invalidateQueries({ queryKey: keys.creators(agency.id) });
    toast(`${at(uniqueId)} removed from the roster`);
    onClose();
  };

  return (
    <Drawer label={`Creator ${at(uniqueId)}`} onClose={onClose}>
      <div className="tn-row-8" style={{ gap: 'var(--space-4)' }}>
        <Avatar text={mono(uniqueId)} size={48} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 20, fontFamily: 'var(--font-heading)', fontWeight: 500 }}>{at(uniqueId)}</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{x?.team ?? 'Not on roster'}{c ? ` · Tier ${c.tier}` : ''} · {rates.cutPct}% agency cut</span>
        </div>
        <IconBtn icon="ph-x" title="Close" onClick={onClose} />
      </div>
      <div className="tnum" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
        <div className="tn-kv"><span className="card-kicker">Invested</span><span style={{ fontSize: 20 }}>{F(invest)}</span></div>
        <div className="tn-kv"><span className="card-kicker">Commission</span><span style={{ fontSize: 20 }}>{F(comm)}</span></div>
        <div className="tn-kv"><span className="card-kicker">Net</span><span style={{ fontSize: 20, color: netColor }}>{signed(net, prefs.unit, rates)}</span></div>
      </div>
      <div className="tn-panel tnum" style={{ gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>Net profit, {w.label}</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-300)', lineHeight: 1.6 }}>
          ({compact(x?.diamonds ?? 0)} diamonds × ${rates.diamondUsd} × {rates.cutPct}%) − {usdWhole(invest)} gifted = <span style={{ color: netColor }}>{(net >= 0 ? '+' : '') + usdWhole(net)}</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <span className="card-title tn-title-sm">Spend by purpose</span>
        {byPurpose.length === 0 && <span style={{ color: 'var(--color-neutral-500)' }}>No agency gifts in this range.</span>}
        {byPurpose.map(p => (
          <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="tn-between" style={{ fontSize: 13 }}><span style={{ color: 'var(--color-neutral-300)' }}>{p.label}</span><span className="tnum">{F(p.v)}</span></div>
            <div className="tn-bar"><span style={{ width: pct(p.v, pm) }} /></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span className="card-title tn-title-sm">Recent gifts</span>
        {list.slice(0, 8).map(e => (
          <div key={e.id} className="tn-list-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span>{e.gift_name ?? `Gift ${e.gift_id}`} × {e.repeat_count}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{at(e.sender_unique_id)} · {ago(e.occurred_at, now)} · {PURPOSES.find(p => p.key === e.purpose)?.label ?? 'Untagged'}</span>
            </div>
            <span className="tnum">{F(e.coins * rates.coinUsd)}</span>
          </div>
        ))}
        {!gifts.isLoading && list.length === 0 && <span style={{ color: 'var(--color-neutral-500)' }}>No gifts in this range.</span>}
      </div>
      {c && CAN.editRoster(role) && <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => void remove()}><i className="ph ph-user-minus" />Remove from roster</button>}
    </Drawer>
  );
}
