-- Phase 6.5 — evergreen approval needs a future date; daily job moves due items to due_for_rereview; reviewer re-review
-- (sealed); lifecycle dates; withdrawal deadline = one Saudi business day (Sun–Thu, holidays). Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

-- Business days: Thu → Sun; Fri → Sun; Sun → Mon; a holiday is skipped.
do $$ begin
  if public.saudi_business_day_after('2026-11-19 10:00+03') <> '2026-11-22 10:00+03' then raise exception 'thu wrong'; end if;
  if public.saudi_business_day_after('2026-11-20 10:00+03') <> '2026-11-22 10:00+03' then raise exception 'fri wrong'; end if;
  if public.saudi_business_day_after('2026-11-22 09:30+03') <> '2026-11-23 09:30+03' then raise exception 'sun wrong'; end if;
  if public.saudi_business_day_after('2026-11-22 09:30+03', '{2026-11-23}') <> '2026-11-24 09:30+03' then raise exception 'holiday wrong'; end if;
end $$;

insert into auth.users (id, email) values
  ('1a000000-0000-0000-0000-000000000001', 'ow@life.test'), ('1a000000-0000-0000-0000-000000000002', 'rv@life.test'),
  ('1a000000-0000-0000-0000-000000000005', 'cr@life.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '1a000000-%';
insert into public.organizations (id, name, created_by) values ('2a000000-0000-0000-0000-000000000001', 'Life Bank', '1a000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'owner'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'reviewer'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000005', 'creator');
insert into public.org_settings (org_id, features) values ('2a000000-0000-0000-0000-000000000001', '{"lifecycle": true}')
on conflict (org_id) do update set features = excluded.features;

create or replace function pg_temp.as_user(_u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', _u, true), set_config('request.jwt.claim.role', 'authenticated', true)
$$;
create or replace function pg_temp.expect_error(_sql text, _code text) returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'expected % but the statement succeeded: %', _code, _sql;
exception when others then
  if sqlerrm not like '%' || _code || '%' then raise exception 'expected %, got %: %', _code, sqlerrm, _sql; end if;
end $$;

set local role authenticated;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000005');
insert into public.promotions (id, owner_id, org_id, title, communication_type) values
  ('4a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000005', '2a000000-0000-0000-0000-000000000001', 'E', 'financial_promotion');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256) values
  ('3a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000005', 'text', 'e', 'x', 'finance', '4a000000-0000-0000-0000-000000000001', 'e1');
do $$ begin
  perform public.set_evergreen('4a000000-0000-0000-0000-000000000001', true, null);
  perform pg_temp.expect_error($q$select public.set_evergreen('4a000000-0000-0000-0000-000000000001', true, current_date)$q$, 'code:next_review_required');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.submissions set status = 'done', analyzed_at = now() where id = '3a000000-0000-0000-0000-000000000001';

set local role authenticated;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000005');
select public.submit_promotion('4a000000-0000-0000-0000-000000000001');
-- D169: the owner assigns; reviewers never assign themselves.
select pg_temp.as_user('1a000000-0000-0000-0000-000000000001');
select public.assign_reviewer('4a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002');
select pg_temp.as_user('1a000000-0000-0000-0000-000000000002');
select public.open_review('4a000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.expect_error($q$select public.decide_promotion('4a000000-0000-0000-0000-000000000001', 'approve')$q$, 'code:next_review_required');
  perform public.set_evergreen('4a000000-0000-0000-0000-000000000001', true, current_date + 90);
  perform public.decide_promotion('4a000000-0000-0000-0000-000000000001', 'approve');
end $$;

-- Lifecycle dates and a regulator withdrawal request (owner only).
select pg_temp.as_user('1a000000-0000-0000-0000-000000000005');
do $$ begin
  perform public.record_lifecycle('4a000000-0000-0000-0000-000000000001', 'published', now());
  perform pg_temp.expect_error($q$select public.request_withdrawal('4a000000-0000-0000-0000-000000000001', now(), 'x')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000001');
do $$ begin
  if public.request_withdrawal('4a000000-0000-0000-0000-000000000001', '2026-11-12 10:00+03', 'طلب ساما') <> '2026-11-15 10:00+03' then raise exception 'due wrong'; end if;
end $$;

-- The date passes: the daily job moves it back to reviewers; the reviewer confirms with a new date.
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.promotions set next_review_at = current_date where id = '4a000000-0000-0000-0000-000000000001';
do $$ begin
  if (public.lifecycle_daily()->>'moved')::int <> 1 then raise exception 'not moved'; end if;
  if (select review_status from public.promotions where id = '4a000000-0000-0000-0000-000000000001') <> 'due_for_rereview' then raise exception 'not due'; end if;
  if not exists (select 1 from public.notifications where kind = 'withdrawal_due') then raise exception 'withdrawal not reminded'; end if;
end $$;
set local role authenticated;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.complete_rereview('4a000000-0000-0000-0000-000000000001', true, current_date + 30, null)$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000002');
do $$ begin
  perform pg_temp.expect_error($q$select public.complete_rereview('4a000000-0000-0000-0000-000000000001', true, current_date, null)$q$, 'code:next_review_required');
  perform public.complete_rereview('4a000000-0000-0000-0000-000000000001', true, current_date + 180, 'ما زال صالحاً');
  if (select review_status from public.promotions where id = '4a000000-0000-0000-0000-000000000001') <> 'approved' then raise exception 'not re-approved'; end if;
  if not (public.verify_decision_chain('4a000000-0000-0000-0000-000000000001')->>'valid')::boolean then raise exception 'chain broken'; end if;
end $$;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000001');
do $$ begin
  perform public.mark_withdrawn('4a000000-0000-0000-0000-000000000001', '');
  if (select review_status from public.promotions where id = '4a000000-0000-0000-0000-000000000001') <> 'withdrawn' then raise exception 'not withdrawn'; end if;
end $$;
reset role;

select pass('p6 lifecycle');
select * from finish();
rollback;
