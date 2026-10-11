import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CAN, planOf, ROLE_INFO } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { api, ApiRequestError, dbError } from '../lib/api';
import { keys, useCreators, useMembers, useTeams } from '../lib/data';
import { ago } from '../lib/format';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/Shell';
import { Dialog, ErrorLine, Field, Seg } from '../components/ui';

export function Team() {
  const { agency, role, toast, now } = useAgency();
  const qc = useQueryClient();
  const members = useMembers(agency.id);
  const teams = useTeams(agency.id);
  const creators = useCreators(agency.id);
  const [inviting, setInviting] = useState(false);
  const [newTeam, setNewTeam] = useState('');
  const isFounder = CAN.manageTeam(role);
  const plan = planOf(agency.plan);
  const refresh = () => void qc.invalidateQueries({ queryKey: keys.members(agency.id) });
  const run = async (p: Promise<unknown>, msg: string) => { try { await p; toast(msg); refresh(); } catch (e) { toast((e as Error).message); } };

  const addTeam = async (e: FormEvent) => {
    e.preventDefault();
    const name = newTeam.trim();
    if (!name) return;
    const { error } = await supabase.from('teams').insert({ agency_id: agency.id, name });
    if (error) return toast(dbError(error)!.message);
    setNewTeam('');
    void qc.invalidateQueries({ queryKey: keys.teams(agency.id) });
  };
  const deleteTeam = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? Its creators and members keep their data but lose the team.`)) return;
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) return toast(dbError(error)!.message);
    void qc.invalidateQueries({ queryKey: keys.teams(agency.id) });
    void qc.invalidateQueries({ queryKey: keys.creators(agency.id) });
  };

  const list = members.data ?? [];
  const creatorCount = (teamId: string | null) => teamId ? (creators.data ?? []).filter(c => c.team_id === teamId).length : (creators.data?.length ?? 0);

  return (
    <>
      <PageHeader title="Team" subtitle="Who can see and manage which rosters." />
      <section className="tn-toolbar">
        <div style={{ color: 'var(--color-neutral-400)' }}>{list.length} members · {plan.short} plan</div>
        {isFounder && <button className="btn btn-primary" onClick={() => setInviting(true)}><i className="ph ph-user-plus" />Invite member</button>}
      </section>
      <div className="card elev-sm tn-card flush">
        {members.error && <ErrorLine error={members.error} retry={() => void members.refetch()} />}
        <div className="tn-scroll-x">
          <table className="table" style={{ minWidth: 720 }}>
            <thead><tr><th>Member</th><th>Role</th><th>Roster scope</th><th style={{ textAlign: 'right' }}>Creators</th><th>Last active</th><th /></tr></thead>
            <tbody>
              {list.map(m => {
                const editable = isFounder && m.role !== 'founder';
                return (
                  <tr key={m.user_id}>
                    <td><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span>{m.full_name || m.email.split('@')[0]}</span><span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{m.email}</span></div></td>
                    <td>{m.role === 'founder' ? <span className="tag tag-accent">Founder</span> : editable ? (
                      <select className="input" style={{ width: 'auto', minHeight: 30, paddingBlock: 3, fontSize: 13 }} value={m.role} aria-label="Role"
                        onChange={e => void run(api.updateMember(agency.id, m.user_id, { role: e.target.value as 'manager' | 'moderator' }), 'Role updated')}>
                        <option value="manager">Manager</option><option value="moderator">Moderator</option>
                      </select>
                    ) : <span className="tag tag-neutral">{m.role === 'viewer' ? 'Viewer' : ROLE_INFO[m.role].name}</span>}</td>
                    <td>{m.role === 'founder' ? <span style={{ color: 'var(--color-neutral-300)' }}>All teams</span> : editable ? (
                      <select className="input" style={{ width: 'auto', minHeight: 30, paddingBlock: 3, fontSize: 13 }} value={m.team_id ?? ''} aria-label="Roster scope"
                        onChange={e => void run(api.updateMember(agency.id, m.user_id, { teamId: e.target.value || null }), 'Scope updated')}>
                        <option value="">All teams</option>{(teams.data ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    ) : <span style={{ color: 'var(--color-neutral-300)' }}>{teams.data?.find(t => t.id === m.team_id)?.name ?? 'All teams'}</span>}</td>
                    <td className="tnum" style={{ textAlign: 'right' }}>{creatorCount(m.role === 'founder' ? null : m.team_id)}</td>
                    <td style={{ color: 'var(--color-neutral-400)' }}>{m.status === 'invited' ? 'Invite pending' : ago(m.last_seen_at, now)}</td>
                    <td style={{ textAlign: 'right' }}>{editable && <button className="btn btn-ghost" style={{ color: 'var(--color-neutral-400)' }} onClick={() => { if (confirm(`Remove ${m.email} from ${agency.name}?`)) void run(api.removeMember(agency.id, m.user_id), `${m.full_name || m.email} removed`); }}>Remove</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <section className="card elev-sm tn-card">
        <div className="tn-card-head"><span className="card-title tn-title-sm">Teams</span><span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>Group creators and scope Managers to a roster</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(teams.data ?? []).map(t => (
            <span key={t.id} className="tag tag-neutral" style={{ gap: 6, paddingRight: isFounder ? 4 : undefined }}>{t.name} · {creatorCount(t.id)}
              {isFounder && <button className="tn-link" aria-label={`Delete ${t.name}`} title="Delete team" style={{ display: 'flex', color: 'var(--color-neutral-300)' }} onClick={() => void deleteTeam(t.id, t.name)}><i className="ph ph-x" /></button>}
            </span>
          ))}
          {teams.data?.length === 0 && <span style={{ color: 'var(--color-neutral-500)' }}>No teams yet.</span>}
        </div>
        {isFounder && <form onSubmit={e => void addTeam(e)} style={{ display: 'flex', gap: 'var(--space-2)', maxWidth: 360 }}><input className="input" placeholder="New team name" value={newTeam} maxLength={60} onChange={e => setNewTeam(e.target.value)} aria-label="New team name" /><button className="btn btn-secondary" style={{ flex: 'none' }} disabled={!newTeam.trim()}>Add team</button></form>}
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-6)' }}>
        {Object.values(ROLE_INFO).map(r => (
          <div key={r.name} className="card tn-card gap-3" style={{ background: 'color-mix(in srgb, var(--color-surface) 60%, transparent)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="tn-row-8"><i className={'ph ' + r.icon} style={{ fontSize: 18, color: 'var(--color-accent)' }} /><span className="card-title tn-title-sm">{r.name}</span></div>
            <p className="card-body" style={{ margin: 0 }}>{r.desc}</p>
          </div>
        ))}
      </section>
      {inviting && <InviteDialog onClose={() => setInviting(false)} onDone={refresh} />}
    </>
  );
}

function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { agency, toast } = useAgency();
  const teams = useTeams(agency.id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'moderator'>('moderator');
  const [teamId, setTeamId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Enter a valid email address');
    setBusy(true);
    try {
      await api.invite(agency.id, { email: email.trim(), role, teamId: teamId || null });
      toast('Invite sent to ' + email.trim());
      onDone(); onClose();
    } catch (x) {
      setErr(x instanceof ApiRequestError ? x.fields?.email ?? x.message : (x as Error).message);
    } finally { setBusy(false); }
  };
  return (
    <Dialog title="Invite a team member" onClose={onClose} onSubmit={e => void submit(e)}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>Send invite</button></>}>
      <Field label="Email" error={err}><input className="input" type="email" placeholder="name@agency.com" value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} autoFocus /></Field>
      <Field label="Role"><Seg label="Role" value={role} onChange={setRole} options={[['manager', 'Manager'], ['moderator', 'Moderator']]} /></Field>
      <Field label="Roster scope">
        <select className="input" value={teamId} onChange={e => setTeamId(e.target.value)}><option value="">All teams</option>{(teams.data ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </Field>
    </Dialog>
  );
}
