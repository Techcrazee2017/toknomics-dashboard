-- Scale is sold with a 150-creator roster (it was unlimited). Keep in sync with PLANS in
-- shared/src/constants.ts; backend/test/plans.test.ts reads this file to check. CREATE OR REPLACE keeps
-- each function's privileges and settings from 0003.
create or replace function public.plan_creator_limit(p text) returns int language sql immutable set search_path = '' as $$
  select case p when 'starter' then 10 when 'growth' then 50 when 'scale' then 150 end
$$;

-- Scale is the largest plan, so its limit message can't say "upgrade".
create or replace function public.enforce_creator_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; n int; pl text;
begin
  select plan, public.plan_creator_limit(plan) into pl, lim from public.agencies where id = new.agency_id;
  if lim is null then return new; end if;
  select count(*) into n from public.creators where agency_id = new.agency_id;
  if n >= lim then
    if pl = 'scale' then
      raise exception 'Your plan allows % creators. Email support@backwoodstechsolutions.com for a larger roster.', lim
        using errcode = 'P0001', hint = 'plan_limit';
    end if;
    raise exception 'Your plan allows % creators. Upgrade to add more.', lim using errcode = 'P0001', hint = 'plan_limit';
  end if;
  return new;
end $$;
