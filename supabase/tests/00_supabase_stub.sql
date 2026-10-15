-- Minimal stand-in for the Supabase platform so migrations + RLS tests run on plain Postgres.
-- Used only by supabase/tests/run.sh; never applied to a real project.
do $$ begin
  -- roles are cluster-wide, so tolerate reruns against the same server
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
-- Same defaults as the hosted project: new tables give the API roles no data privileges, and functions stay
-- executable by PUBLIC. Migrations must grant what the app needs, so the tests catch a missing grant.
alter default privileges in schema public grant references, trigger, truncate on tables to anon, authenticated, service_role;
create publication supabase_realtime;
