import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CAN, isHandle, normalizeUniqueId, planOf, TIERS, type Tier } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { keys, useTeams } from '../lib/data';
import { useRosterPL } from '../lib/derive';
import { at, money, mono, pct, roi, signed } from '../lib/format';
import { supabase } from '../lib/supabase';
import { dbError } from '../lib/api';
import { trackTarget } from '../lib/targets';
import { PageHeader } from '../components/Shell';
import { Avatar, Dialog, Empty, ErrorLine, Field, Seg } from '../components/ui';
import { useCreatorDrawer } from './CreatorDrawer';

type Sort = 'net' | 'invest' | 'comm';

export function Roster() {
  const { rates, prefs, role, agency } = useAgency();
  const pl = useRosterPL();
  const openCreator = useCreatorDrawer();
  const [sort, setSort] = useState<Sort>('net');
  const [adding, setAdding] = useState(false);
  const F = (v: number) => money(v, prefs.unit, rates);
  const cards = [...pl.rows].sort((a, b) => b[sort] - a[sort]);
  const plan = planOf(agency.plan);

  return (
    <>
      <PageHeader title="Creator roster" subtitle="Profit and loss per creator: what the agency put in against the commission it earned." filters unit />
      <section className="tn-toolbar">
        <div style={{ color: 'var(--color-neutral-400)' }}>{pl.rows.length} creators · {pl.inProfit} in profit · {pl.window.label}</div>
        <div className="tn-row-8" style={{ gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>Sort by</span>
          <Seg<Sort> label="Sort by" value={sort} onChange={setSort} options={[['net', 'Net margin'], ['invest', 'Investment'], ['comm', 'Commission']]} />
          {CAN.editRoster(role) && <button className="btn btn-primary" onClick={() => setAdding(true)}><i className="ph ph-user-plus" />Add creator</button>}
        </div>
      </section>
      {pl.error && <ErrorLine error={pl.error} />}
      <section className="tn-grid-cards">
        {cards.map(x => (
          <button key={x.c.id} onClick={() => openCreator(x.c.unique_id)} className="card elev-sm tn-card gap-6 tn-rostercard">
            <div className="tn-row-8" style={{ gap: 'var(--space-4)' }}>
              <Avatar text={mono(x.c.unique_id)} size={40} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis' }}>{at(x.c.unique_id)}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{x.team} · Tier {x.c.tier}</span>
              </div>
              <span className={x.net >= 0 ? 'tag tag-accent' : 'tag tag-neutral'}>{x.net >= 0 ? 'Profit' : 'Loss'}</span>
            </div>
            <div className="tnum" style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8 }}>
              <span style={{ color: 'var(--color-neutral-400)' }}>Agency investment</span><span style={{ textAlign: 'right' }}>{F(x.invest)}</span>
              <span style={{ color: 'var(--color-neutral-400)' }}>Commission generated</span><span style={{ textAlign: 'right' }}>{F(x.comm)}</span>
              <span style={{ color: 'var(--color-neutral-400)' }}>Net margin</span><span style={{ textAlign: 'right', color: x.net >= 0 ? 'var(--color-accent-300)' : 'var(--color-neutral-300)' }}>{signed(x.net, prefs.unit, rates)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="tn-split bg">
                <span style={{ width: x.invest + x.comm ? pct(x.invest, x.invest + x.comm) : '50%', background: 'var(--color-neutral-700)' }} />
                <span style={{ flex: 1, background: 'var(--color-accent-500)' }} />
              </div>
              <div className="tn-between" style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}><span>{x.gifts} gifts</span><span>ROI {roi(x.net, x.invest)}</span></div>
            </div>
          </button>
        ))}
      </section>
      {!pl.loading && cards.length === 0 && (
        <div className="card tn-card" style={{ padding: 'var(--space-8)', alignItems: 'flex-start' }}>
          <div className="card-title">No creators{prefs.teamId !== 'all' || prefs.tier !== 'all' ? ' match these filters' : ' yet'}</div>
          <p className="card-body">Add the creators your agency manages to see their P&L. Your {plan.short} plan allows {plan.limit}.</p>
          {CAN.editRoster(role) && <button className="btn btn-primary" onClick={() => setAdding(true)}><i className="ph ph-user-plus" />Add creator</button>}
        </div>
      )}
      {adding && <AddCreatorDialog onClose={() => setAdding(false)} />}
    </>
  );
}

function AddCreatorDialog({ onClose }: { onClose: () => void }) {
  const { agency, toast, prefs } = useAgency();
  const qc = useQueryClient();
  const teams = useTeams(agency.id);
  const [handle, setHandle] = useState('');
  const [teamId, setTeamId] = useState(prefs.teamId === 'all' ? '' : prefs.teamId);
  const [tier, setTier] = useState<Tier>('B');
  const [track, setTrack] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isHandle(handle)) return setErr('Enter a TikTok handle, e.g. @nova_shift');
    setBusy(true);
    const unique_id = normalizeUniqueId(handle);
    const { error } = await supabase.from('creators').insert({ agency_id: agency.id, unique_id, team_id: teamId || null, tier });
    if (error) { setBusy(false); return setErr(error.code === '23505' ? 'Already on the roster' : dbError(error)!.message); }
    let note = '';
    if (track) {
      try { await trackTarget({ agencyId: agency.id, handle: unique_id, source: 'roster' }); } catch (x) { note = ` Tracking failed: ${(x as Error).message}`; }
    }
    void qc.invalidateQueries({ queryKey: keys.creators(agency.id) });
    void qc.invalidateQueries({ queryKey: keys.targets(agency.id) });
    toast(`${at(unique_id)} added to the roster.${note}`);
    onClose();
  };

  return (
    <Dialog title="Add creator" onClose={onClose} onSubmit={e => void submit(e)}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>Add to roster</button></>}>
      <Field label="Creator handle" error={err}><input className="input" placeholder="@handle" value={handle} onChange={e => { setHandle(e.target.value); setErr(''); }} autoFocus /></Field>
      <Field label="Team">
        <select className="input" value={teamId} onChange={e => setTeamId(e.target.value)}>
          <option value="">No team</option>
          {(teams.data ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Tier"><Seg<Tier> label="Tier" value={tier} onChange={setTier} options={TIERS.map(t => [t, `Tier ${t}`] as const)} /></Field>
      <label className="radio"><input type="checkbox" checked={track} onChange={e => setTrack(e.target.checked)} style={{ accentColor: 'var(--color-accent)' }} />Track their LIVE streams (opens a worker socket when they go live)</label>
    </Dialog>
  );
}
