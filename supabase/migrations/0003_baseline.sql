-- Baseline: explicit privileges for every API role, and the live project reconciled with the repo.
--
-- The hosted project creates tables without data privileges for the API roles (anon, authenticated and
-- service_role get only TRUNCATE/REFERENCES/TRIGGER), so nothing created by 0002 was readable or writable
-- through the API, not even with the service key. From here on, every migration grants what it creates.
--
-- It also repairs drift found on the live project: is_agency_member had been switched to SECURITY INVOKER,
-- which makes the agency_members policies recurse as soon as one membership exists, and three agency_members
-- write policies existed only there. Every statement is idempotent, so it applies to the live project and to a
-- fresh database alike.

-- ── table privileges ─────────────────────────────────────────────────────────
-- Start from nothing for the client roles. Revoking a table privilege also drops its column grants, so the
-- column grants from 0001/0002 are restated below.
revoke all on all tables in schema public from anon, authenticated;

-- The service key is server-only and bypasses RLS; it needs plain data privileges on everything.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public grant usage, select on sequences to service_role;

-- Signed-in users read whatever RLS lets them see and write only what the dashboard writes directly.
-- euler_credentials stays server-only; anon (signed out) gets nothing.
grant select on
  public.agencies, public.agency_members, public.teams, public.profiles, public.creators, public.agency_accounts,
  public.tracked_targets, public.stream_status, public.gift_transactions, public.gift_purposes,
  public.euler_connections, public.euler_calls, public.gift_catalog
  to authenticated;
grant insert, update, delete on public.teams, public.creators, public.agency_accounts, public.gift_purposes to authenticated;
grant delete on public.tracked_targets to authenticated;
grant insert (agency_id, unique_id, source, label, active, kind, opponent_unique_id, anchor_id),
      update (agency_id, unique_id, source, label, active, kind, opponent_unique_id, anchor_id)
  on public.tracked_targets to authenticated;
grant update (name, agency_cut_pct, coin_usd, diamond_usd) on public.agencies to authenticated;
grant update (full_name, last_seen_at) on public.profiles to authenticated;

-- ── membership helper ────────────────────────────────────────────────────────
-- SECURITY DEFINER so it reads agency_members without re-entering that table's RLS. It lives in a schema the
-- Data API doesn't expose, so it can't be called over /rpc and the linter has no reason to flag it.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_agency_member(a uuid, roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = a and m.user_id = (select auth.uid())
      and (roles is null or m.role = any(roles))
  )
$$;
revoke all on function private.is_agency_member(uuid, text[]) from public;
-- Policies evaluate as the querying role, which therefore needs EXECUTE.
grant execute on function private.is_agency_member(uuid, text[]) to authenticated, service_role;

alter policy agencies_read on public.agencies using (private.is_agency_member(id));
alter policy agencies_update on public.agencies
  using (private.is_agency_member(id, array['founder'])) with check (private.is_agency_member(id, array['founder']));
alter policy members_read on public.agency_members using (private.is_agency_member(agency_id));
alter policy teams_read on public.teams using (private.is_agency_member(agency_id));
alter policy teams_write on public.teams
  using (private.is_agency_member(agency_id, array['founder'])) with check (private.is_agency_member(agency_id, array['founder']));
alter policy creators_read on public.creators using (private.is_agency_member(agency_id));
alter policy creators_write on public.creators
  using (private.is_agency_member(agency_id, array['founder', 'manager']))
  with check (private.is_agency_member(agency_id, array['founder', 'manager']));
alter policy accounts_read on public.agency_accounts using (private.is_agency_member(agency_id));
alter policy accounts_write on public.agency_accounts
  using (private.is_agency_member(agency_id, array['founder', 'manager']))
  with check (private.is_agency_member(agency_id, array['founder', 'manager']));
alter policy targets_read on public.tracked_targets using (private.is_agency_member(agency_id));
alter policy targets_insert on public.tracked_targets with check (private.is_agency_member(agency_id, array['founder', 'manager']));
alter policy targets_update on public.tracked_targets
  using (private.is_agency_member(agency_id, array['founder', 'manager']))
  with check (private.is_agency_member(agency_id, array['founder', 'manager']));
alter policy targets_delete on public.tracked_targets using (private.is_agency_member(agency_id, array['founder', 'manager']));
alter policy status_read on public.stream_status using (
  exists (select 1 from public.tracked_targets t
          where (t.unique_id = stream_status.unique_id or t.opponent_unique_id = stream_status.unique_id)
            and private.is_agency_member(t.agency_id))
);
alter policy gifts_read on public.gift_transactions using (private.is_agency_member(agency_id));
alter policy purposes_read on public.gift_purposes using (private.is_agency_member(agency_id));
alter policy purposes_write on public.gift_purposes
  using (private.is_agency_member(agency_id, array['founder', 'manager', 'moderator']))
  with check (private.is_agency_member(agency_id, array['founder', 'manager', 'moderator']));
alter policy connections_read on public.euler_connections using (private.is_agency_member(agency_id));
alter policy calls_read on public.euler_calls using (private.is_agency_member(agency_id));

-- Created on the live project outside the migrations; membership is written only by the API (service role).
drop policy if exists members_insert on public.agency_members;
drop policy if exists members_update on public.agency_members;
drop policy if exists members_delete on public.agency_members;

-- No CASCADE: this fails if anything still depends on the old helper.
drop function if exists public.is_agency_member(uuid, text[]);

-- ── function privileges ──────────────────────────────────────────────────────
-- Functions are executable by PUBLIC unless revoked. Default that off for new functions; each migration grants
-- EXECUTE to exactly the roles that need it.
alter default privileges for role postgres revoke execute on functions from public;

-- Dashboard RPCs run as the caller (security invoker), so RLS still scopes every row. Signed-in users only.
revoke all on function
  public.creator_stats(uuid, timestamptz, timestamptz),
  public.burn_series(uuid, timestamptz, timestamptz, int, text[]),
  public.ledger_page(uuid, timestamptz, timestamptz, text[], text, text, int, int),
  public.top_senders(uuid, timestamptz, int),
  public.target_stats(uuid),
  public.gift_usage(uuid)
  from public, anon;
grant execute on function
  public.creator_stats(uuid, timestamptz, timestamptz),
  public.burn_series(uuid, timestamptz, timestamptz, int, text[]),
  public.ledger_page(uuid, timestamptz, timestamptz, text[], text, text, int, int),
  public.top_senders(uuid, timestamptz, int),
  public.target_stats(uuid),
  public.gift_usage(uuid)
  to authenticated, service_role;

-- Trigger functions and internal helpers are never called directly; triggers fire regardless of EXECUTE.
revoke all on function
  public.handle_new_user(), public.enforce_creator_limit(), public.gift_purpose_same_agency(),
  public.touch_updated_at(), public.freeze_target_keys(), public.plan_creator_limit(text)
  from public, anon, authenticated;
alter function public.plan_creator_limit(text) set search_path = '';
alter function public.touch_updated_at() set search_path = '';
alter function public.freeze_target_keys() set search_path = '';
