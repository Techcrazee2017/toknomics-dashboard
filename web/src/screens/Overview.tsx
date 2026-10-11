import { Link } from 'react-router';
import { useAgency } from '../lib/agency';
import { useBurnSeries, useLedger } from '../lib/data';
import { useRosterPL } from '../lib/derive';
import { ago, at, money, mono, pct, roi, signed } from '../lib/format';
import { PageHeader } from '../components/Shell';
import { Avatar, Empty, ErrorLine } from '../components/ui';
import { useCreatorDrawer } from './CreatorDrawer';

export function Overview() {
  const { agency, rates, prefs, now } = useAgency();
  const pl = useRosterPL();
  const w = pl.window;
  const series = useBurnSeries(agency.id, w.from, w.to, w.buckets, pl.creatorIds);
  const feed = useLedger(agency.id, { from: new Date(Date.parse(w.to) - 30 * 86_400_000).toISOString(), to: w.to, creators: pl.creatorIds, purpose: null, query: '', limit: 7 });
  const openCreator = useCreatorDrawer();
  const F = (v: number) => money(v, prefs.unit, rates);
  const Fs = (v: number) => signed(v, prefs.unit, rates);
  const cut = rates.cutPct / 100;

  const stats = [
    { label: 'Total burn', icon: 'ph-fire', value: F(pl.totals.invest), note: `${pl.totals.gifts} gifts sent, ${w.label}` },
    { label: 'Commission generated', icon: 'ph-arrow-down-left', value: F(pl.totals.comm), note: `${rates.cutPct}% agency cut of creator earnings` },
    { label: 'Total net revenue', icon: 'ph-scales', value: Fs(pl.net), note: pl.totals.invest ? `ROI ${roi(pl.net, pl.totals.invest)} on gifting spend` : 'No spend in range' },
    { label: 'Creators in profit', icon: 'ph-users-three', value: `${pl.inProfit} / ${pl.rows.length}`, note: `${pl.rows.length - pl.inProfit} running at a loss` },
  ];

  const bw = (Date.parse(w.to) - Date.parse(w.from)) / w.buckets;
  const buckets = (series.data ?? []).map(b => ({ i: b.bucket, burn: Number(b.invested_coins) * rates.coinUsd, comm: Number(b.received_diamonds) * rates.diamondUsd * cut }));
  const mx = Math.max(1e-9, ...buckets.flatMap(b => [b.burn, b.comm]));
  const label = (i: number) => {
    const d = new Date(Date.parse(w.from) + (i + 0.5) * bw);
    return prefs.range === '24h' ? String(d.getHours()).padStart(2, '0') + ':00' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const showLabel = (i: number) => (prefs.range === '24h' ? i % 6 === 0 : prefs.range === '30d' ? i % 3 === 0 : true);

  const top = [...pl.rows].sort((a, b) => b.invest - a.invest).slice(0, 5);
  const topMax = Math.max(1e-9, top[0]?.invest ?? 0);
  const byTeam = [...new Set(pl.rows.map(r => r.team))].sort().map(team => {
    const xs = pl.rows.filter(r => r.team === team);
    const i = xs.reduce((a, x) => a + x.invest, 0), c = xs.reduce((a, x) => a + x.comm, 0);
    return { team, count: xs.length, invest: i, comm: c, net: c - i };
  });

  return (
    <>
      <PageHeader title="Agency overview" subtitle="Every coin your accounts gifted, against the commission it returned." filters unit />
      {pl.error && <ErrorLine error={pl.error} />}
      <section className="tn-grid-stats">
        {stats.map(s => (
          <div key={s.label} className="card elev-sm tn-card gap-3">
            <div className="tn-between"><span className="card-kicker">{s.label}</span><i className={'ph ' + s.icon} style={{ fontSize: 18, color: 'var(--color-neutral-500)' }} /></div>
            <div className="tn-stat-value">{pl.loading ? '—' : s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>{s.note}</div>
          </div>
        ))}
      </section>

      <section className="tn-grid-2 stretch">
        <div className="card elev-sm tn-card gap-6">
          <div className="tn-card-head">
            <div className="card-title">Burn vs. commission</div>
            <div className="tn-legend"><span><i style={{ background: 'var(--color-neutral-700)' }} />Agency burn</span><span><i style={{ background: 'var(--color-accent-500)' }} />Commission</span></div>
          </div>
          <div className="tn-chart" role="img" aria-label={`Burn ${F(pl.totals.invest)} vs commission ${F(pl.totals.comm)}, ${w.label}`}>
            {buckets.map(b => (
              <div key={b.i} className="tn-chart-col" title={`${label(b.i)} — burn ${F(b.burn)}, commission ${F(b.comm)}`}>
                <span style={{ height: pct(b.burn, mx), background: 'var(--color-neutral-700)' }} />
                <span style={{ height: pct(b.comm, mx), background: 'var(--color-accent-500)' }} />
              </div>
            ))}
          </div>
          <div className="tn-chart-labels">{buckets.map(b => <span key={b.i}>{showLabel(b.i) ? label(b.i) : ''}</span>)}</div>
        </div>

        <div className="card elev-sm tn-card">
          <div className="tn-between"><div className="card-title">Top supported creators</div><Link className="btn btn-ghost" to="/roster">Roster<i className="ph ph-arrow-right" /></Link></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {top.length === 0 && !pl.loading && <Empty>No creators on the roster yet. <Link to="/roster">Add one</Link>.</Empty>}
            {top.map((x, i) => (
              <button key={x.c.id} className="tn-hoverrow tn-top-row" onClick={() => openCreator(x.c.unique_id)}>
                <span className="tnum" style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{i + 1}</span>
                <Avatar text={mono(x.c.unique_id)} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <span className="tn-between"><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{at(x.c.unique_id)}</span><span className="tnum" style={{ color: 'var(--color-neutral-300)' }}>{F(x.invest)}</span></span>
                  <span className="tn-bar"><span style={{ width: pct(x.invest, topMax) }} /></span>
                </span>
                <span className={x.net >= 0 ? 'tag tag-accent tnum' : 'tag tag-neutral tnum'} style={{ minWidth: 72, justifyContent: 'center' }}>{Fs(x.net)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="tn-grid-2 stretch">
        <div className="card elev-sm tn-card">
          <div className="card-title">Roster breakdown by team</div>
          <div className="tn-scroll-x">
            <table className="table tnum">
              <thead><tr><th>Team</th><th style={{ textAlign: 'right' }}>Creators</th><th style={{ textAlign: 'right' }}>Invested</th><th style={{ textAlign: 'right' }}>Commission</th><th style={{ textAlign: 'right' }}>Net</th></tr></thead>
              <tbody>
                {byTeam.map(t => (
                  <tr key={t.team}><td>{t.team}</td><td style={{ textAlign: 'right' }}>{t.count}</td><td style={{ textAlign: 'right' }}>{F(t.invest)}</td><td style={{ textAlign: 'right' }}>{F(t.comm)}</td>
                    <td style={{ textAlign: 'right', color: t.net >= 0 ? 'var(--color-accent-300)' : 'var(--color-neutral-300)' }}>{Fs(t.net)}</td></tr>
                ))}
              </tbody>
            </table>
            {byTeam.length === 0 && !pl.loading && <Empty>No creators match these filters.</Empty>}
          </div>
        </div>

        <div className="card elev-sm tn-card">
          <div className="tn-between">
            <div className="card-title tn-row-8"><span className="tn-dot" style={{ width: 8, height: 8, background: 'var(--color-accent-400)', animation: 'tn-pulse 2.4s ease-in-out infinite' }} />Live gift feed</div>
            <Link className="btn btn-ghost" to="/ledger">Ledger<i className="ph ph-arrow-right" /></Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {feed.error && <ErrorLine error={feed.error} retry={() => void feed.refetch()} />}
            {feed.data?.length === 0 && <Empty>No agency gifts yet. Add your gifter accounts on Data source.</Empty>}
            {(feed.data ?? []).map(e => (
              <div key={e.id} className="tn-list-row tn-in">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <div className="tn-row-8" style={{ gap: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    <span style={{ color: 'var(--color-neutral-400)' }}>{at(e.sender_unique_id)}</span>
                    <i className="ph ph-arrow-right" style={{ color: 'var(--color-neutral-600)', fontSize: 12 }} />
                    <button className="tn-link" onClick={() => openCreator(e.creator_unique_id)}>{at(e.creator_unique_id)}</button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{e.gift_name ?? `Gift ${e.gift_id}`} × {e.repeat_count} · {ago(e.occurred_at, now)}</div>
                </div>
                <div className="tnum" style={{ color: 'var(--color-neutral-200)' }}>{F(e.coins * rates.coinUsd)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
