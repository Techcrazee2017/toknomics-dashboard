import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Role } from '@toknomics/shared';
import type { Agency } from './data';
import type { Range, Rates, Unit } from './format';

export type Prefs = { unit: Unit; range: Range; teamId: string; tier: string };
const PREFS_KEY = 'tn.prefs';
const defaults: Prefs = { unit: 'usd', range: '7d', teamId: 'all', tier: 'all' };

type Ctx = {
  agency: Agency; role: Role; userTeamId: string | null; userName: string; agencies: Agency[];
  switchAgency: (id: string) => void;
  rates: Rates; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void;
  toast: (msg: string) => void;
  /** Wall clock that ticks every second for "ago" labels and live timers. */
  now: number;
};
const AgencyCtx = createContext<Ctx | null>(null);

export function useAgency(): Ctx {
  const c = useContext(AgencyCtx);
  if (!c) throw new Error('useAgency outside AgencyProvider');
  return c;
}

function loadPrefs(): Prefs {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }; } catch { return defaults; }
}

export function AgencyProvider(props: { agency: Agency; role: Role; userTeamId: string | null; userName: string; agencies: Agency[]; switchAgency: (id: string) => void; children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(() => {
    const p = loadPrefs();
    // Managers and moderators open on their own team's roster
    return props.userTeamId && p.teamId === 'all' ? { ...p, teamId: props.userTeamId } : p;
  });
  const [toastMsg, setToast] = useState('');
  const [now, setNow] = useState(Date.now());
  const tt = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const setPrefs = useCallback((p: Partial<Prefs>) => setPrefsState(s => {
    const n = { ...s, ...p };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(n)); } catch { /* storage unavailable: prefs stay in memory */ }
    return n;
  }), []);
  const toast = useCallback((m: string) => { clearTimeout(tt.current); setToast(m); tt.current = setTimeout(() => setToast(''), 2600); }, []);

  const value = useMemo<Ctx>(() => ({
    agency: props.agency, role: props.role, userTeamId: props.userTeamId, userName: props.userName, agencies: props.agencies, switchAgency: props.switchAgency,
    rates: { coinUsd: Number(props.agency.coin_usd), diamondUsd: Number(props.agency.diamond_usd), cutPct: Number(props.agency.agency_cut_pct) },
    prefs, setPrefs, toast, now,
  }), [props.agency, props.role, props.userTeamId, props.userName, props.agencies, props.switchAgency, prefs, setPrefs, toast, now]);

  return (
    <AgencyCtx.Provider value={value}>
      {props.children}
      {toastMsg && <div className="tn-toast" role="status"><i className="ph ph-check-circle" />{toastMsg}</div>}
    </AgencyCtx.Provider>
  );
}
