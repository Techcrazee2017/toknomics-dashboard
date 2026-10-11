-- TokNomics ingestion schema: tracked_targets (frontend writes), gift_transactions + stream_status (worker writes)

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agency_members (
  agency_id uuid not null references public.agencies on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('founder', 'manager', 'viewer')),
  primary key (agency_id, user_id)
);

create table if not exists public.tracked_targets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies on delete cascade,
  unique_id text not null check (unique_id ~ '^[a-z0-9._]{2,24}$'),
  source text not null default 'pin' check (source in ('roster', 'pin', 'battle')),
  label text,
  active boolean not null default true,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, unique_id)
);
create index if not exists tracked_targets_active_idx on public.tracked_targets (unique_id) where active;

-- One row per TikTok unique_id; worker-owned socket state, read by the dashboard
create table if not exists public.stream_status (
  unique_id text primary key,
  status text not null check (status in ('connecting', 'live', 'offline', 'backoff', 'auth_error', 'invalid', 'stopped')),
  room_id text,
  close_code int,
  last_error text,
  last_event_at timestamptz,
  next_retry_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.gift_transactions (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies on delete cascade,
  creator_unique_id text not null,
  room_id text,
  msg_id text not null,
  sender_user_id text,
  sender_unique_id text,
  sender_nickname text,
  gift_id int not null,
  gift_name text,
  diamond_count int not null,
  repeat_count int not null default 1,
  total_diamonds int generated always as (diamond_count * repeat_count) stored,
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  raw jsonb,
  unique (agency_id, msg_id)
);
create index if not exists gift_tx_agency_time_idx on public.gift_transactions (agency_id, occurred_at desc);
create index if not exists gift_tx_creator_idx on public.gift_transactions (creator_unique_id, occurred_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists tracked_targets_touch on public.tracked_targets;
create trigger tracked_targets_touch before update on public.tracked_targets
  for each row execute function public.touch_updated_at();

-- Upserts rewrite every payload column on conflict, so keys are update-granted but frozen here
create or replace function public.freeze_target_keys() returns trigger language plpgsql as $$
begin
  if new.agency_id <> old.agency_id or new.unique_id <> old.unique_id then
    raise exception 'agency_id and unique_id are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists tracked_targets_freeze on public.tracked_targets;
create trigger tracked_targets_freeze before update on public.tracked_targets
  for each row execute function public.freeze_target_keys();

-- security definer avoids recursive RLS on agency_members
create or replace function public.is_agency_member(a uuid, roles text[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = a and m.user_id = auth.uid()
      and (roles is null or m.role = any(roles))
  )
$$;

alter table public.agencies          enable row level security;
alter table public.agency_members    enable row level security;
alter table public.tracked_targets   enable row level security;
alter table public.stream_status     enable row level security;
alter table public.gift_transactions enable row level security;

create policy agencies_read on public.agencies for select to authenticated using (public.is_agency_member(id));
create policy members_read  on public.agency_members for select to authenticated using (public.is_agency_member(agency_id));

create policy targets_read   on public.tracked_targets for select to authenticated
  using (public.is_agency_member(agency_id));
create policy targets_insert on public.tracked_targets for insert to authenticated
  with check (public.is_agency_member(agency_id, array['founder', 'manager']));
create policy targets_update on public.tracked_targets for update to authenticated
  using (public.is_agency_member(agency_id, array['founder', 'manager']))
  with check (public.is_agency_member(agency_id, array['founder', 'manager']));
create policy targets_delete on public.tracked_targets for delete to authenticated
  using (public.is_agency_member(agency_id, array['founder', 'manager']));

-- Users may only set these columns (created_by/timestamps come from defaults and triggers)
revoke insert, update on public.tracked_targets from anon, authenticated;
grant insert (agency_id, unique_id, source, label, active) on public.tracked_targets to authenticated;
grant update (agency_id, unique_id, source, label, active) on public.tracked_targets to authenticated;

create policy status_read on public.stream_status for select to authenticated using (
  exists (select 1 from public.tracked_targets t
          where t.unique_id = stream_status.unique_id and public.is_agency_member(t.agency_id))
);

create policy gifts_read on public.gift_transactions for select to authenticated
  using (public.is_agency_member(agency_id));

-- No write policies on worker-owned tables: only the service role (which bypasses RLS) can write
revoke insert, update, delete on public.gift_transactions, public.stream_status from anon, authenticated;

alter publication supabase_realtime add table public.tracked_targets, public.stream_status, public.gift_transactions;
