// P&L derivations shared by Overview, Roster and the creator drawer.
// Net profit = (creator diamonds × diamond $ × agency cut) − (coins gifted to creator × coin $)
import { useMemo } from 'react';
import { useAgency } from './agency';
import { RANGES } from './format';
import { useCreatorStats, useCreators, useTeams, type Creator } from './data';

export type CreatorPL = { c: Creator; team: string; invest: number; comm: number; net: number; diamonds: number; gifts: number };

export function useWindow() {
  const { prefs, now } = useAgency();
  // Round to the minute so query keys stay stable between ticks
  const to = Math.ceil(now / 60_000) * 60_000;
  return useMemo(() => {
    const r = RANGES[prefs.range];
    return { from: new Date(to - r.days * 86_400_000).toISOString(), to: new Date(to).toISOString(), ...r };
  }, [to, prefs.range]);
}

export function useRosterPL() {
  const { agency, rates, prefs } = useAgency();
  const w = useWindow();
  const creators = useCreators(agency.id);
  const teams = useTeams(agency.id);
  const stats = useCreatorStats(agency.id, w.from, w.to);

  return useMemo(() => {
    const teamName = new Map((teams.data ?? []).map(t => [t.id, t.name]));
    const all = creators.data ?? [];
    const filtered = all.filter(c => (prefs.teamId === 'all' || c.team_id === prefs.teamId) && (prefs.tier === 'all' || c.tier === prefs.tier));
    const cut = rates.cutPct / 100;
    const rows: CreatorPL[] = filtered.map(c => {
      const s = stats.data?.get(c.unique_id);
      const invest = (s?.invested_coins ?? 0) * rates.coinUsd;
      const diamonds = s?.received_diamonds ?? 0;
      const comm = diamonds * rates.diamondUsd * cut;
      return { c, team: c.team_id ? teamName.get(c.team_id) ?? 'No team' : 'No team', invest, comm, net: comm - invest, diamonds, gifts: s?.agency_gifts ?? 0 };
    });
    const totals = rows.reduce((a, x) => ({ invest: a.invest + x.invest, comm: a.comm + x.comm, gifts: a.gifts + x.gifts }), { invest: 0, comm: 0, gifts: 0 });
    const isFiltered = prefs.teamId !== 'all' || prefs.tier !== 'all';
    return {
      rows, totals, net: totals.comm - totals.invest, inProfit: rows.filter(x => x.net >= 0).length,
      creatorIds: isFiltered ? filtered.map(c => c.unique_id) : null,
      // The same roster the KPI tiles cover. The Overview chart uses this: `creatorIds: null` would also sum battle opponents' diamonds as commission.
      rosterIds: filtered.map(c => c.unique_id),
      loading: creators.isLoading || stats.isLoading, error: creators.error ?? stats.error,
      teamName, window: w,
    };
  }, [creators.data, creators.isLoading, creators.error, teams.data, stats.data, stats.isLoading, stats.error, prefs.teamId, prefs.tier, rates, w]);
}
