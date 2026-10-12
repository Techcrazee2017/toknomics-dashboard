import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isHandle, normalizeUniqueId, type ToolOutput } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { api } from '../lib/api';
import { keys, useTargets } from '../lib/data';
import { at, mono } from '../lib/format';
import { trackTarget } from '../lib/targets';
import { Avatar, Dialog, Field, Seg } from '../components/ui';

type Profile = ToolOutput<'get_user_basic'> & { user_id: string; room_id: string | null; is_live: boolean; handle: string };
type Look = { state: 'idle' } | { state: 'loading'; handle: string } | { state: 'error'; message: string } | { state: 'ok'; p: Profile };

export function AddTargetDialog({ initialHandle = '', initialKind = 'battle', onClose }: { initialHandle?: string; initialKind?: 'battle' | 'stream'; onClose: () => void }) {
  const { agency, toast } = useAgency();
  const qc = useQueryClient();
  const targets = useTargets(agency.id);
  const [handle, setHandle] = useState(initialHandle);
  const [kind, setKind] = useState<'battle' | 'stream'>(initialKind);
  const [opponent, setOpponent] = useState('');
  const [label, setLabel] = useState('');
  const [look, setLook] = useState<Look>({ state: 'idle' });
  const [errs, setErrs] = useState<{ handle?: string; opponent?: string }>({});
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const lookup = async (h = handle) => {
    if (!isHandle(h)) return setErrs({ handle: 'Enter a TikTok handle starting with @' });
    const u = normalizeUniqueId(h), n = ++seq.current;
    setLook({ state: 'loading', handle: u });
    try {
      const [id, basic, room] = await Promise.all([
        api.tool(agency.id, 'get_user_id', { unique_id: u }), api.tool(agency.id, 'get_user_basic', { unique_id: u }), api.tool(agency.id, 'get_room_id', { unique_id: u }),
      ]);
      if (n === seq.current) setLook({ state: 'ok', p: { ...basic, user_id: id.user_id, room_id: room.room_id, is_live: room.is_live, handle: u } });
    } catch (e) {
      if (n === seq.current) setLook({ state: 'error', message: (e as Error).message });
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (initialHandle) void lookup(initialHandle); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err: typeof errs = {};
    if (!isHandle(handle)) err.handle = 'Enter a TikTok handle starting with @';
    else if (look.state !== 'ok' || look.p.handle !== normalizeUniqueId(handle)) err.handle = 'Look up the handle first';
    else if (targets.data?.some(t => t.unique_id === normalizeUniqueId(handle))) err.handle = 'Already tracking this stream';
    if (kind === 'battle' && !isHandle(opponent)) err.opponent = 'Battles need an opponent handle';
    if (Object.keys(err).length || look.state !== 'ok') return setErrs(err);
    setBusy(true);
    try {
      const p = look.p;
      await trackTarget({ agencyId: agency.id, handle: p.handle, source: kind === 'battle' ? 'battle' : 'pin', kind, opponent: kind === 'battle' ? opponent : null, label: label.trim() || (kind === 'battle' ? `Battle vs ${at(normalizeUniqueId(opponent))}` : 'Live stream'), anchorId: p.user_id });
      void qc.invalidateQueries({ queryKey: keys.targets(agency.id) });
      toast(p.is_live ? `Tracking ${at(p.handle)}` : `${at(p.handle)} is offline. Tracking starts when they go live.`);
      onClose();
    } catch (x) {
      setErrs({ handle: (x as Error).message });
    } finally { setBusy(false); }
  };

  const p = look.state === 'ok' ? look.p : null;
  return (
    <Dialog title="Add target stream" onClose={onClose} onSubmit={e => void submit(e)}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={!p || busy}>{p && !p.is_live ? 'Track when live' : 'Start tracking'}</button></>}>
      <Field label="Creator handle" error={errs.handle}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input className="input" placeholder="@handle" value={handle} autoFocus onChange={e => { setHandle(e.target.value); setLook({ state: 'idle' }); setErrs({}); }} />
          <button type="button" className="btn btn-secondary" style={{ flex: 'none' }} onClick={() => void lookup()} disabled={look.state === 'loading'}><i className="ph ph-magnifying-glass" />Look up</button>
        </div>
      </Field>
      {look.state === 'loading' && <div className="mono" style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>get_user_id · get_user_basic · get_room_id…</div>}
      {look.state === 'error' && <div style={{ fontSize: 13, color: 'var(--color-accent-300)' }} role="alert">{look.message}</div>}
      {p && (
        <div className="tn-panel tn-in" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-4)' }}>
          {p.avatar_url ? <img src={p.avatar_url} alt="" width={40} height={40} style={{ borderRadius: '50%', flex: 'none' }} /> : <Avatar text={mono(p.handle)} size={40} />}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>{p.nickname}</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{at(p.handle)} · {p.region} · ID {p.user_id}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{p.is_live ? `Room ${p.room_id}` : 'Not live right now'}</span>
          </div>
          <span className={p.is_live ? 'tag tag-accent' : 'tag tag-neutral'}>{p.is_live ? 'Live' : 'Offline'}</span>
        </div>
      )}
      <Field label="Type"><Seg label="Type" value={kind} onChange={setKind} options={[['battle', 'Battle'], ['stream', 'Stream']]} /></Field>
      {kind === 'battle' && <Field label="Opponent handle" error={errs.opponent}><input className="input" placeholder="@opponent" value={opponent} onChange={e => { setOpponent(e.target.value); setErrs(x => ({ ...x, opponent: undefined })); }} /></Field>}
      <Field label="Note (optional)"><input className="input" placeholder="e.g. Rank defence before midnight" value={label} maxLength={120} onChange={e => setLabel(e.target.value)} /></Field>
    </Dialog>
  );
}
