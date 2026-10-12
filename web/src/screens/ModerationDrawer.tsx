import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MUTE_DURATIONS, NUMERIC_ID, type RoomUser } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { api } from '../lib/api';
import { useStreamStatus, type Target } from '../lib/data';
import { ago, at } from '../lib/format';
import { useLiveChat } from '../lib/liveChat';
import { supabase } from '../lib/supabase';
import { Drawer, IconBtn, Seg } from '../components/ui';

type Dur = (typeof MUTE_DURATIONS)[number][0];

export function ModerationDrawer({ target, onClose }: { target: Target; onClose: () => void }) {
  const { agency, toast, now } = useAgency();
  const qc = useQueryClient();
  const status = useStreamStatus(agency.id);
  const roomId = status.data?.get(target.unique_id)?.room_id ?? null;
  const uid = target.unique_id;

  // anchor_id comes from the Add-target lookup; older rows resolve it once and store it
  const anchor = useQuery({
    queryKey: ['anchor', agency.id, uid], staleTime: Infinity,
    queryFn: async () => {
      if (target.anchor_id) return target.anchor_id;
      const { user_id } = await api.tool(agency.id, 'get_user_id', { unique_id: uid });
      await supabase.from('tracked_targets').update({ anchor_id: user_id }).eq('id', target.id);
      return user_id;
    },
  });
  const roomKey = ['room', agency.id, roomId] as const;
  const room = useQuery({
    queryKey: roomKey, enabled: !!roomId && !!anchor.data, retry: false,
    queryFn: async () => {
      const [mu, ba, mo, wo] = await Promise.all([
        api.tool(agency.id, 'mutes-get_muted_users', { room_id: roomId! }),
        api.tool(agency.id, 'bans-get_banned_users', { room_id: roomId! }),
        api.tool(agency.id, 'moderators-get_room_moderators', { anchor_id: anchor.data! }),
        api.tool(agency.id, 'sensitive_words-get_sensitive_words', { room_id: roomId!, unique_id: uid }),
      ]);
      // Euler exposes no read for the comments switch; it starts on and tracks our own toggles
      return { comments: true, muted: mu.users.map(u => ({ ...u, duration: '' })), banned: ba.users, mods: mo.moderators, words: wo.words };
    },
  });
  const chat = useLiveChat(agency.id, uid, !!roomId);
  const [form, setForm] = useState({ muteId: '', muteDur: 300 as Dur, banId: '', modId: '', word: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof form>) => { setForm(f => ({ ...f, ...p })); setErrs({}); };
  type RoomState = NonNullable<typeof room.data>;
  const patch = (fn: (r: RoomState) => RoomState) => qc.setQueryData<RoomState>(roomKey, r => (r ? fn(r) : r));

  async function act(run: () => Promise<unknown>, apply: (r: RoomState) => RoomState, msg: string) {
    setBusy(true);
    try { await run(); patch(apply); toast(msg); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  }
  const needId = (k: string, v: string) => { if (NUMERIC_ID.test(v.trim())) return true; setErrs({ [k]: 'Enter a numeric TikTok user ID' }); return false; };
  const r = room.data, rid = roomId ?? '', aid = anchor.data ?? '';
  const durLabel = (d: number) => MUTE_DURATIONS.find(x => x[0] === d)?.[1] ?? '';
  const mutedIds = new Set(r?.muted.map(m => m.user_id)), bannedIds = new Set(r?.banned.map(m => m.user_id));
  const words = (r?.words ?? []).map(w => w.word.toLowerCase());

  const mute = (user_id: string, duration: Dur, name: string, comment_msg_id?: string) => act(
    () => api.tool(agency.id, 'mutes-mute_room_user', { room_id: rid, user_id, duration, ...(comment_msg_id ? { comment_msg_id } : {}) }),
    x => ({ ...x, muted: [{ user_id, name, duration: durLabel(duration) }, ...x.muted.filter(m => m.user_id !== user_id)] }), `Muted ${name || user_id} · ${durLabel(duration)}`);
  const kick = (tiktok_user_id: string, name: string, comment_msg_id?: string) => act(
    () => api.tool(agency.id, 'bans-ban_room_user', { room_id: rid, tiktok_user_id, ...(comment_msg_id ? { comment_msg_id } : {}) }),
    x => ({ ...x, banned: [{ user_id: tiktok_user_id, name }, ...x.banned.filter(m => m.user_id !== tiktok_user_id)] }), `Kicked ${name || tiktok_user_id}`);

  const UserRow = (p: { u: RoomUser; sub: string; action: string; onClick: () => void; muted?: boolean }) => (
    <div className="tn-between tn-rowline" style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span>{p.u.name || 'User ' + p.u.user_id.slice(-6)}</span><span className="mono" style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{p.sub}</span></div>
      <button className="btn btn-ghost" onClick={p.onClick} disabled={busy} style={p.muted ? { color: 'var(--color-neutral-400)' } : undefined}>{p.action}</button>
    </div>
  );
  const Head = (p: { title: string; tools: string }) => <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="card-title tn-title-sm">{p.title}</span><span className="tn-card-sub">{p.tools}</span></div>;

  return (
    <Drawer label={`Room moderation for ${at(uid)}`} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="card-kicker">Room moderation</span>
          <span style={{ fontSize: 20, fontFamily: 'var(--font-heading)', fontWeight: 500 }}>{at(uid)}</span>
          <span className="tn-card-sub" style={{ overflowWrap: 'anywhere' }}>room_id {roomId ?? '—'} · anchor_id {anchor.data ?? '…'}</span>
        </div>
        <IconBtn icon="ph-x" title="Close" onClick={onClose} />
      </div>
      {!roomId && <div style={{ color: 'var(--color-neutral-400)' }}>Waiting for the worker to report this room's ID…</div>}
      {(room.isLoading || anchor.isLoading) && roomId && <div style={{ color: 'var(--color-neutral-400)' }}>Loading room state…</div>}
      {(room.error || anchor.error) && <div className="tn-errline">{((room.error ?? anchor.error) as Error).message}<button className="btn btn-secondary" onClick={() => { void anchor.refetch(); void room.refetch(); }}>Retry</button></div>}
      {r && <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="card-title tn-title-sm tn-row-8"><span className="tn-dot" style={{ width: 7, height: 7, background: chat.status === 'open' ? 'var(--color-accent-400)' : 'var(--color-neutral-600)', animation: chat.status === 'open' ? 'tn-pulse 1.6s ease-in-out infinite' : undefined }} />Live chat</span>
            <span className="tn-card-sub">WebcastChatMessage · actions pass comment_msg_id</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 280, overflowY: 'auto' }}>
            {chat.lines.slice(0, 12).map(c => {
              const flagged = words.some(w => c.comment.toLowerCase().includes(w)), gone = mutedIds.has(c.userId) || bannedIds.has(c.userId);
              return (
                <div key={c.id} className="tn-list-row tn-in" style={{ padding: '6px 0', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{at(c.user)} · {ago(c.ts, now)}{flagged && <> · <span style={{ color: 'var(--color-accent-300)' }}>matches filter</span></>}</span>
                    <span style={{ color: flagged ? 'var(--color-accent-300)' : 'var(--color-neutral-200)' }}>{c.comment}</span>
                  </div>
                  {gone ? <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{bannedIds.has(c.userId) ? 'Kicked' : 'Muted'}</span> : (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy} onClick={() => void mute(c.userId, 300, at(c.user), c.id)}>Mute 5m</button>
                      <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--color-neutral-400)' }} disabled={busy} onClick={() => void kick(c.userId, at(c.user), c.id)}>Kick</button>
                    </div>
                  )}
                </div>
              );
            })}
            {chat.lines.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>{chat.status === 'ended' ? 'The stream has ended.' : chat.status === 'error' ? chat.error : 'Waiting for chat messages…'}</span>}
          </div>
        </div>

        <div className="tn-between" style={{ gap: 'var(--space-4)' }}>
          <Head title={r.comments ? 'Comments are on' : 'Comments are off'} tools="toggle_room_comments" />
          <button role="switch" aria-checked={r.comments} aria-label="Room comments" className="tn-switch" disabled={busy} style={{ background: r.comments ? 'var(--color-accent-600)' : 'var(--color-neutral-800)' }}
            onClick={() => void act(() => api.tool(agency.id, 'toggle_room_comments', { room_id: rid, enabled: !r.comments }), x => ({ ...x, comments: !r.comments }), r.comments ? 'Comments turned off' : 'Comments turned on')}>
            <span style={{ transform: `translateX(${r.comments ? 16 : 0}px)` }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Head title="Mute a viewer" tools="mutes-mute_room_user · mutes-unmute_room_user" />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}><input className="input mono" style={{ fontSize: 13 }} placeholder="Numeric user ID" value={form.muteId} onChange={e => set({ muteId: e.target.value })} /><button className="btn btn-secondary" style={{ flex: 'none' }} disabled={busy} onClick={() => { const id = form.muteId.trim(); if (needId('mute', id)) { void mute(id, form.muteDur, ''); set({ muteId: '' }); } }}>Mute</button></div>
          <Seg<Dur> small wrap label="Mute duration" value={form.muteDur} onChange={muteDur => set({ muteDur })} options={MUTE_DURATIONS} />
          {errs.mute && <div className="tn-err">{errs.mute}</div>}
          {r.muted.map(m => <UserRow key={m.user_id} u={m} sub={m.user_id + (m.duration ? ' · ' + m.duration : '')} action="Unmute" onClick={() => void act(() => api.tool(agency.id, 'mutes-unmute_room_user', { room_id: rid, user_id: m.user_id }), x => ({ ...x, muted: x.muted.filter(y => y.user_id !== m.user_id) }), 'Unmuted ' + (m.name || m.user_id))} />)}
          {r.muted.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>No one is muted.</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Head title="Kick a viewer" tools="bans-ban_room_user · bans-unban_room_user" />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}><input className="input mono" style={{ fontSize: 13 }} placeholder="Numeric user ID" value={form.banId} onChange={e => set({ banId: e.target.value })} /><button className="btn btn-secondary" style={{ flex: 'none' }} disabled={busy} onClick={() => { const id = form.banId.trim(); if (needId('ban', id)) { void kick(id, ''); set({ banId: '' }); } }}>Kick</button></div>
          {errs.ban && <div className="tn-err">{errs.ban}</div>}
          {r.banned.map(m => <UserRow key={m.user_id} u={m} sub={m.user_id} action="Unban" onClick={() => void act(() => api.tool(agency.id, 'bans-unban_room_user', { room_id: rid, tiktok_user_id: m.user_id }), x => ({ ...x, banned: x.banned.filter(y => y.user_id !== m.user_id) }), 'Unbanned ' + (m.name || m.user_id))} />)}
          {r.banned.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>No one is banned.</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Head title="Room moderators" tools="moderators-get_room_moderators · add · remove" />
          {r.mods.map(m => <UserRow key={m.user_id} u={m} sub={m.user_id} action="Remove" muted onClick={() => void act(() => api.tool(agency.id, 'moderators-remove_room_moderator', { anchor_id: aid, to_user_id: m.user_id }), x => ({ ...x, mods: x.mods.filter(y => y.user_id !== m.user_id) }), 'Moderator removed')} />)}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}><input className="input mono" style={{ fontSize: 13 }} placeholder="User ID to add" value={form.modId} onChange={e => set({ modId: e.target.value })} /><button className="btn btn-secondary" style={{ flex: 'none' }} disabled={busy} onClick={() => { const id = form.modId.trim(); if (needId('mod', id)) { void act(() => api.tool(agency.id, 'moderators-add_room_moderator', { anchor_id: aid, to_user_id: id }), x => ({ ...x, mods: [...x.mods, { user_id: id, name: '' }] }), 'Moderator added'); set({ modId: '' }); } }}>Add</button></div>
          {errs.mod && <div className="tn-err">{errs.mod}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Head title="Sensitive words" tools="sensitive_words-get · add · delete" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {r.words.map(w => (
              <span key={w.word_id} className="tag tag-neutral" style={{ gap: 6, paddingRight: 4 }}>{w.word}
                <button className="tn-link" title={`Remove ${w.word}`} aria-label={`Remove ${w.word}`} disabled={busy} style={{ display: 'flex', color: 'var(--color-neutral-300)' }}
                  onClick={() => void act(() => api.tool(agency.id, 'sensitive_words-delete_sensitive_word', { room_id: rid, unique_id: uid, word_id: w.word_id }), x => ({ ...x, words: x.words.filter(y => y.word_id !== w.word_id) }), `Removed "${w.word}"`)}><i className="ph ph-x" /></button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}><input className="input" placeholder="Word or phrase" value={form.word} maxLength={50} onChange={e => set({ word: e.target.value })} /><button className="btn btn-secondary" style={{ flex: 'none' }} disabled={busy} onClick={() => {
            const w = form.word.trim();
            if (!w) return setErrs({ word: 'Enter a word or phrase' });
            // Euler returns no id on add; refetch so the new word gets its real word_id
            void act(() => api.tool(agency.id, 'sensitive_words-add_sensitive_word', { room_id: rid, unique_id: uid, word: w }).then(() => room.refetch()), x => x, `Added "${w}" to the filter`);
            set({ word: '' });
          }}>Add</button></div>
          {errs.word && <div className="tn-err">{errs.word}</div>}
        </div>
      </>}
    </Drawer>
  );
}
