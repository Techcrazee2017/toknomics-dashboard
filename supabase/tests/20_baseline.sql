-- Privilege baseline (0003): exactly which roles can touch which tables and functions. Runs after
-- 10_rls_and_stats.sql, whose fixtures it reuses (agencies A/B and their members).
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL %', label; end if;
  raise notice 'PASS %', label;
end $$;
grant execute on function pg_temp.expect(boolean, text) to public;

-- ── tables ──  (a comma-separated privilege list means "any of", so "has all" checks go one privilege at a time)
select pg_temp.expect(bool_and(has_table_privilege('service_role', c.oid, p)),
  'service_role reads and writes every public table')
from pg_class c, unnest(array['select', 'insert', 'update', 'delete']) p
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r';

select pg_temp.expect(not bool_or(has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate')),
  'anon has no privileges on any public table')
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r';

select pg_temp.expect(bool_and(has_table_privilege('authenticated', t::regclass, 'select')), 'authenticated reads every app table')
from unnest(array['agencies', 'agency_members', 'teams', 'profiles', 'creators', 'agency_accounts', 'tracked_targets',
  'stream_status', 'gift_transactions', 'gift_purposes', 'euler_connections', 'euler_calls', 'gift_catalog']) t;

select pg_temp.expect(not has_table_privilege('authenticated', 'public.euler_credentials', 'select, insert, update, delete')
  and not has_any_column_privilege('authenticated', 'public.euler_credentials', 'select'),
  'euler_credentials is server-only');

select pg_temp.expect(not bool_or(has_table_privilege('authenticated', t::regclass, 'insert, delete, truncate')
    or has_any_column_privilege('authenticated', t::regclass, 'update')),
  'authenticated cannot write server-owned tables')
from unnest(array['agency_members', 'euler_connections', 'euler_calls', 'gift_catalog', 'gift_transactions', 'stream_status']) t;

select pg_temp.expect(not has_table_privilege('authenticated', 'public.agencies', 'insert, delete')
  and not has_column_privilege('authenticated', 'public.agencies', 'plan', 'update')
  and not has_column_privilege('authenticated', 'public.agencies', 'subscription_status', 'update')
  and has_column_privilege('authenticated', 'public.agencies', 'agency_cut_pct', 'update'),
  'agencies: only the settings columns are client-writable');

-- 0004: rows in these tables are only inserted and deleted by the dashboard; UPDATE allowed moving creators
-- between agencies past the plan's creator limit.
select pg_temp.expect(not bool_or(has_any_column_privilege('authenticated', t::regclass, 'update'))
    and bool_and(has_table_privilege('authenticated', t::regclass, 'insert') and has_table_privilege('authenticated', t::regclass, 'delete')),
  'creators/teams/agency_accounts: insert and delete only')
from unnest(array['creators', 'teams', 'agency_accounts']) t;

select pg_temp.expect(has_table_privilege('authenticated', 'public.gift_purposes', 'update'), 'gift_purposes keeps UPDATE for the tagging upsert');

select pg_temp.expect(has_column_privilege('authenticated', 'public.tracked_targets', 'opponent_unique_id', 'insert')
  and not has_column_privilege('authenticated', 'public.tracked_targets', 'created_by', 'insert')
  and not has_column_privilege('authenticated', 'public.profiles', 'email', 'update'),
  'column grants restated after the revoke');

-- ── functions ──
select pg_temp.expect(to_regprocedure('public.is_agency_member(uuid, text[])') is null, 'old public.is_agency_member is gone');

select pg_temp.expect(p.prosecdef and p.proconfig = array['search_path=""'], 'private.is_agency_member is security definer, empty search_path')
from pg_proc p where p.oid = 'private.is_agency_member(uuid, text[])'::regprocedure;

select pg_temp.expect(not exists (
  select 1 from pg_policies where schemaname = 'public' and (qual like '%public.is_agency_member%' or with_check like '%public.is_agency_member%')),
  'no policy references the old helper');

select pg_temp.expect((select array_agg(policyname order by policyname) from pg_policies
  where schemaname = 'public' and tablename = 'agency_members') = array['members_read']::name[],
  'agency_members has only the read policy');

select pg_temp.expect(bool_and(has_function_privilege('authenticated', f::regprocedure, 'execute')
    and not has_function_privilege('anon', f::regprocedure, 'execute')),
  'dashboard RPCs: authenticated yes, anon no')
from unnest(array['public.creator_stats(uuid, timestamptz, timestamptz)',
  'public.burn_series(uuid, timestamptz, timestamptz, int, text[])',
  'public.ledger_page(uuid, timestamptz, timestamptz, text[], text, text, int, int)',
  'public.top_senders(uuid, timestamptz, int)', 'public.target_stats(uuid)', 'public.gift_usage(uuid)']) f;

select pg_temp.expect(not bool_or(has_function_privilege(r, f::regprocedure, 'execute')),
  'trigger and internal functions are not callable by API roles')
from unnest(array['public.handle_new_user()', 'public.enforce_creator_limit()', 'public.gift_purpose_same_agency()',
  'public.touch_updated_at()', 'public.freeze_target_keys()', 'public.plan_creator_limit(text)',
  'public.freeze_creator_agency()']) f,
  unnest(array['anon', 'authenticated']) r;

-- ── behaviour ──
-- A trigger still fires for a role that can't EXECUTE its function (Supabase Auth inserting users).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'auth_writer_sim') then create role auth_writer_sim nologin; end if;
end $$;
grant usage on schema auth to auth_writer_sim;
grant insert on auth.users to auth_writer_sim;
set role auth_writer_sim;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'new@signup.test');
reset role;
select pg_temp.expect(exists (select 1 from profiles where user_id = '00000000-0000-0000-0000-0000000000e1'),
  'handle_new_user still creates the profile');

-- Members read their membership rows through the definer helper without recursing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
set role authenticated;
select pg_temp.expect((select count(*) from agency_members) = 3, 'founder reads agency A members without recursion');
reset role;

-- The server key writes server-owned tables.
set role service_role;
insert into euler_connections (agency_id) values ('b0000000-0000-0000-0000-000000000002') on conflict do nothing;
select pg_temp.expect(exists (select 1 from euler_connections where agency_id = 'b0000000-0000-0000-0000-000000000002'),
  'service_role writes euler_connections');
reset role;

-- Signed-out callers are refused outright.
set role anon;
do $$ begin
  perform 1 from public.agencies;
  raise exception 'FAIL anon read agencies';
exception when insufficient_privilege then raise notice 'PASS anon cannot read agencies';
end $$;
do $$ begin
  perform public.target_stats('a0000000-0000-0000-0000-000000000001');
  raise exception 'FAIL anon called target_stats';
exception when insufficient_privilege then raise notice 'PASS anon cannot call dashboard RPCs';
end $$;
reset role;

-- ── creator-limit bypass (0004) ──
-- A founder of two agencies can't move creators between them, and neither can the service key.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d2', 'dual@founder.test');
insert into agency_members (agency_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d2', 'founder'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d2', 'founder');
insert into creators (id, agency_id, unique_id) values ('c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000002', 'movable_b');
insert into teams (id, agency_id, name) values ('70000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'Doomed team');
insert into creators (id, agency_id, unique_id, team_id)
  values ('c0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'on_team_a', '70000000-0000-0000-0000-0000000000a1');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
set role authenticated;
do $$ begin
  update public.creators set agency_id = 'a0000000-0000-0000-0000-000000000001' where id = 'c0000000-0000-0000-0000-0000000000b1';
  raise exception 'FAIL founder moved a creator between agencies';
exception when insufficient_privilege then raise notice 'PASS founder of two agencies cannot move a creator';
end $$;
-- Deleting a team still clears its creators' team (the FK action runs as the table owner).
delete from teams where id = '70000000-0000-0000-0000-0000000000a1';
reset role;
select pg_temp.expect((select team_id is null from creators where id = 'c0000000-0000-0000-0000-0000000000a1'),
  'deleting a team still clears creators.team_id');

set role service_role;
do $$ begin
  update public.creators set agency_id = 'a0000000-0000-0000-0000-000000000001' where id = 'c0000000-0000-0000-0000-0000000000b1';
  raise exception 'FAIL service_role moved a creator between agencies';
exception when insufficient_privilege then raise notice 'PASS creators.agency_id is immutable even for the service key';
end $$;
reset role;

-- ── plan roster limits (0005) ──
select pg_temp.expect(public.plan_creator_limit('starter') = 10 and public.plan_creator_limit('growth') = 50
  and public.plan_creator_limit('scale') = 150, 'roster limits are 10 / 50 / 150');
insert into agencies (id, name, plan) values ('5ca1e000-0000-0000-0000-000000000150', 'Scale cap', 'scale');
insert into creators (agency_id, unique_id) select '5ca1e000-0000-0000-0000-000000000150', 'scale_' || g from generate_series(1, 150) g;
do $$ begin
  insert into public.creators (agency_id, unique_id) values ('5ca1e000-0000-0000-0000-000000000150', 'scale_151');
  raise exception 'FAIL scale plan allowed a 151st creator';
exception when raise_exception then raise notice 'PASS scale plan caps the roster at 150';
end $$;
