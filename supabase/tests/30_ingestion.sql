-- Per-agency ingestion (0006). Runs after 10_ and 20_, whose fixtures it reuses
-- (agency A: founder f, manager a, moderator d; agency B: founder b).
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL %', label; end if;
  raise notice 'PASS %', label;
end $$;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  execute 'set role authenticated';
end $$;
grant execute on function pg_temp.expect(boolean, text), pg_temp.as_user(uuid) to public;

-- ── key_status ──
select pg_temp.expect((select key_status from euler_connections where agency_id = 'a0000000-0000-0000-0000-000000000001') = 'unknown',
  'a connection starts with an unverified key');
do $$ begin
  update euler_connections set key_status = 'bogus' where agency_id = 'a0000000-0000-0000-0000-000000000001';
  raise exception 'FAIL key_status accepted an unknown value';
exception when check_violation then raise notice 'PASS key_status rejects unknown values';
end $$;

-- ── stream_status is one row per (agency, creator) ──
insert into stream_status (agency_id, unique_id, status, room_id, session_started_at) values
  ('a0000000-0000-0000-0000-000000000001', 'nova_shift', 'live', '7400', now() - interval '10 minutes'),
  ('b0000000-0000-0000-0000-000000000002', 'nova_shift', 'capacity', null, null);
do $$ begin
  insert into stream_status (agency_id, unique_id, status) values ('a0000000-0000-0000-0000-000000000001', 'nova_shift', 'live');
  raise exception 'FAIL duplicate (agency, creator) status row accepted';
exception when unique_violation then raise notice 'PASS one status row per (agency, creator)';
end $$;
do $$ begin
  insert into stream_status (agency_id, unique_id, status) values ('a0000000-0000-0000-0000-000000000001', 'x', 'nonsense');
  raise exception 'FAIL stream_status accepted an unknown status';
exception when check_violation then raise notice 'PASS stream_status rejects unknown statuses';
end $$;

-- ── each agency reads only its own status ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select count(*) from stream_status) = 1 and (select status from stream_status) = 'live',
  'agency A sees only its own live status for a creator both agencies track');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from stream_status) = 1 and (select status from stream_status) = 'capacity',
  'agency B sees only its own status for the same creator');
do $$ begin
  insert into public.stream_status (agency_id, unique_id, status) values ('b0000000-0000-0000-0000-000000000002', 'y', 'live');
  raise exception 'FAIL a member wrote stream_status';
exception when insufficient_privilege then raise notice 'PASS members cannot write stream_status';
end $$;
reset role;

-- ── target_stats takes the session start from the caller's agency, not another agency's socket ──
insert into tracked_targets (agency_id, unique_id) values ('b0000000-0000-0000-0000-000000000002', 'nova_shift')
  on conflict do nothing;
insert into gift_transactions (agency_id, creator_unique_id, msg_id, sender_unique_id, gift_id, gift_name, diamond_count, repeat_count, occurred_at)
  values ('b0000000-0000-0000-0000-000000000002', 'nova_shift', 'recent', 'tn.vault', 5655, 'Rose', 5, 1, now() - interval '30 minutes');
-- B already has a 7-coin gift from 2 minutes ago. Its own status row has no session start, so the window falls
-- back to the last hour and the 30-minute-old 5-coin gift counts too (12). Reading A's row (session started
-- 10 minutes ago) would drop it (7).
select pg_temp.expect((select coins_in from target_stats('b0000000-0000-0000-0000-000000000002') where unique_id = 'nova_shift') = 12,
  'target_stats uses the caller agency''s own session start');

-- ── deleting an agency removes its status rows ──
delete from stream_status where agency_id = 'b0000000-0000-0000-0000-000000000002';
select pg_temp.expect((select count(*) from stream_status) = 1, 'status rows are scoped per agency');

-- ── atomic credential functions ──
insert into euler_connections (agency_id) values ('b0000000-0000-0000-0000-000000000002') on conflict do nothing;
set role service_role;
select public.save_euler_key('a0000000-0000-0000-0000-000000000001', 'v1.new', '9999', 77);
reset role;
select pg_temp.expect((select api_key_enc = 'v1.new' and oauth_access_enc is null from euler_credentials where agency_id = 'a0000000-0000-0000-0000-000000000001')
  and (select key_status = 'valid' and api_key_last4 = '9999' and euler_account_id = 77 and status = 'disconnected'
       from euler_connections where agency_id = 'a0000000-0000-0000-0000-000000000001'),
  'save_euler_key writes the ciphertext and the verified metadata together');
set role service_role;
do $$ begin
  perform public.save_euler_key('c0000000-0000-0000-0000-00000000dead', 'v1.x', '1111', 1);
  raise exception 'FAIL save_euler_key accepted an agency with no connection';
exception when foreign_key_violation or sqlstate 'P0002' then raise notice 'PASS save_euler_key rejects an unknown agency';
end $$;
reset role;
select pg_temp.expect(not exists (select 1 from euler_credentials where agency_id = 'c0000000-0000-0000-0000-00000000dead'),
  'a rejected save leaves no orphan ciphertext');
set role service_role;
select public.delete_euler_credentials('a0000000-0000-0000-0000-000000000001');
reset role;
select pg_temp.expect((select api_key_enc is null and cookie_enc is null and oauth_access_enc is null from euler_credentials where agency_id = 'a0000000-0000-0000-0000-000000000001')
  and (select key_status = 'unknown' and api_key_last4 is null and euler_account_id is null and not has_cookie
       from euler_connections where agency_id = 'a0000000-0000-0000-0000-000000000001'),
  'delete_euler_credentials wipes the secrets and resets the connection together');
select pg_temp.expect(not has_function_privilege('authenticated', 'public.save_euler_key(uuid, text, text, bigint)', 'execute')
  and not has_function_privilege('anon', 'public.delete_euler_credentials(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.save_euler_key(uuid, text, text, bigint)', 'execute'),
  'credential functions are service_role only');
