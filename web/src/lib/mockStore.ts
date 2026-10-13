// In-memory mock store and data provider for preview/demo mode when Supabase is not configured.
import type { Session } from '@supabase/supabase-js';
import type { Purpose, Role, Tier } from '@toknomics/shared';

export const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface MockAgency {
  id: string;
  name: string;
  agency_cut_pct: number;
  coin_usd: number;
  diamond_usd: number;
  plan: 'starter' | 'growth' | 'scale';
  subscription_status: string | null;
  plan_renews_at: string | null;
}

export interface MockTeam {
  id: string;
  agency_id: string;
  name: string;
}

export interface MockCreator {
  id: string;
  agency_id: string;
  unique_id: string;
  display_name: string | null;
  team_id: string | null;
  tier: Tier;
}

export interface MockTarget {
  id: string;
  agency_id: string;
  unique_id: string;
  kind: 'stream' | 'battle';
  opponent_unique_id: string | null;
  anchor_id: string | null;
  label: string | null;
  source: string;
  active: boolean;
  created_at: string;
}

export interface MockStreamStatus {
  unique_id: string;
  status: string;
  room_id: string | null;
  close_code: number | null;
  last_error: string | null;
  last_event_at: string | null;
  next_retry_at: string | null;
  viewer_count: number | null;
  connected_at: string | null;
  session_started_at: string | null;
  events_ingested: number;
}

export interface MockConnection {
  agency_id: string;
  mode: 'oauth' | 'cookie';
  host: string;
  status: 'disconnected' | 'authorizing' | 'connected';
  api_key_last4: string | null;
  has_cookie: boolean;
  pinned_user_id: string | null;
  account_label: string | null;
  connected_at: string | null;
  euler_account_id: number | null;
}

export interface MockMember {
  user_id: string;
  agency_id: string;
  role: Role;
  team_id: string | null;
  status: 'invited' | 'active';
  created_at: string;
}

export interface MockProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  last_seen_at: string | null;
}

export interface MockCatalogGift {
  gift_id: number;
  name: string;
  diamond_count: number;
  synced_at: string;
}

export interface MockLedgerRow {
  id: number;
  occurred_at: string;
  sender_unique_id: string;
  creator_unique_id: string;
  gift_id: number;
  gift_name: string | null;
  repeat_count: number;
  coins: number;
  purpose: Purpose | null;
  total_count: number;
  total_coins: number;
}

const DEMO_AGENCY_ID = 'agency-northlight';

export const mockAgencies: MockAgency[] = [
  {
    id: DEMO_AGENCY_ID,
    name: 'Northlight Agency',
    agency_cut_pct: 20,
    coin_usd: 0.0133,
    diamond_usd: 0.005,
    plan: 'growth',
    subscription_status: 'active',
    plan_renews_at: '2026-11-01T00:00:00Z',
  },
];

export const mockTeams: MockTeam[] = [
  { id: 'team-nova', agency_id: DEMO_AGENCY_ID, name: 'Team Nova' },
  { id: 'team-atlas', agency_id: DEMO_AGENCY_ID, name: 'Team Atlas' },
  { id: 'team-echo', agency_id: DEMO_AGENCY_ID, name: 'Team Echo' },
];

export const mockCreators: MockCreator[] = [
  { id: 'c-1', agency_id: DEMO_AGENCY_ID, unique_id: 'sora_live', display_name: 'Sora Takahashi', team_id: 'team-nova', tier: 'S' },
  { id: 'c-2', agency_id: DEMO_AGENCY_ID, unique_id: 'marcus_beats', display_name: 'Marcus Vance', team_id: 'team-nova', tier: 'S' },
  { id: 'c-3', agency_id: DEMO_AGENCY_ID, unique_id: 'elena_art', display_name: 'Elena Rostova', team_id: 'team-atlas', tier: 'A' },
  { id: 'c-4', agency_id: DEMO_AGENCY_ID, unique_id: 'kai_gaming', display_name: 'Kai G', team_id: 'team-atlas', tier: 'A' },
  { id: 'c-5', agency_id: DEMO_AGENCY_ID, unique_id: 'chloe_vibes', display_name: 'Chloe Vance', team_id: 'team-echo', tier: 'B' },
  { id: 'c-6', agency_id: DEMO_AGENCY_ID, unique_id: 'leo_pk_king', display_name: 'Leo Martinez', team_id: 'team-echo', tier: 'B' },
  { id: 'c-7', agency_id: DEMO_AGENCY_ID, unique_id: 'zara_style', display_name: 'Zara Chen', team_id: 'team-nova', tier: 'A' },
  { id: 'c-8', agency_id: DEMO_AGENCY_ID, unique_id: 'tariq_tunes', display_name: 'Tariq Owens', team_id: 'team-atlas', tier: 'B' },
];

export const mockAccounts = [
  { agency_id: DEMO_AGENCY_ID, unique_id: 'northlight_mgmt', label: 'HQ Main Gifting' },
  { agency_id: DEMO_AGENCY_ID, unique_id: 'northlight_vip', label: 'VIP Battle Booster' },
];

export const mockTargets: MockTarget[] = [
  { id: 't-1', agency_id: DEMO_AGENCY_ID, unique_id: 'sora_live', kind: 'battle', opponent_unique_id: 'rival_champion', anchor_id: null, label: '100k Diamond Battle', source: 'battle', active: true, created_at: '2026-10-13T10:00:00Z' },
  { id: 't-2', agency_id: DEMO_AGENCY_ID, unique_id: 'marcus_beats', kind: 'stream', opponent_unique_id: null, anchor_id: null, label: 'Night DJ Set', source: 'roster', active: true, created_at: '2026-10-13T09:30:00Z' },
  { id: 't-3', agency_id: DEMO_AGENCY_ID, unique_id: 'elena_art', kind: 'stream', opponent_unique_id: null, anchor_id: null, label: 'Speed Painting Subathon', source: 'roster', active: true, created_at: '2026-10-13T08:15:00Z' },
  { id: 't-4', agency_id: DEMO_AGENCY_ID, unique_id: 'kai_gaming', kind: 'battle', opponent_unique_id: 'pro_gamer_x', anchor_id: null, label: 'Ranked PK Round 3', source: 'battle', active: true, created_at: '2026-10-13T07:45:00Z' },
];

export const mockStreamStatus: MockStreamStatus[] = [
  { unique_id: 'sora_live', status: 'live', room_id: '741298371923', close_code: null, last_error: null, last_event_at: new Date().toISOString(), next_retry_at: null, viewer_count: 1420, connected_at: new Date(Date.now() - 3600000).toISOString(), session_started_at: new Date(Date.now() - 3600000).toISOString(), events_ingested: 3240 },
  { unique_id: 'marcus_beats', status: 'live', room_id: '741298389102', close_code: null, last_error: null, last_event_at: new Date().toISOString(), next_retry_at: null, viewer_count: 890, connected_at: new Date(Date.now() - 5400000).toISOString(), session_started_at: new Date(Date.now() - 5400000).toISOString(), events_ingested: 1820 },
  { unique_id: 'elena_art', status: 'live', room_id: '741298410291', close_code: null, last_error: null, last_event_at: new Date().toISOString(), next_retry_at: null, viewer_count: 650, connected_at: new Date(Date.now() - 1800000).toISOString(), session_started_at: new Date(Date.now() - 1800000).toISOString(), events_ingested: 940 },
  { unique_id: 'kai_gaming', status: 'live', room_id: '741298492019', close_code: null, last_error: null, last_event_at: new Date().toISOString(), next_retry_at: null, viewer_count: 2100, connected_at: new Date(Date.now() - 7200000).toISOString(), session_started_at: new Date(Date.now() - 7200000).toISOString(), events_ingested: 4500 },
];

export const mockConnection: MockConnection = {
  agency_id: DEMO_AGENCY_ID,
  mode: 'oauth',
  host: 'https://api.eulerstream.com',
  status: 'connected',
  api_key_last4: '9a4f',
  has_cookie: false,
  pinned_user_id: '@northlight_mgmt',
  account_label: '@northlight_mgmt (Euler OAuth)',
  connected_at: '2026-10-08T12:00:00Z',
  euler_account_id: 1042,
};

export const mockMembers: MockMember[] = [
  { agency_id: DEMO_AGENCY_ID, user_id: 'usr-kai-moreno', role: 'founder', team_id: null, status: 'active', created_at: '2026-09-01T00:00:00Z' },
  { agency_id: DEMO_AGENCY_ID, user_id: 'usr-alex-chen', role: 'manager', team_id: 'team-nova', status: 'active', created_at: '2026-09-10T00:00:00Z' },
  { agency_id: DEMO_AGENCY_ID, user_id: 'usr-jordan-taylor', role: 'moderator', team_id: 'team-atlas', status: 'active', created_at: '2026-09-15T00:00:00Z' },
];

export const mockProfiles: MockProfile[] = [
  { user_id: 'usr-kai-moreno', email: 'kai@northlight.agency', full_name: 'Kai Moreno', last_seen_at: new Date().toISOString() },
  { user_id: 'usr-alex-chen', email: 'alex@northlight.agency', full_name: 'Alex Chen', last_seen_at: new Date(Date.now() - 3600000).toISOString() },
  { user_id: 'usr-jordan-taylor', email: 'jordan@northlight.agency', full_name: 'Jordan Taylor', last_seen_at: new Date(Date.now() - 7200000).toISOString() },
];

export const mockCatalog: MockCatalogGift[] = [
  { gift_id: 5655, name: 'Rose', diamond_count: 1, synced_at: '2026-10-13T00:00:00Z' },
  { gift_id: 5656, name: 'TikTok', diamond_count: 1, synced_at: '2026-10-13T00:00:00Z' },
  { gift_id: 5827, name: 'Finger Heart', diamond_count: 5, synced_at: '2026-10-13T00:00:00Z' },
  { gift_id: 5269, name: 'Swan', diamond_count: 699, synced_at: '2026-10-13T00:00:00Z' },
  { gift_id: 6059, name: 'Fireworks', diamond_count: 1088, synced_at: '2026-10-13T00:00:00Z' },
  { gift_id: 5658, name: 'Galaxy', diamond_count: 1000, synced_at: '2026-10-13T00:00:00Z' },
  { gift_id: 6104, name: 'Leon the Kitten', diamond_count: 4888, synced_at: '2026-10-13T00:00:00Z' },
  { gift_id: 5659, name: 'Lion', diamond_count: 29999, synced_at: '2026-10-13T00:00:00Z' },
  { gift_id: 5660, name: 'TikTok Universe', diamond_count: 34999, synced_at: '2026-10-13T00:00:00Z' },
];

export const mockCalls = [
  { id: 1, tool: 'get_room_id', args: { unique_id: 'sora_live' }, ok: true, ms: 42, auth: 'oauth', error: null, created_at: new Date(Date.now() - 600000).toISOString() },
  { id: 2, tool: 'get_room_id', args: { unique_id: 'kai_gaming' }, ok: true, ms: 38, auth: 'oauth', error: null, created_at: new Date(Date.now() - 1200000).toISOString() },
  { id: 3, tool: 'get_user_info', args: { unique_id: 'marcus_beats' }, ok: true, ms: 55, auth: 'oauth', error: null, created_at: new Date(Date.now() - 1800000).toISOString() },
];

export const mockLedger: MockLedgerRow[] = [
  { id: 101, occurred_at: new Date(Date.now() - 120000).toISOString(), sender_unique_id: 'northlight_mgmt', creator_unique_id: 'sora_live', gift_id: 5659, gift_name: 'Lion', repeat_count: 1, coins: 29999, purpose: 'battle_support', total_count: 1, total_coins: 29999 },
  { id: 102, occurred_at: new Date(Date.now() - 340000).toISOString(), sender_unique_id: 'dragon_whale_99', creator_unique_id: 'kai_gaming', gift_id: 5660, gift_name: 'TikTok Universe', repeat_count: 1, coins: 34999, purpose: null, total_count: 1, total_coins: 34999 },
  { id: 103, occurred_at: new Date(Date.now() - 580000).toISOString(), sender_unique_id: 'northlight_vip', creator_unique_id: 'marcus_beats', gift_id: 6059, gift_name: 'Fireworks', repeat_count: 5, coins: 5440, purpose: 'scheduled_drop', total_count: 5, total_coins: 5440 },
  { id: 104, occurred_at: new Date(Date.now() - 890000).toISOString(), sender_unique_id: 'star_supporter_jp', creator_unique_id: 'elena_art', gift_id: 5658, gift_name: 'Galaxy', repeat_count: 3, coins: 3000, purpose: null, total_count: 3, total_coins: 3000 },
  { id: 105, occurred_at: new Date(Date.now() - 1240000).toISOString(), sender_unique_id: 'northlight_mgmt', creator_unique_id: 'kai_gaming', gift_id: 5659, gift_name: 'Lion', repeat_count: 2, coins: 59998, purpose: 'battle_support', total_count: 2, total_coins: 59998 },
  { id: 106, occurred_at: new Date(Date.now() - 1560000).toISOString(), sender_unique_id: 'crypto_king_vip', creator_unique_id: 'sora_live', gift_id: 6104, gift_name: 'Leon the Kitten', repeat_count: 2, coins: 9776, purpose: null, total_count: 2, total_coins: 9776 },
  { id: 107, occurred_at: new Date(Date.now() - 1920000).toISOString(), sender_unique_id: 'tok_fan_emma', creator_unique_id: 'chloe_vibes', gift_id: 5269, gift_name: 'Swan', repeat_count: 2, coins: 1398, purpose: null, total_count: 2, total_coins: 1398 },
  { id: 108, occurred_at: new Date(Date.now() - 2400000).toISOString(), sender_unique_id: 'northlight_mgmt', creator_unique_id: 'zara_style', gift_id: 6059, gift_name: 'Fireworks', repeat_count: 2, coins: 2176, purpose: 'milestone_push', total_count: 2, total_coins: 2176 },
  { id: 109, occurred_at: new Date(Date.now() - 2800000).toISOString(), sender_unique_id: 'galaxy_giver_8', creator_unique_id: 'leo_pk_king', gift_id: 5658, gift_name: 'Galaxy', repeat_count: 4, coins: 4000, purpose: null, total_count: 4, total_coins: 4000 },
  { id: 110, occurred_at: new Date(Date.now() - 3200000).toISOString(), sender_unique_id: 'northlight_vip', creator_unique_id: 'tariq_tunes', gift_id: 5269, gift_name: 'Swan', repeat_count: 3, coins: 2097, purpose: 'retention', total_count: 3, total_coins: 2097 },
];

export const demoSession: Session = {
  access_token: 'mock-access-token-demo',
  refresh_token: 'mock-refresh-token-demo',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'usr-kai-moreno',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Kai Moreno' },
    aud: 'authenticated',
    created_at: '2026-09-01T00:00:00Z',
    email: 'kai@northlight.agency',
    phone: '',
    role: 'authenticated',
    updated_at: new Date().toISOString(),
  },
};
