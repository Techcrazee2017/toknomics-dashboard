-- TokNomics application schema: roster, teams, ledger tagging, Euler connection, billing, stats RPCs.
-- Builds on 0001_tracking.sql. Secrets live in euler_credentials, which no client role can read.

-- ── roles ────────────────────────────────────────────────────────────────────
alter table public.agency_members drop constraint if exists agency_members_role_check;
alter table public.agency_members add constraint agency_members_role_check
  check (role in ('founder', 'manager', 'moderator', 'viewer'));

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (agency_id, name)
);

alter table public.agency_members
  add column if not exists team_id uuid references public.teams on delete set null,
  add column if not exists status text not null default 'active' check (status in ('invited', 'active')),
  add column if not exists created_at timestamptz not null default now();

-- ── agency settings & plan ───────────────────────────────────────────────────
alter table public.agencies
  add column if not exists agency_cut_pct numeric(5,2) not null default 20 check (agency_cut_pct between 0 and 100),
  add column if not exists coin_usd numeric(10,6) not null default 0.0133 check (coin_usd > 0),
  add column if not exists diamond_usd numeric(10,6) not null default 0.005 check (diamond_usd > 0),
  add column if not exists plan text not null default 'starter' check (plan in ('starter', 'growth', 'scale')),
  add column if not exists subscription_status text,
  add column if not exists plan_renews_at timestamptz,
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique;

create or replace function public.plan_creator_limit(p text) returns int language sql immutable as $$
  select case p when 'starter' then 10 when 'growth' then 50 else null end
$$;

-- ── profiles (names/emails for the Team screen) ──────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  last_seen_at timestamptz
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.profiles (user_id, email, full_name)
  select id, email, split_part(email, '@', 1) from auth.users where email is not null
  on conflict (user_id) do nothing;

-- ── roster ───────────────────────────────────────────────────────────────────
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies on delete cascade,
  unique_id text not null check (unique_id ~ '^[a-z0-9._]{2,24}$'),
  display_name text,
  team_id uuid references public.teams on delete set null,
  tier text not null default 'B' check (tier in ('S', 'A', 'B')),
  created_at timestamptz not null default now(),
  unique (agency_id, unique_id)
);
create index if not exists creators_team_idx on public.creators (agency_id, team_id);

create or replace function public.enforce_creator_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  select public.plan_creator_limit(plan) into lim from public.agencies where id = new.agency_id;
  if lim is null then return new; end if;
  select count(*) into n from public.creators where agency_id = new.agency_id;
  if n >= lim then
    raise exception 'Your plan allows % creators. Upgrade to add more.', lim using errcode = 'P0001', hint = 'plan_limit';
  end if;
  return new;
end $$;
drop trigger if exists creators_limit on public.creators;
create trigger creators_limit before insert on public.creators
  for each row execute function public.enforce_creator_limit();

-- Agency-controlled gifter accounts: gifts from these senders are agency outlay (the ledger)
create table if not exists public.agency_accounts (
  agency_id uuid not null references public.agencies on delete cascade,
  unique_id text not null check (unique_id ~ '^[a-z0-9._]{2,24}$'),
  label text,
  created_at timestamptz not null default now(),
  primary key (agency_id, unique_id)
);

-- ── tracked targets: battles track an opponent too ───────────────────────────
alter table public.tracked_targets
  add column if not exists kind text not null default 'stream' check (kind in ('stream', 'battle')),
  add column if not exists opponent_unique_id text check (opponent_unique_id ~ '^[a-z0-9._]{2,24}$'),
  add column if not exists anchor_id text check (anchor_id ~ '^\d{5,24}$');
alter table public.tracked_targets add constraint tracked_targets_battle_opponent
  check (kind = 'stream' or opponent_unique_id is not null) not valid;
create index if not exists tracked_targets_opponent_idx on public.tracked_targets (opponent_unique_id) where active and opponent_unique_id is not null;
grant insert (kind, opponent_unique_id, anchor_id), update (kind, opponent_unique_id, anchor_id) on public.tracked_targets to authenticated;

-- ── worker socket state ──────────────────────────────────────────────────────
alter table public.stream_status drop constraint if exists stream_status_status_check;
alter table public.stream_status add constraint stream_status_status_check
  check (status in ('connecting', 'live', 'offline', 'backoff', 'auth_error', 'invalid', 'stopped', 'paused'));
alter table public.stream_status
  add column if not exists viewer_count int,
  add column if not exists connected_at timestamptz,
  add column if not exists session_started_at timestamptz,
  add column if not exists events_ingested bigint not null default 0;

drop policy if exists status_read on public.stream_status;
create policy status_read on public.stream_status for select to authenticated using (
  exists (select 1 from public.tracked_targets t
          where (t.unique_id = stream_status.unique_id or t.opponent_unique_id = stream_status.unique_id)
            and public.is_agency_member(t.agency_id))
);

-- ── purpose tags (members tag worker-owned gift rows) ───────────────────────
create table if not exists public.gift_purposes (
  gift_tx_id bigint primary key references public.gift_transactions on delete cascade,
  agency_id uuid not null references public.agencies on delete cascade,
  purpose text not null check (purpose in ('battle_support', 'scheduled_drop', 'milestone_push', 'retention')),
  tagged_by uuid references auth.users default auth.uid(),
  tagged_at timestamptz not null default now()
);

create or replace function public.gift_purpose_same_agency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.gift_transactions g where g.id = new.gift_tx_id and g.agency_id = new.agency_id) then
    raise exception 'gift does not belong to this agency' using errcode = '42501';
  end if;
  new.tagged_by = auth.uid(); new.tagged_at = now();
  return new;
end $$;
drop trigger if exists gift_purposes_agency on public.gift_purposes;
create trigger gift_purposes_agency before insert or update on public.gift_purposes
  for each row execute function public.gift_purpose_same_agency();

-- ── Euler connection: public status vs. server-only secrets ─────────────────
create table if not exists public.euler_connections (
  agency_id uuid primary key references public.agencies on delete cascade,
  mode text not null default 'oauth' check (mode in ('oauth', 'cookie')),
  host text not null default 'tiktok.eulerstream.com',
  status text not null default 'disconnected' check (status in ('disconnected', 'authorizing', 'connected')),
  api_key_last4 text,
  has_cookie boolean not null default false,
  pinned_user_id text check (pinned_user_id ~ '^\d{5,24}$'),
  account_label text,
  euler_account_id bigint,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

-- AES-GCM ciphertexts written by the API server; no grants to anon/authenticated at all
create table if not exists public.euler_credentials (
  agency_id uuid primary key references public.agencies on delete cascade,
  api_key_enc text,
  cookie_enc text,
  oauth_access_enc text,
  oauth_refresh_enc text,
  oauth_expires_at timestamptz,
  oauth_state_hash text,
  oauth_state_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.euler_calls (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies on delete cascade,
  user_id uuid references auth.users on delete set null,
  tool text not null,
  args jsonb not null default '{}',
  ok boolean not null,
  ms int not null,
  auth text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists euler_calls_agency_idx on public.euler_calls (agency_id, created_at desc);

create table if not exists public.gift_catalog (
  gift_id int primary key,
  name text not null,
  diamond_count int not null check (diamond_count >= 0),
  gift_type int,
  image_uri text,
  synced_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.teams             enable row level security;
alter table public.profiles          enable row level security;
alter table public.creators          enable row level security;
alter table public.agency_accounts   enable row level security;
alter table public.gift_purposes     enable row level security;
alter table public.euler_connections enable row level security;
alter table public.euler_credentials enable row level security;
alter table public.euler_calls       enable row level security;
alter table public.gift_catalog      enable row level security;

create policy teams_read  on public.teams for select to authenticated using (public.is_agency_member(agency_id));
create policy teams_write on public.teams for all to authenticated
  using (public.is_agency_member(agency_id, array['founder'])) with check (public.is_agency_member(agency_id, array['founder']));

create policy agencies_update on public.agencies for update to authenticated
  using (public.is_agency_member(id, array['founder'])) with check (public.is_agency_member(id, array['founder']));
revoke update on public.agencies from anon, authenticated;
grant update (name, agency_cut_pct, coin_usd, diamond_usd) on public.agencies to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.agency_members mine join public.agency_members theirs using (agency_id)
    where mine.user_id = auth.uid() and theirs.user_id = profiles.user_id)
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, last_seen_at) on public.profiles to authenticated;

create policy creators_read  on public.creators for select to authenticated using (public.is_agency_member(agency_id));
create policy creators_write on public.creators for all to authenticated
  using (public.is_agency_member(agency_id, array['founder', 'manager']))
  with check (public.is_agency_member(agency_id, array['founder', 'manager']));

create policy accounts_read  on public.agency_accounts for select to authenticated using (public.is_agency_member(agency_id));
create policy accounts_write on public.agency_accounts for all to authenticated
  using (public.is_agency_member(agency_id, array['founder', 'manager']))
  with check (public.is_agency_member(agency_id, array['founder', 'manager']));

create policy purposes_read  on public.gift_purposes for select to authenticated using (public.is_agency_member(agency_id));
create policy purposes_write on public.gift_purposes for all to authenticated
  using (public.is_agency_member(agency_id, array['founder', 'manager', 'moderator']))
  with check (public.is_agency_member(agency_id, array['founder', 'manager', 'moderator']));

create policy connections_read on public.euler_connections for select to authenticated using (public.is_agency_member(agency_id));
revoke insert, update, delete on public.euler_connections from anon, authenticated;
revoke all on public.euler_credentials from anon, authenticated;

create policy calls_read on public.euler_calls for select to authenticated using (public.is_agency_member(agency_id));
revoke insert, update, delete on public.euler_calls from anon, authenticated;

create policy catalog_read on public.gift_catalog for select to authenticated using (true);
revoke insert, update, delete on public.gift_catalog from anon, authenticated;

-- Agency membership is managed by the API server (invites, role changes)
revoke insert, update, delete on public.agency_members from anon, authenticated;

-- ── stats RPCs (security invoker: RLS still scopes every row) ───────────────
-- Coins are the gift's coin price × repeat (TikTok's diamond_count field); a creator
-- receives one diamond per coin gifted, so received_diamonds = coins of all gifts to them.
create or replace function public.creator_stats(p_agency uuid, p_from timestamptz, p_to timestamptz)
returns table (creator_unique_id text, invested_coins bigint, received_diamonds bigint, agency_gifts int)
language sql stable security invoker set search_path = public as $$
  select g.creator_unique_id,
         coalesce(sum(g.total_diamonds) filter (where a.unique_id is not null), 0)::bigint,
         coalesce(sum(g.total_diamonds), 0)::bigint,
         (count(*) filter (where a.unique_id is not null))::int
  from public.gift_transactions g
  left join public.agency_accounts a on a.agency_id = g.agency_id and a.unique_id = g.sender_unique_id
  where g.agency_id = p_agency and g.occurred_at >= p_from and g.occurred_at < p_to
  group by g.creator_unique_id
$$;

create or replace function public.burn_series(p_agency uuid, p_from timestamptz, p_to timestamptz, p_buckets int, p_creators text[] default null)
returns table (bucket int, invested_coins bigint, received_diamonds bigint)
language sql stable security invoker set search_path = public as $$
  select b.i,
         coalesce(sum(g.total_diamonds) filter (where a.unique_id is not null), 0)::bigint,
         coalesce(sum(g.total_diamonds), 0)::bigint
  from generate_series(0, greatest(p_buckets, 1) - 1) b(i)
  left join public.gift_transactions g
    on g.agency_id = p_agency
   and g.occurred_at >= p_from + (p_to - p_from) * b.i / greatest(p_buckets, 1)
   and g.occurred_at <  p_from + (p_to - p_from) * (b.i + 1) / greatest(p_buckets, 1)
   and (p_creators is null or g.creator_unique_id = any(p_creators))
  left join public.agency_accounts a on a.agency_id = g.agency_id and a.unique_id = g.sender_unique_id
  group by b.i
  order by b.i
$$;

create or replace function public.ledger_page(
  p_agency uuid, p_from timestamptz, p_to timestamptz,
  p_creators text[] default null, p_purpose text default null, p_query text default null,
  p_limit int default 40, p_offset int default 0)
returns table (id bigint, occurred_at timestamptz, sender_unique_id text, creator_unique_id text,
               gift_id int, gift_name text, repeat_count int, coins int, purpose text,
               total_count bigint, total_coins bigint)
language sql stable security invoker set search_path = public as $$
  with q as (
    select nullif(replace(replace(replace(trim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_'), '') as pat
  ), base as (
    select g.id, g.occurred_at, g.sender_unique_id, g.creator_unique_id, g.gift_id, g.gift_name,
           g.repeat_count, g.total_diamonds as coins, p.purpose
    from public.gift_transactions g
    join public.agency_accounts a on a.agency_id = g.agency_id and a.unique_id = g.sender_unique_id
    left join public.gift_purposes p on p.gift_tx_id = g.id
    cross join q
    where g.agency_id = p_agency and g.occurred_at >= p_from and g.occurred_at < p_to
      and (p_creators is null or g.creator_unique_id = any(p_creators))
      and (p_purpose is null or (p_purpose = 'untagged' and p.purpose is null) or p.purpose = p_purpose)
      and (q.pat is null or (g.creator_unique_id || ' ' || coalesce(g.sender_unique_id, '') || ' ' || coalesce(g.gift_name, '')) ilike '%' || q.pat || '%')
  )
  select b.*, count(*) over (), coalesce(sum(b.coins) over (), 0)::bigint
  from base b
  order by b.occurred_at desc, b.id desc
  limit least(greatest(p_limit, 1), 5000) offset greatest(p_offset, 0)
$$;

create or replace function public.top_senders(p_agency uuid, p_since timestamptz, p_limit int default 6)
returns table (sender_unique_id text, coins bigint, is_agency boolean)
language sql stable security invoker set search_path = public as $$
  select g.sender_unique_id, sum(g.total_diamonds)::bigint, bool_or(a.unique_id is not null)
  from public.gift_transactions g
  join public.tracked_targets t on t.agency_id = g.agency_id and t.active
   and (t.unique_id = g.creator_unique_id or t.opponent_unique_id = g.creator_unique_id)
  left join public.agency_accounts a on a.agency_id = g.agency_id and a.unique_id = g.sender_unique_id
  where g.agency_id = p_agency and g.occurred_at >= p_since and g.sender_unique_id is not null
  group by g.sender_unique_id
  order by 2 desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- Live-target cards: totals since the current session started, plus a 28-minute per-minute spark
create or replace function public.target_stats(p_agency uuid)
returns table (unique_id text, coins_in bigint, agency_out bigint, series bigint[])
language sql stable security invoker set search_path = public as $$
  with ids as (
    select distinct u.uid
    from public.tracked_targets t
    cross join lateral (values (t.unique_id), (t.opponent_unique_id)) u(uid)
    where t.agency_id = p_agency and t.active and u.uid is not null
  ), s as (
    select ids.uid, coalesce(ss.session_started_at, now() - interval '1 hour') as since
    from ids left join public.stream_status ss on ss.unique_id = ids.uid
  )
  select s.uid,
    (select coalesce(sum(g.total_diamonds), 0)::bigint from public.gift_transactions g
      where g.agency_id = p_agency and g.creator_unique_id = s.uid and g.occurred_at >= s.since),
    (select coalesce(sum(g.total_diamonds), 0)::bigint from public.gift_transactions g
      join public.agency_accounts a on a.agency_id = g.agency_id and a.unique_id = g.sender_unique_id
      where g.agency_id = p_agency and g.creator_unique_id = s.uid and g.occurred_at >= s.since),
    array(
      select coalesce(sum(g.total_diamonds), 0)::bigint
      from generate_series(27, 0, -1) m(n)
      left join public.gift_transactions g
        on g.agency_id = p_agency and g.creator_unique_id = s.uid
       and g.occurred_at >= date_trunc('minute', now()) - make_interval(mins => m.n)
       and g.occurred_at <  date_trunc('minute', now()) - make_interval(mins => m.n - 1)
      group by m.n order by m.n desc
    )
  from s
$$;

create or replace function public.gift_usage(p_agency uuid)
returns table (gift_id int, sends bigint)
language sql stable security invoker set search_path = public as $$
  select g.gift_id, count(*)::bigint
  from public.gift_transactions g
  join public.agency_accounts a on a.agency_id = g.agency_id and a.unique_id = g.sender_unique_id
  where g.agency_id = p_agency
  group by g.gift_id
$$;

create index if not exists gift_tx_agency_sender_idx on public.gift_transactions (agency_id, sender_unique_id, occurred_at desc);

alter publication supabase_realtime add table public.creators, public.gift_purposes, public.euler_connections, public.euler_calls;
