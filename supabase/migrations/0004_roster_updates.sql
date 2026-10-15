-- Close the creator-limit bypass left by 0003's table-wide UPDATE grants.
--
-- The plan's creator limit (enforce_creator_limit) only runs on INSERT. With UPDATE on creators, a founder of
-- two agencies could fill the second one and move those rows into the first by changing agency_id, past the
-- first agency's limit. The dashboard only inserts and deletes rows in teams, creators and agency_accounts, so
-- signed-in users don't need UPDATE on them at all.
revoke update on public.creators, public.teams, public.agency_accounts from authenticated;

-- Defence in depth that also covers the service key: a creator never changes agency.
create or replace function public.freeze_creator_agency() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.agency_id <> old.agency_id then
    raise exception 'creators.agency_id is immutable' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.freeze_creator_agency() from public, anon, authenticated;
drop trigger if exists creators_freeze_agency on public.creators;
create trigger creators_freeze_agency before update of agency_id on public.creators
  for each row execute function public.freeze_creator_agency();
