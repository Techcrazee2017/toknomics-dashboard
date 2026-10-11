// Product constants shared by the API server, worker and dashboard.

export const ROLES = ['founder', 'manager', 'moderator', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_INFO: Record<Exclude<Role, 'viewer'>, { name: string; icon: string; desc: string }> = {
  founder: { name: 'Founder', icon: 'ph-crown-simple', desc: 'Full access to every roster, the ledger, targets and billing.' },
  manager: { name: 'Manager', icon: 'ph-users-three', desc: "Runs one team's roster: ledger, P&L cards and live targets." },
  moderator: { name: 'Moderator', icon: 'ph-tag', desc: "Logs and tags gifts for their team's creators during streams." },
};

/** Who may do what. The database enforces the same rules through RLS; this drives the UI and the API. */
export const CAN = {
  editRoster: (r: Role) => r === 'founder' || r === 'manager',
  trackTargets: (r: Role) => r === 'founder' || r === 'manager',
  tagGifts: (r: Role) => r === 'founder' || r === 'manager' || r === 'moderator',
  moderateRooms: (r: Role) => r === 'founder' || r === 'manager' || r === 'moderator',
  manageCredentials: (r: Role) => r === 'founder',
  manageTeam: (r: Role) => r === 'founder',
  manageBilling: (r: Role) => r === 'founder',
  editSettings: (r: Role) => r === 'founder',
  syncCatalog: (r: Role) => r === 'founder' || r === 'manager',
} as const;

export const PURPOSES = [
  { key: 'battle_support', label: 'Battle support', short: 'Battle', icon: 'ph-sword' },
  { key: 'scheduled_drop', label: 'Scheduled drop', short: 'Drop', icon: 'ph-calendar-check' },
  { key: 'milestone_push', label: 'Milestone push', short: 'Milestone', icon: 'ph-flag-pennant' },
  { key: 'retention', label: 'Retention', short: 'Retention', icon: 'ph-handshake' },
] as const;
export type Purpose = (typeof PURPOSES)[number]['key'];
export const PURPOSE_KEYS = PURPOSES.map(p => p.key) as [Purpose, ...Purpose[]];

export const TIERS = ['S', 'A', 'B'] as const;
export type Tier = (typeof TIERS)[number];

export const PLANS = [
  { key: 'starter', name: 'Starter Agency', short: 'Starter', who: 'Solo managers & boutique agencies', price: '$49', limit: 10, multiSeat: false, feats: ['Up to 10 creators tracked', 'Basic outgoing ledger', 'Weekly CSV exports'] },
  { key: 'growth', name: 'Growth Agency', short: 'Growth', who: 'Mid-size agencies running daily battles', price: '$149', limit: 50, multiSeat: false, feats: ['Up to 50 creators', 'Real-time battle target tracking', 'Creator P&L cards', 'Webhook alerts'] },
  { key: 'scale', name: 'Scale / Enterprise', short: 'Scale', who: 'Top-tier TikTok LIVE agencies', price: '$299 – $499', limit: null, multiSeat: true, feats: ['Unlimited creators', 'Multi-seat team access', 'Custom API ingestion', 'Priority support'] },
] as const;
export type PlanKey = (typeof PLANS)[number]['key'];
export const PLAN_KEYS = PLANS.map(p => p.key) as [PlanKey, ...PlanKey[]];
export const planOf = (k: string) => PLANS.find(p => p.key === k) ?? PLANS[0];

export const DEFAULT_RATES = { coinUsd: 0.0133, diamondUsd: 0.005, agencyCutPct: 20 } as const;

/** Euler's ClientCloseCode values and what TokNomics does about each (mirrors backend/src/worker.ts policyFor). */
export const CLOSE_CODES: ReadonlyArray<readonly [number, string, string]> = [
  [1000, 'NORMAL', 'Closed by us. No action.'],
  [4404, 'NOT_LIVE', 'Mark target offline; retry from 60s, up to every 5 min.'],
  [4005, 'STREAM_END', 'Session ends; totals close. Same retry as NOT_LIVE.'],
  [4006, 'NO_MESSAGES_TIMEOUT', 'Reconnect with backoff from 1s.'],
  [4555, 'MAX_LIFETIME_EXCEEDED', 'Reconnect immediately. Sockets cap at 8 hours.'],
  [4500, 'TIKTOK_CLOSED_CONNECTION', 'Retry with backoff (1s → 30s).'],
  [1011, 'INTERNAL_SERVER_ERROR', 'Retry with backoff (1s → 30s).'],
  [4556, 'WEBCAST_FETCH_ERROR', 'Retry with backoff (1s → 30s).'],
  [4557, 'ROOM_INFO_FETCH_ERROR', 'Retry with backoff (1s → 30s).'],
  [4429, 'TOO_MANY_CONNECTIONS', 'Back off at least 30s. Concurrent socket limit reached.'],
  [4401, 'INVALID_AUTH', 'Flag the API key on Data source; retry every 10 min.'],
  [4403, 'NO_PERMISSION', 'Key or JWT not scoped to this creator; retry every 10 min.'],
  [4400, 'INVALID_OPTIONS', 'Stop. Bad uniqueId. Shown as invalid on the target.'],
];

export const FEED_REGIONS = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'BR', 'MX', 'JP', 'PH'] as const;
export const RANK_NAMES = [['DAILY_RANK', 'Daily'], ['FANS_TEAM_RANK', 'Fans team'], ['SALE_RANK', 'Sales'], ['RANKING_LEAGUE', 'League']] as const;
export type RankName = (typeof RANK_NAMES)[number][0];
export const LEAGUES = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'C4', 'C5', 'D1', 'D2', 'D3', 'D4', 'D5'] as const;
export const MUTE_DURATIONS = [[5, '5s'], [30, '30s'], [60, '1 min'], [300, '5 min'], [-1, 'Permanent']] as const;

export const TOOL_GROUPS = [
  { name: 'Lookup', where: 'Add target', auth: false, tools: ['get_user_id', 'get_user_basic', 'get_room_id'] },
  { name: 'Discovery', where: 'Live targets', auth: false, tools: ['get_live_feed'] },
  { name: 'Rankings', where: 'Rankings', auth: false, tools: ['rankings-get_leaderboard_catalog', 'rankings-get_leaderboard'] },
  { name: 'Moderation', where: 'Room moderation', auth: true, tools: ['toggle_room_comments', 'mutes-get_muted_users', 'mutes-mute_room_user', 'mutes-unmute_room_user', 'bans-get_banned_users', 'bans-ban_room_user', 'bans-unban_room_user', 'moderators-get_room_moderators', 'moderators-add_room_moderator', 'moderators-remove_room_moderator', 'sensitive_words-get_sensitive_words', 'sensitive_words-add_sensitive_word', 'sensitive_words-delete_sensitive_word'] },
] as const;
