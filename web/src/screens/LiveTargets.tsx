import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CAN, FEED_REGIONS, CLOSE_CODES } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { api } from '../lib/api';
import { keys, useConnection, useCreators, useStreamStatus, useTargets, useTargetStats, useTopSenders, type StreamStatus, type Target } from '../lib/data';
import { at, compact, mmss, money, pct } from '../lib/format';
import { trackTarget, untrackTarget } from '../lib/targets';
import { PageHeader } from '../components/Shell';
import { Dot, Empty, ErrorLine, IconBtn } from '../components/ui';
import { AddTargetDialog } from './AddTargetDialog';
import { ModerationDrawer } from './ModerationDrawer';

const closeName = (code: number | null) => CLOSE_CODES.find(c => c[0] === code)?.[1] ?? '';

/** What the worker is doing with this creator's socket, in the dashboard's words. */
export function workerLine(st: StreamStatus | undefined, now: number): { text: string; tone: 'ok' | 'wait' | 'err'; icon: string } {
  if (!st) return { text: 'Waiting for the worker to pick this up', tone: 'wait', icon: 'ph ph-circle-notch' };
  const retry = st.next_retry_at ? ` · retry in ${Math.max(0, Math.round((Date.parse(st.next_retry_at) - now) / 1000))}s` : '';
  switch (st.status) {
    case 'live': return { text: 'Socket open · ingesting', tone: 'ok', icon: 'ph ph-check' };
    case 'connecting': return { text: 'Connecting to wss://ws.eulerstream.com', tone: 'wait', icon: 'ph ph-circle-notch' };
    case 'offline': return { text: `Closed ${st.close_code ?? ''} ${closeName(st.close_code)}${retry}`, tone: 'wait', icon: 'ph ph-moon' };
    case 'backoff': return { text: `Reconnecting after ${st.close_code ?? ''} ${closeName(st.close_code)}${retry}`, tone: 'wait', icon: 'ph ph-arrows-clockwise' };
    case 'auth_error': return { text: `Euler rejected the API key (${st.close_code})${retry}`, tone: 'err', icon: 'ph ph-warning' };
    case 'invalid': return { text: `TikTok rejected this handle (4400 INVALID_OPTIONS)`, tone: 'err', icon: 'ph ph-warning' };
    case 'paused': return { text: 'Paused · Euler Stream is disconnected', tone: 'wait', icon: 'ph ph-pause' };
    default: return { text: 'Stopped', tone: 'wait', icon: 'ph ph-stop' };
  }
}
const toneColor = { ok: 'var(--color-neutral-400)', wait: 'var(--color-neutral-500)', err: 'var(--color-accent-200)' };

export function LiveTargets() {
  const { agency, role, rates, prefs, now, toast } = useAgency();
  const qc = useQueryClient();
  const targets = useTargets(agency.id);
  const status = useStreamStatus(agency.id);
  const stats = useTargetStats(agency.id);
  const leaders = useTopSenders(agency.id);
  const [adding, setAdding] = useState(false);
  const [modFor, setModFor] = useState<Target | null>(null);
  const canTrack = CAN.trackTargets(role);
  const F = (coins: number) => money(coins * rates.coinUsd, prefs.unit, rates);
  const list = targets.data ?? [];

  const remove = async (t: Target) => {
    try { await untrackTarget(agency.id, t.unique_id); toast('Stopped tracking ' + at(t.unique_id)); void qc.invalidateQueries({ queryKey: keys.targets(agency.id) }); }
    catch (e) { toast((e as Error).message); }
  };
  const recheck = async (t: Target) => {
    try { const r = await api.tool(agency.id, 'get_room_id', { unique_id: t.unique_id }); toast(r.is_live ? `${at(t.unique_id)} is live. The worker will connect on its next retry.` : `${at(t.unique_id)} is still offline`); }
    catch (e) { toast((e as Error).message); }
  };

  const ls = leaders.data ?? [];
  const lm = Math.max(1, Number(ls[0]?.coins ?? 0));

  return (
    <>
      <PageHeader title="Live targets" subtitle="Any stream or battle you point TokNomics at, with coin spikes in real time." unit />
      <section className="tn-toolbar">
        <div style={{ color: 'var(--color-neutral-400)' }}>{list.length} streams tracked · live over Euler WebSocket</div>
        {canTrack && <button className="btn btn-primary" onClick={() => setAdding(true)}><i className="ph ph-crosshair" />Add target stream</button>}
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 600px), 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
          {targets.error && <ErrorLine error={targets.error} retry={() => void targets.refetch()} />}
          {list.map(t => {
            const st = status.data?.get(t.unique_id);
            const live = st?.status === 'live';
            const s = stats.data?.get(t.unique_id), opp = t.opponent_unique_id ? stats.data?.get(t.opponent_unique_id) : undefined;
            const series = s?.series ?? Array<number>(28).fill(0), m = Math.max(1, ...series);
            const us = s?.coinsIn ?? 0, them = opp?.coinsIn ?? 0;
            const el = st?.session_started_at ? (now - Date.parse(st.session_started_at)) / 1000 : 0;
            const wl = workerLine(st, now);
            return (
              <div key={t.id} className="card elev-sm tn-card tn-in">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                    <div className="tn-row-8">{live ? <Dot color="var(--color-accent-400)" pulse="fast" /> : <Dot color="var(--color-neutral-600)" />}<span style={{ fontSize: 15 }}>{at(t.unique_id)}</span><span className="tag tag-neutral" style={{ padding: '1px 8px' }}>{t.kind === 'battle' ? 'Battle' : 'Stream'}</span></div>
                    <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{t.label ?? (t.source === 'roster' ? 'Roster creator' : 'Live stream')}</span>
                    <span style={{ fontSize: 11, color: toneColor[wl.tone], display: 'flex', alignItems: 'center', gap: 4 }}><i className={wl.icon} />{wl.text}</span>
                  </div>
                  {live && CAN.moderateRooms(role) && <IconBtn icon="ph-shield-check" title="Moderate room" onClick={() => setModFor(t)} />}
                  {canTrack && <IconBtn icon="ph-x" title="Stop tracking" onClick={() => void remove(t)} />}
                </div>
                {!live && (
                  <div className="tn-panel">
                    <span style={{ color: 'var(--color-neutral-300)' }}>{st?.status === 'paused' ? 'Reconnect Euler Stream on Data source to resume.' : 'Offline. Tracking starts when they go live.'}</span>
                    <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => void recheck(t)}><i className="ph ph-arrows-clockwise" />Check again</button>
                  </div>
                )}
                {live && <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48 }} aria-label="Coins per minute, last 28 minutes" role="img">
                    {series.map((v, i) => <span key={i} style={{ flex: 1, height: pct(v, m), minHeight: 2, background: i === series.length - 1 ? 'var(--color-accent-300)' : 'var(--color-accent-700)', borderRadius: '2px 2px 0 0', transition: 'height .4s' }} />)}
                  </div>
                  <div className="tnum" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                    <div className="tn-kv"><span>Incoming</span><span>{F(us)}</span></div>
                    <div className="tn-kv"><span>Agency out</span><span>{F(s?.agencyOut ?? 0)}</span></div>
                    <div className="tn-kv"><span>Viewers</span><span>{st?.viewer_count?.toLocaleString('en-US') ?? '—'}</span></div>
                  </div>
                  {t.kind === 'battle' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="tnum tn-between" style={{ fontSize: 12 }}>
                        <span style={{ color: 'var(--color-accent-300)' }}>{compact(us)}</span>
                        <span style={{ color: 'var(--color-neutral-500)' }}>{us >= them ? 'Leading' : 'Trailing'} · {mmss(el)}</span>
                        <span style={{ color: 'var(--color-neutral-400)' }}>{compact(them)} {at(t.opponent_unique_id ?? '')}</span>
                      </div>
                      <div className="tn-split"><span style={{ width: us + them ? pct(us, us + them) : '50%', background: 'var(--color-accent-500)', transition: 'width .4s' }} /><span style={{ flex: 1, background: 'var(--color-neutral-700)' }} /></div>
                    </div>
                  ) : (
                    <div className="tn-between" style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}><span>Agency share of volume {us ? Math.round(((s?.agencyOut ?? 0) / us) * 100) : 0}%</span><span style={{ whiteSpace: 'nowrap' }}>{mmss(el)} live</span></div>
                  )}
                </>}
              </div>
            );
          })}
          {!targets.isLoading && list.length === 0 && (
            <div className="card tn-card" style={{ padding: 'var(--space-8)', alignItems: 'flex-start' }}>
              <div className="card-title">No streams tracked</div>
              <p className="card-body">Add any live stream or battle to watch its coin spikes in real time.</p>
              {canTrack && <button className="btn btn-primary" onClick={() => setAdding(true)}><i className="ph ph-crosshair" />Add target stream</button>}
            </div>
          )}
        </div>
        <div className="tn-col">
          <Discover />
          <div className="card elev-sm tn-card">
            <div className="tn-card-head"><div className="card-title">Coin volume leaders</div><span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>Across tracked streams · 24h</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {ls.length === 0 && !leaders.isLoading && <Empty>No gifts in tracked streams yet.</Empty>}
              {ls.map((l, i) => (
                <div key={l.sender_unique_id} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center', padding: '8px 0' }}>
                  <span className="tnum" style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{i + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <span className="tn-row-8">{at(l.sender_unique_id)}{l.is_agency && <span className="tag tag-accent tn-tag-sm">Agency</span>}</span>
                    <span className="tn-bar"><span style={{ width: pct(Number(l.coins), lm), background: l.is_agency ? 'var(--color-accent-500)' : 'var(--color-neutral-600)' }} /></span>
                  </span>
                  <span className="tnum" style={{ color: 'var(--color-neutral-200)' }}>{F(Number(l.coins))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      {adding && <AddTargetDialog onClose={() => setAdding(false)} />}
      {modFor && <ModerationDrawer target={modFor} onClose={() => setModFor(null)} />}
    </>
  );
}

function Discover() {
  const { agency, role, toast } = useAgency();
  const qc = useQueryClient();
  const conn = useConnection(agency.id);
  const targets = useTargets(agency.id);
  const creators = useCreators(agency.id);
  const [region, setRegion] = useState<(typeof FEED_REGIONS)[number]>('US');
  const [n, setN] = useState(0);
  const feed = useQuery({
    queryKey: ['live-feed', agency.id, region, n], enabled: conn.data?.status === 'connected', staleTime: 60_000, retry: false,
    queryFn: () => api.tool(agency.id, 'get_live_feed', { region }),
  });
  const tracked = new Set((targets.data ?? []).map(t => t.unique_id));
  const roster = new Set((creators.data ?? []).map(c => c.unique_id));
  const track = async (r: { room_id: string; title: string; creator: { unique_id: string; user_id: string } }) => {
    try {
      await trackTarget({ agencyId: agency.id, handle: r.creator.unique_id, source: 'pin', label: r.title, anchorId: r.creator.user_id });
      void qc.invalidateQueries({ queryKey: keys.targets(agency.id) });
      toast('Tracking ' + at(r.creator.unique_id));
    } catch (e) { toast((e as Error).message); }
  };
  return (
    <div className="card elev-sm tn-card">
      <div className="tn-between">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><div className="card-title">Discover live</div><span className="tn-card-sub">get_live_feed</span></div>
        <div className="tn-row-8" style={{ gap: 6 }}>
          <select className="input" style={{ width: 'auto', minHeight: 30, paddingBlock: 3, fontSize: 13 }} value={region} onChange={e => setRegion(e.target.value as typeof region)} aria-label="Region">{FEED_REGIONS.map(r => <option key={r}>{r}</option>)}</select>
          <button className="btn btn-secondary btn-icon" style={{ width: 30, height: 30 }} onClick={() => setN(x => x + 1)} title="New sample" aria-label="New sample"><i className="ph ph-arrows-clockwise" /></button>
        </div>
      </div>
      {conn.data?.status !== 'connected' && <div style={{ color: 'var(--color-neutral-400)', padding: 'var(--space-3) 0' }}>Connect Euler Stream on Data source to sample live rooms.</div>}
      {feed.isFetching && <div style={{ color: 'var(--color-neutral-500)', padding: 'var(--space-3) 0' }}>Sampling live rooms…</div>}
      {feed.error && <div style={{ color: 'var(--color-neutral-400)', padding: 'var(--space-3) 0' }}>{(feed.error as Error).message}</div>}
      {feed.data && !feed.isFetching && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {(feed.data.rooms ?? []).length === 0 && <Empty>No rooms in this sample.</Empty>}
          {(feed.data.rooms ?? []).slice(0, 10).map(r => (
            <div key={r.room_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 'var(--space-4)', alignItems: 'center', padding: '8px 0' }} className="tn-rowline">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className="tn-row-8" style={{ gap: 6 }}>{at(r.creator.unique_id)}{roster.has(r.creator.unique_id) && <span className="tag tag-accent tn-tag-sm">Roster</span>}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
              </div>
              <span className="tnum" style={{ fontSize: 12, color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: 4 }}><i className="ph ph-eye" />{r.viewer_count.toLocaleString('en-US')}</span>
              {tracked.has(r.creator.unique_id) ? <span style={{ fontSize: 12, color: 'var(--color-neutral-500)', padding: '0 var(--space-1)' }}>Tracking</span>
                : CAN.trackTargets(role) ? <button className="btn btn-ghost" onClick={() => void track(r)}>Track</button> : <span />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
