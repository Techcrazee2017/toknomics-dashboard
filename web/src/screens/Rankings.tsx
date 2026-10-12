import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CAN, LEAGUES, RANK_NAMES, type RankName } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { api } from '../lib/api';
import { useConnection, useCreators, useTargets } from '../lib/data';
import { at } from '../lib/format';
import { PageHeader } from '../components/Shell';
import { Seg } from '../components/ui';
import { AddTargetDialog } from './AddTargetDialog';

export function Rankings() {
  const { agency, role } = useAgency();
  const conn = useConnection(agency.id);
  const creators = useCreators(agency.id);
  const targets = useTargets(agency.id);
  const connected = conn.data?.status === 'connected';
  const [region, setRegion] = useState('US');
  const [rank, setRank] = useState<RankName>('DAILY_RANK');
  const [league, setLeague] = useState<(typeof LEAGUES)[number]>('A1');
  const [date, setDate] = useState('');
  const [trackHandle, setTrackHandle] = useState<string | null>(null);

  const catalog = useQuery({ queryKey: ['rk-catalog', agency.id], enabled: connected, staleTime: 3_600_000, retry: false, queryFn: () => api.tool(agency.id, 'rankings-get_leaderboard_catalog', {}) });
  const cur = catalog.data?.regions.find(r => r.region === region);
  const effRank: RankName = cur && !cur.rank_names.includes(rank) ? 'DAILY_RANK' : rank;
  const args = { region, rank_name: effRank, ...(effRank === 'RANKING_LEAGUE' ? { league } : {}), ...(date ? { date } : {}) };
  const board = useQuery({ queryKey: ['rk-board', agency.id, args], enabled: connected && !!catalog.data, retry: false, staleTime: 60_000, queryFn: () => api.tool(agency.id, 'rankings-get_leaderboard', args) });

  const roster = new Set((creators.data ?? []).map(c => c.unique_id));
  const tracked = new Set((targets.data ?? []).map(t => t.unique_id));
  const rows = board.data?.ranks ?? [];
  const onBoard = rows.filter(r => roster.has(r.unique_id));
  const regions = catalog.data?.regions.map(r => r.region).sort((a, b) => (a === 'WW' ? -1 : b === 'WW' ? 1 : a.localeCompare(b))) ?? ['US'];
  const loading = catalog.isFetching || board.isFetching;
  const err = (catalog.error ?? board.error) as Error | null;

  return (
    <>
      <PageHeader title="Rankings" subtitle="TikTok LIVE leaderboards by region. Your roster is highlighted, so you can see whose rank needs defending." />
      <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
        <select className="input tn-select-sm" value={region} onChange={e => setRegion(e.target.value)} aria-label="Region">{regions.map(r => <option key={r} value={r}>{r === 'WW' ? 'Worldwide' : r}</option>)}</select>
        <Seg<RankName> label="Board" value={effRank} onChange={setRank} options={RANK_NAMES} disabled={v => !!cur && !cur.rank_names.includes(v)} />
        {effRank === 'RANKING_LEAGUE' && <select className="input tn-select-sm" value={league} onChange={e => setLeague(e.target.value as typeof league)} aria-label="League">{(cur?.leagues.filter(l => l !== 'NONE') ?? LEAGUES).map(l => <option key={l} value={l}>League {l}</option>)}</select>}
        <input className="input tn-select-sm" type="date" style={{ colorScheme: 'dark' }} value={date} max={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} aria-label="Snapshot date" />
        {date && <button className="btn btn-ghost" onClick={() => setDate('')}>Latest</button>}
        <span className="tnum" style={{ marginLeft: 'auto', color: 'var(--color-neutral-400)' }}>{board.data && !loading ? `Top ${rows.length} · ${board.data.date ?? date ?? 'latest snapshot'}${board.data.is_latest ? ' (latest)' : ''}` : ''}</span>
      </section>
      {board.data && !loading && (onBoard.length > 0
        ? <div className="tn-row-8" style={{ alignItems: 'baseline', color: 'var(--color-neutral-200)' }}><i className="ph ph-shield-star" style={{ color: 'var(--color-accent)' }} />{onBoard.length} of your creators on this board: {onBoard.map(r => `${at(r.unique_id)} #${r.rank}`).join(', ')}</div>
        : <div style={{ color: 'var(--color-neutral-400)' }}>None of your creators are on this board.</div>)}
      <div className="card elev-sm tn-card flush">
        {!connected && <div style={{ padding: 'var(--space-8) 0', color: 'var(--color-neutral-400)' }}>Connect Euler Stream on Data source to load leaderboards.</div>}
        {connected && loading && <div style={{ padding: 'var(--space-8) 0', color: 'var(--color-neutral-400)' }}>Fetching <span className="mono">rankings-get_leaderboard</span>…</div>}
        {connected && err && !loading && <div className="tn-errline" style={{ padding: 'var(--space-8) 0' }}>{err.message}<button className="btn btn-secondary" onClick={() => { void catalog.refetch(); void board.refetch(); }}>Retry</button></div>}
        {board.data && !loading && !err && (
          <div className="tn-scroll-x">
            <table className="table tnum" style={{ minWidth: 560 }}>
              <thead><tr><th style={{ width: 64 }}>Rank</th><th>Creator</th><th style={{ textAlign: 'right' }}>Score</th><th style={{ width: 120 }} /></tr></thead>
              <tbody>
                {rows.map(r => {
                  const isR = roster.has(r.unique_id);
                  return (
                    <tr key={r.rank + r.unique_id}>
                      <td style={{ color: isR ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>#{r.rank}</td>
                      <td><div className="tn-row-8"><div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><span>{at(r.unique_id)}</span><span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{r.nickname}</span></div>{isR && <span className="tag tag-accent">Your roster</span>}</div></td>
                      <td style={{ textAlign: 'right' }}>{r.score.toLocaleString('en-US')}</td>
                      <td style={{ textAlign: 'right' }}>
                        {tracked.has(r.unique_id) ? <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>Tracking</span>
                          : CAN.trackTargets(role) && <button className="btn btn-ghost" onClick={() => setTrackHandle(r.unique_id)}><i className="ph ph-crosshair" />Track</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <div className="tn-empty">This board is empty for the selected snapshot.</div>}
          </div>
        )}
      </div>
      {trackHandle && <AddTargetDialog initialHandle={'@' + trackHandle} initialKind="stream" onClose={() => setTrackHandle(null)} />}
    </>
  );
}
