import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { ROLE_INFO, TIERS } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { useConnection, useStreamStatus, useTargets, useTeams } from '../lib/data';
import { ago, RANGES, type Range, type Unit } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Dot, Seg } from './ui';

export const NAV = [
  ['/overview', 'Overview', 'ph-squares-four'], ['/ledger', 'Gifting ledger', 'ph-receipt'], ['/roster', 'Creator roster', 'ph-users-three'],
  ['/targets', 'Live targets', 'ph-broadcast'], ['/rankings', 'Rankings', 'ph-ranking'], ['/team', 'Team', 'ph-user-gear'],
  ['/source', 'Data source', 'ph-plugs-connected'], ['/billing', 'Plan & billing', 'ph-credit-card'],
] as const;

/** Live ingestion needs only an API key Euler accepted; the OAuth / cookie session (`status`) is for room moderation. */
export function connectionLook(keyStatus: string | undefined) {
  return keyStatus === 'valid' ? { label: 'Connected', dot: 'var(--color-accent-400)', pulse: 'slow' as const }
    : keyStatus === 'invalid' ? { label: 'Key rejected', dot: 'var(--color-accent-200)', pulse: 'fast' as const }
    : { label: 'Not connected', dot: 'var(--color-neutral-600)', pulse: undefined };
}

export function Shell(p: { children: ReactNode }) {
  const { agency, agencies, switchAgency, role, userName, rates, now } = useAgency();
  const targets = useTargets(agency.id);
  const conn = useConnection(agency.id);
  const status = useStreamStatus(agency.id);
  const nav = useNavigate();
  const look = connectionLook(conn.data?.key_status);
  const mine = (targets.data ?? []).map(t => status.data?.get(t.unique_id)).filter(Boolean);
  const events = mine.reduce((a, s) => a + Number(s!.events_ingested ?? 0), 0);
  const last = mine.map(s => s!.last_event_at).filter(Boolean).sort().at(-1) ?? null;
  const barRight = conn.data?.key_status === 'valid'
    ? (last ? `Last event ${ago(last, now)} · ` : 'Waiting for events · ') + events.toLocaleString('en-US') + ' events ingested'
    : conn.data?.key_status === 'invalid' ? 'Euler rejected your API key — ledger and targets are not updating' : 'Live ingestion paused — add your Euler API key to start';

  return (
    <div className="tn-app">
      <div className="tn-texture lighten" aria-hidden />
      <aside className="tn-side">
        <div className="tn-brand">
          <div className="tn-brand-name">TokNomics</div>
          {agencies.length > 1
            ? <select className="tn-agency-select" value={agency.id} onChange={e => switchAgency(e.target.value)} aria-label="Agency">{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            : <div className="tn-brand-sub">{agency.name}</div>}
        </div>
        <nav className="tn-nav">
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => 'tn-nav-btn' + (isActive ? ' is-active' : '')}>
              <i className={'ph ' + icon} /><span>{label}</span>
              {to === '/targets' && (targets.data?.length ?? 0) > 0 && <span className="tag tag-accent tn-badge">{targets.data!.length}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="tn-side-foot">
          <span>Signed in as {userName} · {role === 'viewer' ? 'Viewer' : ROLE_INFO[role].name}</span>
          <button className="btn btn-ghost tn-signout" onClick={() => void supabase.auth.signOut()}>Sign out</button>
          <div>1 coin = ${rates.coinUsd} · 1 diamond = ${rates.diamondUsd}</div>
        </div>
      </aside>
      <main className="tn-main">
        <button className="tn-statusbar" onClick={() => nav('/source')}>
          <span className="tn-row-8"><Dot color={look.dot} pulse={look.pulse} /><span className="tn-text">Euler Stream</span><span>{look.label}</span><span className="tag tag-neutral tn-tag-sm">API key</span></span>
          <span className="tn-statusbar-right">{barRight}</span>
          <span className="tn-statusbar-link">Data source<i className="ph ph-caret-right" /></span>
        </button>
        {p.children}
      </main>
    </div>
  );
}

export function PageHeader(p: { title: string; subtitle: string; filters?: boolean; unit?: boolean; children?: ReactNode }) {
  const { prefs, setPrefs, agency } = useAgency();
  const teams = useTeams(agency.id);
  return (
    <header className="tn-header">
      <div className="tn-header-text">
        <h1>{p.title}</h1>
        <p>{p.subtitle}</p>
      </div>
      <div className="tn-header-tools">
        {p.filters && <>
          <select className="input tn-select-sm" value={prefs.teamId} onChange={e => setPrefs({ teamId: e.target.value })} aria-label="Team">
            <option value="all">All teams</option>
            {(teams.data ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="input tn-select-sm" value={prefs.tier} onChange={e => setPrefs({ tier: e.target.value })} aria-label="Tier">
            <option value="all">All tiers</option>
            {TIERS.map(t => <option key={t} value={t}>Tier {t}</option>)}
          </select>
          <Seg<Range> label="Date range" value={prefs.range} onChange={range => setPrefs({ range })} options={(Object.keys(RANGES) as Range[]).map(r => [r, r] as const)} />
        </>}
        {p.unit && <Seg<Unit> label="Unit" value={prefs.unit} onChange={unit => setPrefs({ unit })} options={[['usd', 'USD'], ['coins', 'Coins'], ['diamonds', 'Diamonds']]} />}
        {p.children}
      </div>
    </header>
  );
}
