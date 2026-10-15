-- Ingestion per agency. Before this, one socket per creator was shared by every agency tracking them and
-- opened with whichever agency's key sorted first, so one customer's Euler key and quota collected another's
-- ledger. Now each (agency, creator) pair has its own status row, socket and key.
--
-- Also adds the API-key-only connection: key_status records whether the agency's Euler key was accepted, and
-- is all that live ingestion and the read-only tools need. OAuth / cookie (euler_connections.status) is only
-- for room moderation. stream_status is worker-owned runtime state with no history, so it is cleared;
-- the worker rewrites it within one reconcile.

-- ── Euler key state and cookie-risk acknowledgement ─────────────────────────
alter table public.euler_connections
  add column if not exists key_status text not null default 'unknown' check (key_status in ('unknown', 'valid', 'invalid')),
  add column if not exists cookie_ack_at timestamptz;
-- A connection only reached 'connected' after the key was verified against Euler, and disconnecting kept both the key and
-- the Euler account id it was verified as. Keep those agencies ingesting instead of asking every Founder to paste the key
-- again. A key replaced after that (the id is not cleared) can be wrongly marked valid, which corrects itself: Euler closes
-- its first socket with 4401 and the worker flags the key invalid. The opposite mistake would be an outage until re-paste.
update public.euler_connections set key_status = 'valid'
  where api_key_last4 is not null and (status = 'connected' or euler_account_id is not null);

-- ── stream_status: one row per (agency, creator) ────────────────────────────
delete from public.stream_status;
alter table public.stream_status
  drop constraint if exists stream_status_pkey,
  add column agency_id uuid not null references public.agencies on delete cascade,
  add column worker_id text,
  add primary key (agency_id, unique_id);
alter table public.stream_status drop constraint if exists stream_status_status_check;
alter table public.stream_status add constraint stream_status_status_check
  check (status in ('connecting', 'live', 'offline', 'backoff', 'auth_error', 'invalid', 'stopped', 'paused', 'capacity'));

alter policy status_read on public.stream_status using (private.is_agency_member(agency_id));

-- ── target_stats: session start comes from this agency's own status row ─────
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
    from ids left join public.stream_status ss on ss.unique_id = ids.uid and ss.agency_id = p_agency
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
