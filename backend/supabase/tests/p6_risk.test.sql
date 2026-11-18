-- Phase 6.2 — risk acceptance: flag, designated acceptors, SoD, reason required, accept is sealed and never an approval,
-- decline returns to the previous status. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('17000000-0000-0000-0000-000000000001', 'ow@risk.test'), ('17000000-0000-0000-0000-000000000002', 'rv@risk.test'),
  ('17000000-0000-0000-0000-000000000003', 'cro@risk.test'), ('17000000-0000-0000-0000-000000000005', 'cr@risk.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '17000000-%';
insert into public.organizations (id, name, created_by) values ('27000000-0000-0000-0000-000000000001', 'Risk Bank', '17000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'owner'),
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000002', 'reviewer'),
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000003', 'admin'),
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000005', 'creator');

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
select pg_temp.as_user('17000000-0000-0000-0000-000000000005');
insert into public.promotions (id, owner_id, org_id, title, communication_type) values
  ('47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000005', '27000000-0000-0000-0000-000000000001', 'R', 'financial_promotion');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256) values
  ('37000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000005', 'text', 'r', 'x', 'finance', '47000000-0000-0000-0000-000000000001', 'r1');
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.submissions set status = 'done', analyzed_at = now() where id = '37000000-0000-0000-0000-000000000001';

-- Rejected by the reviewer through the normal flow.
set local role authenticated;
select pg_temp.as_user('17000000-0000-0000-0000-000000000005');
select public.submit_promotion('47000000-0000-0000-0000-000000000001');
select pg_temp.as_user('17000000-0000-0000-0000-000000000002');
select public.open_review('47000000-0000-0000-0000-000000000001');
select public.decide_promotion('47000000-0000-0000-0000-000000000001', 'reject', '{}', 'مضلل');

-- Flag off → not available; only owners/admins designate acceptors.
select pg_temp.as_user('17000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.request_risk_acceptance('47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000003', 'حملة محدودة')$q$, 'code:feature_off');
  perform pg_temp.expect_error($q$select public.set_risk_acceptor('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000003', true)$q$, 'code:forbidden');
  perform pg_temp.expect_error($q$update public.org_members set can_accept_risk = true$q$, 'permission denied');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.org_settings (org_id, features) values ('27000000-0000-0000-0000-000000000001', '{"risk_acceptance": true}')
on conflict (org_id) do update set features = excluded.features;
set local role authenticated;
select pg_temp.as_user('17000000-0000-0000-0000-000000000001');
select public.set_risk_acceptor('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000003', true);

select pg_temp.as_user('17000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.request_risk_acceptance('47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000002', 'x')$q$, 'code:not_risk_acceptor');
  perform pg_temp.expect_error($q$select public.request_risk_acceptance('47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000003', ' ')$q$, 'code:reason_required');
  perform public.request_risk_acceptance('47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000003', 'حملة محدودة لمدة أسبوع');
  if (select review_status from public.promotions where id = '47000000-0000-0000-0000-000000000001') <> 'reviewing_risk' then raise exception 'not reviewing_risk'; end if;
end $$;

-- Decline returns to rejected.
select pg_temp.as_user('17000000-0000-0000-0000-000000000002');
do $$ begin
  perform pg_temp.expect_error($q$select public.decide_risk('47000000-0000-0000-0000-000000000001', true, 'x')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('17000000-0000-0000-0000-000000000003');
do $$ begin
  perform public.decide_risk('47000000-0000-0000-0000-000000000001', false, 'المخاطر عالية');
  if (select review_status from public.promotions where id = '47000000-0000-0000-0000-000000000001') <> 'rejected' then raise exception 'decline did not restore'; end if;
end $$;

-- Ask again; accept → risk_accepted, sealed, never an approval.
select pg_temp.as_user('17000000-0000-0000-0000-000000000005');
select public.request_risk_acceptance('47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000003', 'بعد التعديل');
select pg_temp.as_user('17000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$select public.decide_risk('47000000-0000-0000-0000-000000000001', true, '')$q$, 'code:reason_required');
  perform public.decide_risk('47000000-0000-0000-0000-000000000001', true, 'مقبول لمدة الحملة');
  if (select review_status from public.promotions where id = '47000000-0000-0000-0000-000000000001') <> 'risk_accepted' then raise exception 'not risk_accepted'; end if;
  if (select approved_at from public.promotions where id = '47000000-0000-0000-0000-000000000001') is not null then raise exception 'risk acceptance counted as approval'; end if;
  if (select decision from public.review_decisions where promotion_id = '47000000-0000-0000-0000-000000000001' order by created_at desc limit 1) <> 'risk_accept' then raise exception 'no sealed decision'; end if;
  if not (public.verify_decision_chain('47000000-0000-0000-0000-000000000001')->>'valid')::boolean then raise exception 'chain broken'; end if;
end $$;
reset role;

select pass('p6 risk acceptance');
select * from finish();
rollback;
