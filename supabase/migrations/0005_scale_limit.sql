-- Scale is sold with a 150-creator roster (it was unlimited). Mirrors PLANS in shared/src/constants.ts,
-- which shared/src/plans.test.ts checks. CREATE OR REPLACE keeps the function's privileges from 0003.
create or replace function public.plan_creator_limit(p text) returns int language sql immutable set search_path = '' as $$
  select case p when 'starter' then 10 when 'growth' then 50 when 'scale' then 150 end
$$;
