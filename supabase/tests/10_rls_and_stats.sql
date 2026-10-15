-- RLS + stats RPC assertions. Run by supabase/tests/run.sh on a throwaway database.
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.expect_denied(sql text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL % — statement succeeded', label;
exception
  when insufficient_privilege then raise notice 'PASS %', label;
  when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlstate in ('42501', 'P0001', '23514') then raise notice 'PASS % (%)', label, sqlstate;
    else raise exception 'FAIL % — unexpected % %', label, sqlstate, sqlerrm; end if;
end $$;

create or replace function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL %', label; end if;
  raise notice 'PASS %', label;
end $$;
-- New functions aren't executable by PUBLIC (0003), and these run after `set role authenticated`.
grant execute on function pg_temp.as_user(uuid), pg_temp.expect_denied(text, text), pg_temp.expect(boolean, text) to public;

-- ── fixtures (superuser) ──
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000f', 'founder@a.test'),
  ('00000000-0000-0000-0000-00000000000a', 'manager@a.test'),
  ('00000000-0000-0000-0000-00000000000d', 'mod@a.test'),
  ('00000000-0000-0000-0000-00000000000b', 'founder@b.test');
insert into agencies (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'Agency A'),
  ('b0000000-0000-0000-0000-000000000002', 'Agency B');
insert into agency_members (agency_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000f', 'founder'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'manager'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'moderator'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'founder');
insert into agency_accounts (agency_id, unique_id) values ('a0000000-0000-0000-0000-000000000001', 'tn.vault');
insert into euler_credentials (agency_id, api_key_enc) values ('a0000000-0000-0000-0000-000000000001', 'ciphertext');
insert into euler_connections (agency_id, status) values ('a0000000-0000-0000-0000-000000000001', 'connected');
insert into gift_transactions (agency_id, creator_unique_id, msg_id, sender_unique_id, gift_id, gift_name, diamond_count, repeat_count, occurred_at) values
  ('a0000000-0000-0000-0000-000000000001', 'nova_shift', 'm1', 'tn.vault', 5655, 'Rose', 1, 7, now() - interval '2 minutes'),
  ('a0000000-0000-0000-0000-000000000001', 'nova_shift', 'm2', 'random.fan', 6369, 'Lion', 29999, 1, now() - interval '1 minute'),
  ('a0000000-0000-0000-0000-000000000001', 'nova_shift', 'm3', 'tn.vault', 6369, 'Lion', 29999, 1, now() - interval '40 days'),
  ('b0000000-0000-0000-0000-000000000002', 'nova_shift', 'm1', 'tn.vault', 5655, 'Rose', 1, 7, now() - interval '2 minutes');

select pg_temp.expect((select count(*) from profiles) = 4, 'profiles created by auth.users trigger');
select id as a_gift_id from gift_transactions where agency_id = 'a0000000-0000-0000-0000-000000000001' and msg_id = 'm2' \gset

-- ── manager of A ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into tracked_targets (agency_id, unique_id, source, kind, opponent_unique_id)
  values ('a0000000-0000-0000-0000-000000000001', 'nova_shift', 'battle', 'battle', 'lumen.rise');
select pg_temp.expect(true, 'manager tracks a battle target');
select pg_temp.expect_denied($$insert into tracked_targets (agency_id, unique_id, kind) values ('a0000000-0000-0000-0000-000000000001', 'solo', 'battle')$$, 'battle without opponent rejected');
insert into creators (agency_id, unique_id, tier) values ('a0000000-0000-0000-0000-000000000001', 'nova_shift', 'S');
select pg_temp.expect(true, 'manager adds a creator');
select pg_temp.expect_denied($$insert into gift_transactions (agency_id, creator_unique_id, msg_id, gift_id, diamond_count, occurred_at) values ('a0000000-0000-0000-0000-000000000001', 'x', 'z', 1, 1, now())$$, 'manager cannot write gift_transactions');
select pg_temp.expect_denied($$select * from euler_credentials$$, 'credentials unreadable to members');
select pg_temp.expect((select status from euler_connections) = 'connected', 'members read connection status');
select pg_temp.expect_denied($$update euler_connections set status = 'disconnected'$$, 'members cannot write connection status');
select pg_temp.expect_denied($$update agency_members set role = 'founder' where user_id = auth.uid()$$, 'manager cannot promote self');
select pg_temp.expect_denied($$update agencies set plan = 'scale'$$, 'plan only writable by server');
select pg_temp.expect((select count(*) from gift_transactions) = 3, 'manager sees only own agency gifts');

-- stats
select pg_temp.expect((select invested_coins = 7 and received_diamonds = 30006 and agency_gifts = 1
  from creator_stats('a0000000-0000-0000-0000-000000000001', now() - interval '7 days', now() + interval '1 minute')), 'creator_stats splits agency outlay from creator income');
select pg_temp.expect((select sum(invested_coins) = 7 and sum(received_diamonds) = 30006 and count(*) = 7
  from burn_series('a0000000-0000-0000-0000-000000000001', now() - interval '7 days', now() + interval '1 minute', 7)), 'burn_series buckets match totals');
select pg_temp.expect((select count(*) = 1 and max(total_count) = 1 and max(coins) = 7
  from ledger_page('a0000000-0000-0000-0000-000000000001', now() - interval '7 days', now() + interval '1 minute')), 'ledger_page lists only agency senders in range');
select pg_temp.expect((select count(*) = 0 from ledger_page('a0000000-0000-0000-0000-000000000001', now() - interval '7 days', now() + interval '1 minute', null, null, '100%')), 'ledger search escapes wildcards');
select pg_temp.expect((select coins_in = 30006 and agency_out = 7 and array_length(series, 1) = 28
  from target_stats('a0000000-0000-0000-0000-000000000001') where unique_id = 'nova_shift'), 'target_stats totals + 28-point series');
select pg_temp.expect((select count(*) = 2 from target_stats('a0000000-0000-0000-0000-000000000001')), 'target_stats includes battle opponent');
select pg_temp.expect((select is_agency from top_senders('a0000000-0000-0000-0000-000000000001', now() - interval '1 day') where sender_unique_id = 'tn.vault'), 'top_senders flags agency accounts');

-- ── moderator of A ──
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_denied($$insert into creators (agency_id, unique_id) values ('a0000000-0000-0000-0000-000000000001', 'other')$$, 'moderator cannot edit roster');
insert into gift_purposes (gift_tx_id, agency_id, purpose)
  select id, agency_id, 'battle_support' from gift_transactions where msg_id = 'm1';
select pg_temp.expect((select purpose from ledger_page('a0000000-0000-0000-0000-000000000001', now() - interval '1 day', now() + interval '1 minute')) = 'battle_support', 'moderator tags a gift purpose');

-- ── founder of B ──
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from gift_transactions) = 1, 'agency B isolated from A');
select pg_temp.expect((select count(*) from creator_stats('a0000000-0000-0000-0000-000000000001', now() - interval '7 days', now())) = 0, 'B gets nothing from A stats');
select pg_temp.expect_denied(format($$insert into gift_purposes (gift_tx_id, agency_id, purpose) values (%s, 'b0000000-0000-0000-0000-000000000002', 'retention')$$,
  :a_gift_id), 'cannot tag another agency''s gift');
select pg_temp.expect((select count(*) from profiles) = 1, 'B sees only own profile');

-- ── plan limit ──
reset role;
insert into creators (agency_id, unique_id) select 'b0000000-0000-0000-0000-000000000002', 'c' || g from generate_series(10, 19) g;
select pg_temp.expect_denied($$insert into creators (agency_id, unique_id) values ('b0000000-0000-0000-0000-000000000002', 'c99')$$, 'starter plan caps the roster at 10');
update agencies set plan = 'growth' where id = 'b0000000-0000-0000-0000-000000000002';
insert into creators (agency_id, unique_id) values ('b0000000-0000-0000-0000-000000000002', 'c99');
select pg_temp.expect(true, 'growth plan allows the 11th creator');
