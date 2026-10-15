// Read models. Every query runs with the user's JWT, so RLS decides what comes back.
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { PlanKey, Purpose, Role, Tier } from '@toknomics/shared';
import { supabase } from './supabase';
import { dbError } from './api';

export type Agency = { id: string; name: string; agency_cut_pct: number; coin_usd: number; diamond_usd: number; plan: PlanKey; subscription_status: string | null; plan_renews_at: string | null };
export type Membership = { agency_id: string; role: Role; team_id: string | null; agencies: Agency };
export type Team = { id: string; name: string };
export type Creator = { id: string; unique_id: string; display_name: string | null; team_id: string | null; tier: Tier };
export type Target = { id: string; unique_id: string; kind: 'stream' | 'battle'; opponent_unique_id: string | null; anchor_id: string | null; label: string | null; source: string; created_at: string };
export type StreamStatus = { unique_id: string; status: string; room_id: string | null; close_code: number | null; last_error: string | null; last_event_at: string | null; next_retry_at: string | null; viewer_count: number | null; connected_at: string | null; session_started_at: string | null; events_ingested: number };
export type Connection = { agency_id: string; mode: 'oauth' | 'cookie'; host: string; status: 'disconnected' | 'authorizing' | 'connected'; api_key_last4: string | null; has_cookie: boolean; pinned_user_id: string | null; account_label: string | null; connected_at: string | null; euler_account_id: number | null; key_status: 'unknown' | 'valid' | 'invalid'; cookie_ack_at: string | null };
export type CreatorStat = { creator_unique_id: string; invested_coins: number; received_diamonds: number; agency_gifts: number };
export type LedgerRow = { id: number; occurred_at: string; sender_unique_id: string; creator_unique_id: string; gift_id: number; gift_name: string | null; repeat_count: number; coins: number; purpose: Purpose | null; total_count: number; total_coins: number };
export type Member = { user_id: string; role: Role; team_id: string | null; status: 'invited' | 'active'; email: string; full_name: string | null; last_seen_at: string | null };
export type Call = { id: number; tool: string; args: Record<string, unknown>; ok: boolean; ms: number; auth: string | null; error: string | null; created_at: string };
export type CatalogGift = { gift_id: number; name: string; diamond_count: number; synced_at: string };

async function rows<T>(q: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw dbError(error);
  return data as T;
}

const k = {
  memberships: ['memberships'] as const,
  agency: (a: string) => ['agency', a] as const,
  teams: (a: string) => ['teams', a] as const,
  creators: (a: string) => ['creators', a] as const,
  accounts: (a: string) => ['accounts', a] as const,
  targets: (a: string) => ['targets', a] as const,
  status: (a: string) => ['status', a] as const,
  connection: (a: string) => ['connection', a] as const,
  stats: (a: string) => ['stats', a] as const,
  ledger: (a: string) => ['ledger', a] as const,
  members: (a: string) => ['members', a] as const,
  calls: (a: string) => ['calls', a] as const,
  catalog: ['catalog'] as const,
};
export const keys = k;

export const useMemberships = (userId: string | undefined) => useQuery({
  queryKey: k.memberships, enabled: !!userId,
  queryFn: () => rows<Membership[]>(supabase.from('agency_members')
    .select('agency_id, role, team_id, agencies(id, name, agency_cut_pct, coin_usd, diamond_usd, plan, subscription_status, plan_renews_at)')
    .eq('user_id', userId!)),
});

export const useTeams = (a: string) => useQuery({ queryKey: k.teams(a), queryFn: () => rows<Team[]>(supabase.from('teams').select('id, name').eq('agency_id', a).order('name')) });
export const useCreators = (a: string) => useQuery({ queryKey: k.creators(a), queryFn: () => rows<Creator[]>(supabase.from('creators').select('id, unique_id, display_name, team_id, tier').eq('agency_id', a).order('unique_id')) });
export const useAccounts = (a: string) => useQuery({ queryKey: k.accounts(a), queryFn: () => rows<{ unique_id: string; label: string | null }[]>(supabase.from('agency_accounts').select('unique_id, label').eq('agency_id', a).order('unique_id')) });
export const useTargets = (a: string) => useQuery({
  queryKey: k.targets(a),
  queryFn: () => rows<Target[]>(supabase.from('tracked_targets').select('id, unique_id, kind, opponent_unique_id, anchor_id, label, source, created_at').eq('agency_id', a).eq('active', true).order('created_at', { ascending: false })),
});
export const useStreamStatus = (a: string) => useQuery({
  queryKey: k.status(a),
  queryFn: async () => {
    const list = await rows<StreamStatus[]>(supabase.from('stream_status').select('*').eq('agency_id', a));
    return new Map(list.map(s => [s.unique_id, s]));
  },
});
export const useConnection = (a: string) => useQuery({
  queryKey: k.connection(a),
  queryFn: () => rows<Connection | null>(supabase.from('euler_connections').select('*').eq('agency_id', a).maybeSingle()),
});

export const useCreatorStats = (a: string, from: string, to: string) => useQuery({
  queryKey: [...k.stats(a), 'creator', from, to] as QueryKey, placeholderData: p => p,
  queryFn: async () => {
    const list = await rows<CreatorStat[]>(supabase.rpc('creator_stats', { p_agency: a, p_from: from, p_to: to }));
    return new Map(list.map(s => [s.creator_unique_id, { ...s, invested_coins: Number(s.invested_coins), received_diamonds: Number(s.received_diamonds) }]));
  },
});
export const useBurnSeries = (a: string, from: string, to: string, buckets: number, creators: string[] | null) => useQuery({
  queryKey: [...k.stats(a), 'series', from, to, buckets, creators] as QueryKey, placeholderData: p => p,
  queryFn: () => rows<{ bucket: number; invested_coins: number; received_diamonds: number }[]>(supabase.rpc('burn_series', { p_agency: a, p_from: from, p_to: to, p_buckets: buckets, p_creators: creators })),
});
export type LedgerParams = { from: string; to: string; creators: string[] | null; purpose: string | null; query: string; limit: number };
export const useLedger = (a: string, p: LedgerParams) => useQuery({
  queryKey: [...k.ledger(a), p] as QueryKey, placeholderData: prev => prev,
  queryFn: () => fetchLedger(a, p, 0),
});
export const fetchLedger = (a: string, p: LedgerParams, offset: number) =>
  rows<LedgerRow[]>(supabase.rpc('ledger_page', { p_agency: a, p_from: p.from, p_to: p.to, p_creators: p.creators, p_purpose: p.purpose, p_query: p.query || null, p_limit: p.limit, p_offset: offset }));

export const useTopSenders = (a: string) => useQuery({
  queryKey: [...k.stats(a), 'senders'] as QueryKey,
  queryFn: () => rows<{ sender_unique_id: string; coins: number; is_agency: boolean }[]>(supabase.rpc('top_senders', { p_agency: a, p_since: new Date(Date.now() - 86_400_000).toISOString(), p_limit: 6 })),
});
export const useTargetStats = (a: string) => useQuery({
  queryKey: [...k.stats(a), 'targets'] as QueryKey, refetchInterval: 15_000,
  queryFn: async () => {
    const list = await rows<{ unique_id: string; coins_in: number; agency_out: number; series: number[] }[]>(supabase.rpc('target_stats', { p_agency: a }));
    return new Map(list.map(s => [s.unique_id, { coinsIn: Number(s.coins_in), agencyOut: Number(s.agency_out), series: s.series.map(Number) }]));
  },
});
export const useGiftUsage = (a: string) => useQuery({
  queryKey: [...k.stats(a), 'gift-usage'] as QueryKey,
  queryFn: async () => new Map((await rows<{ gift_id: number; sends: number }[]>(supabase.rpc('gift_usage', { p_agency: a }))).map(g => [g.gift_id, Number(g.sends)])),
});
export const useCatalog = () => useQuery({
  queryKey: k.catalog,
  queryFn: () => rows<CatalogGift[]>(supabase.from('gift_catalog').select('gift_id, name, diamond_count, synced_at').order('diamond_count').limit(2000)),
});
export const useCalls = (a: string) => useQuery({
  queryKey: k.calls(a),
  queryFn: () => rows<Call[]>(supabase.from('euler_calls').select('id, tool, args, ok, ms, auth, error, created_at').eq('agency_id', a).order('created_at', { ascending: false }).limit(10)),
});
export const useMembers = (a: string) => useQuery({
  queryKey: k.members(a),
  queryFn: async () => {
    const ms = await rows<{ user_id: string; role: Role; team_id: string | null; status: 'invited' | 'active'; created_at: string }[]>(
      supabase.from('agency_members').select('user_id, role, team_id, status, created_at').eq('agency_id', a).order('created_at'));
    const ps = ms.length ? await rows<{ user_id: string; email: string; full_name: string | null; last_seen_at: string | null }[]>(
      supabase.from('profiles').select('user_id, email, full_name, last_seen_at').in('user_id', ms.map(m => m.user_id))) : [];
    const byId = new Map(ps.map(p => [p.user_id, p]));
    return ms.map(m => ({ ...m, email: byId.get(m.user_id)?.email ?? '', full_name: byId.get(m.user_id)?.full_name ?? null, last_seen_at: byId.get(m.user_id)?.last_seen_at ?? null })) as Member[];
  },
});

/**
 * One realtime channel per agency. Gift inserts arrive in bursts during battles, so stats/ledger
 * invalidations are coalesced to at most one refetch every 2 seconds.
 */
export function useAgencyRealtime(a: string) {
  const qc = useQueryClient();
  const pending = useRef(new Set<string>());
  useEffect(() => {
    const flushAfter = 2000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = (...names: string[]) => {
      names.forEach(n => pending.current.add(n));
      timer ??= setTimeout(() => {
        for (const n of pending.current) void qc.invalidateQueries({ queryKey: [n, a] });
        pending.current.clear();
        timer = undefined;
      }, flushAfter);
    };
    const ch = supabase.channel(`agency:${a}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gift_transactions', filter: `agency_id=eq.${a}` }, () => bump('stats', 'ledger'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gift_purposes', filter: `agency_id=eq.${a}` }, () => bump('ledger', 'stats'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracked_targets', filter: `agency_id=eq.${a}` }, () => bump('targets', 'status', 'stats'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_status', filter: `agency_id=eq.${a}` }, () => bump('status', 'stats'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creators', filter: `agency_id=eq.${a}` }, () => bump('creators'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'euler_connections', filter: `agency_id=eq.${a}` }, () => void qc.invalidateQueries({ queryKey: k.connection(a) }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'euler_calls', filter: `agency_id=eq.${a}` }, () => void qc.invalidateQueries({ queryKey: k.calls(a) }))
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
  }, [a, qc]);
}
