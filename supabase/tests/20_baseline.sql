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
  'public.touch_updated_at()', 'public.freeze_target_keys()', 'public.plan_creator_limit(text)']) f,
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
