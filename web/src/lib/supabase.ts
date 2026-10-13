import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import {
  demoSession,
  isDemoMode,
  mockAgencies,
  mockTeams,
  mockCreators,
  mockAccounts,
  mockTargets,
  mockStreamStatus,
  mockConnection,
  mockMembers,
  mockProfiles,
  mockCatalog,
  mockCalls,
  mockLedger,
  type MockLedgerRow,
} from './mockStore';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// When credentials are not provided, we run in offline demo mode with mock data
export const configError = null;

function createMockClient(): SupabaseClient {
  let activeSession: Session | null = demoSession;
  const authListeners = new Set<(event: string, session: Session | null) => void>();

  // In-memory mutable states
  const agencies = [...mockAgencies];
  const teams = [...mockTeams];
  const creators = [...mockCreators];
  const accounts = [...mockAccounts];
  const targets = [...mockTargets];
  const streamStatus = [...mockStreamStatus];
  let connection = { ...mockConnection };
  const members = [...mockMembers];
  const profiles = [...mockProfiles];
  const catalog = [...mockCatalog];
  const calls = [...mockCalls];
  const ledger = [...mockLedger];

  const auth = {
    async getSession() {
      return { data: { session: activeSession }, error: null };
    },
    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
      authListeners.add(callback);
      // Immediately notify current state
      callback('SIGNED_IN', activeSession);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
    async signInWithOtp(opts: { email: string }) {
      const email = opts.email.trim();
      const existing = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
      const user = {
        id: existing?.user_id ?? 'usr-' + Math.random().toString(36).slice(2, 9),
        app_metadata: { provider: 'email' },
        user_metadata: { full_name: existing?.full_name ?? email.split('@')[0] },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email,
        phone: '',
        role: 'authenticated',
        updated_at: new Date().toISOString(),
      };
      activeSession = {
        access_token: 'mock-token-' + Date.now(),
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user,
      };
      authListeners.forEach(cb => cb('SIGNED_IN', activeSession));
      return { data: { session: activeSession, user }, error: null };
    },
    async signOut() {
      activeSession = null;
      authListeners.forEach(cb => cb('SIGNED_OUT', null));
      return { error: null };
    },
  };

  function createQueryBuilder(tableName: string) {
    const filters: Array<(row: any) => boolean> = [];
    let isSingle = false;
    let isMaybeSingle = false;
    let orderCol: string | null = null;
    let orderAsc = true;
    let limitCount: number | null = null;
    let pendingAction: (() => any) | null = null;

    const builder: any = {
      select(columns?: string, _opts?: any) {
        pendingAction = () => {
          let rows: any[] = [];
          if (tableName === 'agencies') rows = agencies;
          else if (tableName === 'teams') rows = teams;
          else if (tableName === 'creators') rows = creators;
          else if (tableName === 'agency_accounts') rows = accounts;
          else if (tableName === 'tracked_targets') rows = targets;
          else if (tableName === 'stream_status') rows = streamStatus;
          else if (tableName === 'euler_connections') rows = [connection];
          else if (tableName === 'gift_catalog') rows = catalog;
          else if (tableName === 'euler_calls') rows = calls;
          else if (tableName === 'profiles') rows = profiles;
          else if (tableName === 'agency_members') {
            rows = members.map(m => {
              const ag = agencies.find(a => a.id === m.agency_id) ?? agencies[0];
              return {
                ...m,
                agencies: ag,
              };
            });
          } else if (tableName === 'gift_transactions') {
            rows = ledger;
          }

          let filtered = rows.filter(r => filters.every(f => f(r)));

          if (orderCol) {
            filtered.sort((a, b) => {
              const va = a[orderCol!], vb = b[orderCol!];
              if (va < vb) return orderAsc ? -1 : 1;
              if (va > vb) return orderAsc ? 1 : -1;
              return 0;
            });
          }

          if (limitCount !== null) {
            filtered = filtered.slice(0, limitCount);
          }

          if (isSingle) return filtered[0] ?? null;
          if (isMaybeSingle) return filtered[0] ?? null;
          return filtered;
        };
        return builder;
      },
      insert(data: any) {
        pendingAction = () => {
          const item = Array.isArray(data) ? data[0] : data;
          const inserted = { id: item.id ?? 'item-' + Math.random().toString(36).slice(2, 8), ...item };
          if (tableName === 'agencies') agencies.push(inserted);
          else if (tableName === 'agency_members') members.push(inserted);
          else if (tableName === 'tracked_targets') targets.push(inserted);
          else if (tableName === 'creators') creators.push(inserted);
          return inserted;
        };
        return builder;
      },
      update(data: any) {
        pendingAction = () => {
          if (tableName === 'euler_connections') {
            Object.assign(connection, data);
            return connection;
          }
          if (tableName === 'tracked_targets') {
            targets.forEach(t => {
              if (filters.every(f => f(t))) Object.assign(t, data);
            });
          }
          if (tableName === 'agency_members') {
            members.forEach(m => {
              if (filters.every(f => f(m))) Object.assign(m, data);
            });
          }
          return data;
        };
        return builder;
      },
      upsert(data: any, _opts?: any) {
        pendingAction = () => {
          const item = Array.isArray(data) ? data[0] : data;
          if (tableName === 'tracked_targets') {
            const idx = targets.findIndex(t => t.agency_id === item.agency_id && t.unique_id === item.unique_id);
            if (idx >= 0) targets[idx] = { ...targets[idx], ...item };
            else targets.unshift({ id: 't-' + Date.now(), ...item });
            return item;
          }
          if (tableName === 'euler_connections') {
            connection = { ...connection, ...item };
            return connection;
          }
          return item;
        };
        return builder;
      },
      delete() {
        pendingAction = () => {
          if (tableName === 'tracked_targets') {
            const removed = targets.filter(t => !filters.every(f => f(t)));
            targets.length = 0;
            targets.push(...removed);
          }
          return { ok: true };
        };
        return builder;
      },
      eq(col: string, val: any) {
        filters.push((row: any) => row[col] === val);
        return builder;
      },
      neq(col: string, val: any) {
        filters.push((row: any) => row[col] !== val);
        return builder;
      },
      in(col: string, vals: any[]) {
        filters.push((row: any) => vals.includes(row[col]));
        return builder;
      },
      gte(col: string, val: any) {
        filters.push((row: any) => row[col] >= val);
        return builder;
      },
      lte(col: string, val: any) {
        filters.push((row: any) => row[col] <= val);
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col;
        orderAsc = opts?.ascending ?? true;
        return builder;
      },
      limit(n: number) {
        limitCount = n;
        return builder;
      },
      single() {
        isSingle = true;
        return builder;
      },
      maybeSingle() {
        isMaybeSingle = true;
        return builder;
      },
      then(resolve: (result: { data: any; error: any }) => any, reject?: (err: any) => any) {
        try {
          const result = pendingAction ? pendingAction() : [];
          return Promise.resolve({ data: result, error: null }).then(resolve, reject);
        } catch (e) {
          if (reject) return Promise.reject(e).catch(reject);
          return Promise.resolve({ data: null, error: e }).then(resolve);
        }
      },
    };

    return builder;
  }

  function rpc(fn: string, args?: Record<string, any>) {
    return {
      then(resolve: (result: { data: any; error: any }) => any, reject?: (err: any) => any) {
        let data: any = null;
        if (fn === 'creator_stats') {
          const statsMap: Record<string, { invested_coins: number; received_diamonds: number; agency_gifts: number }> = {
            sora_live: { invested_coins: 142000, received_diamonds: 980000, agency_gifts: 38 },
            marcus_beats: { invested_coins: 98000, received_diamonds: 740000, agency_gifts: 24 },
            elena_art: { invested_coins: 64000, received_diamonds: 490000, agency_gifts: 19 },
            kai_gaming: { invested_coins: 110000, received_diamonds: 820000, agency_gifts: 31 },
            chloe_vibes: { invested_coins: 38000, received_diamonds: 210000, agency_gifts: 12 },
            leo_pk_king: { invested_coins: 45000, received_diamonds: 310000, agency_gifts: 15 },
            zara_style: { invested_coins: 52000, received_diamonds: 380000, agency_gifts: 16 },
            tariq_tunes: { invested_coins: 29000, received_diamonds: 180000, agency_gifts: 9 },
          };
          data = Object.entries(statsMap).map(([creator_unique_id, st]) => ({
            creator_unique_id,
            invested_coins: st.invested_coins,
            received_diamonds: st.received_diamonds,
            agency_gifts: st.agency_gifts,
          }));
        } else if (fn === 'burn_series') {
          const buckets = args?.p_buckets || 7;
          data = Array.from({ length: buckets }, (_, i) => ({
            bucket: i,
            invested_coins: Math.round(15000 + Math.sin(i * 1.2) * 8000 + i * 2000),
            received_diamonds: Math.round(90000 + Math.cos(i * 0.9) * 40000 + i * 15000),
          }));
        } else if (fn === 'ledger_page') {
          let rows = [...ledger];
          if (args?.p_creators && Array.isArray(args.p_creators)) {
            rows = rows.filter(r => args.p_creators.includes(r.creator_unique_id));
          }
          if (args?.p_purpose) {
            rows = rows.filter(r => r.purpose === args.p_purpose);
          }
          if (args?.p_query) {
            const q = String(args.p_query).toLowerCase();
            rows = rows.filter(r => r.creator_unique_id.includes(q) || r.sender_unique_id.includes(q) || (r.gift_name && r.gift_name.toLowerCase().includes(q)));
          }
          const offset = args?.p_offset || 0;
          const limit = args?.p_limit || 20;
          data = rows.slice(offset, offset + limit);
        } else if (fn === 'top_senders') {
          data = [
            { sender_unique_id: 'northlight_mgmt', coins: 185000, is_agency: true },
            { sender_unique_id: 'dragon_whale_99', coins: 145000, is_agency: false },
            { sender_unique_id: 'star_supporter_jp', coins: 112000, is_agency: false },
            { sender_unique_id: 'crypto_king_vip', coins: 95000, is_agency: false },
            { sender_unique_id: 'tok_fan_emma', coins: 62000, is_agency: false },
            { sender_unique_id: 'galaxy_giver_8', coins: 48000, is_agency: false },
          ];
        } else if (fn === 'target_stats') {
          data = [
            { unique_id: 'sora_live', coins_in: 485000, agency_out: 142000, series: [120, 240, 500, 320, 890, 1420, 1100] },
            { unique_id: 'marcus_beats', coins_in: 320000, agency_out: 98000, series: [80, 150, 210, 430, 620, 890, 750] },
            { unique_id: 'elena_art', coins_in: 210000, agency_out: 64000, series: [50, 120, 180, 290, 350, 650, 580] },
            { unique_id: 'kai_gaming', coins_in: 560000, agency_out: 110000, series: [200, 450, 780, 1100, 1600, 2100, 1950] },
          ];
        } else if (fn === 'gift_usage') {
          data = [
            { gift_id: 5659, sends: 14 },
            { gift_id: 5660, sends: 8 },
            { gift_id: 6059, sends: 32 },
            { gift_id: 5658, sends: 45 },
            { gift_id: 5269, sends: 68 },
            { gift_id: 5655, sends: 540 },
          ];
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
  }

  function channel(_name: string) {
    const ch: any = {
      on(_event: string, _filter: any, _cb: any) {
        return ch;
      },
      subscribe() {
        return ch;
      },
    };
    return ch;
  }

  return {
    auth,
    from: createQueryBuilder,
    rpc,
    channel,
    removeChannel: async () => {},
  } as unknown as SupabaseClient;
}

/** Browser client: uses real Supabase if keys provided, otherwise in-memory mock client */
export const supabase: SupabaseClient = url && anon
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : createMockClient();
