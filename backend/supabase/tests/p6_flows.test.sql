-- Phase 6.1 — multi-level approval: sequential, parallel, separation of duties, carry-forward, fresh review,
-- preset replacement discards step decisions, flag off = single-reviewer flow. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('16000000-0000-0000-0000-000000000001', 'ow@flow.test'), ('16000000-0000-0000-0000-000000000002', 'ad@flow.test'),
  ('16000000-0000-0000-0000-000000000003', 'rv1@flow.test'), ('16000000-0000-0000-0000-000000000004', 'rv2@flow.test'),
  ('16000000-0000-0000-0000-000000000005', 'cr@flow.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '16000000-%';
insert into public.organizations (id, name, created_by) values ('26000000-0000-0000-0000-000000000001', 'Flow Bank', '16000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'owner'),
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', 'admin'),
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003', 'reviewer'),
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000004', 'reviewer'),
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000005', 'creator');

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
create or replace function pg_temp.step(_pid text, _no int) returns uuid language sql as $$
  select id from public.promotion_review_steps where promotion_id = _pid::uuid and step_no = _no and flow_no = public.current_flow_no(_pid::uuid)
$$;
create or replace function pg_temp.step_status(_pid text, _no int) returns text language sql as $$
  select status from public.promotion_review_steps where promotion_id = _pid::uuid and step_no = _no and flow_no = public.current_flow_no(_pid::uuid)
$$;

-- Creator uploads three promotions (A sequential, B parallel, C flag-off later).
set local role authenticated;
select pg_temp.as_user('16000000-0000-0000-0000-000000000005');
insert into public.promotions (id, owner_id, org_id, title, communication_type) values
  ('46000000-0000-0000-0000-00000000000a', '16000000-0000-0000-0000-000000000005', '26000000-0000-0000-0000-000000000001', 'A', 'financial_promotion'),
  ('46000000-0000-0000-0000-00000000000b', '16000000-0000-0000-0000-000000000005', '26000000-0000-0000-0000-000000000001', 'B', 'financial_promotion'),
  ('46000000-0000-0000-0000-00000000000c', '16000000-0000-0000-0000-000000000005', '26000000-0000-0000-0000-000000000001', 'C', 'financial_promotion');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256) values
  ('36000000-0000-0000-0000-00000000000a', '16000000-0000-0000-0000-000000000005', 'text', 'a', 'x', 'finance', '46000000-0000-0000-0000-00000000000a', 'a1'),
  ('36000000-0000-0000-0000-00000000000b', '16000000-0000-0000-0000-000000000005', 'text', 'b', 'x', 'finance', '46000000-0000-0000-0000-00000000000b', 'b1'),
  ('36000000-0000-0000-0000-00000000000c', '16000000-0000-0000-0000-000000000005', 'text', 'c', 'x', 'finance', '46000000-0000-0000-0000-00000000000c', 'c1');
do $$ begin
  perform pg_temp.expect_error($q$select public.save_approval_preset('26000000-0000-0000-0000-000000000001', null, 'x', 'sequential', true, '[{"role":"reviewer","label_ar":"x"}]')$q$, 'code:forbidden');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.submissions set status = 'done', analyzed_at = now() where id::text like '36000000-%';

-- Flag off: the single-reviewer flow is unchanged.
set local role authenticated;
select pg_temp.as_user('16000000-0000-0000-0000-000000000005');
do $$ begin
  perform public.submit_promotion('46000000-0000-0000-0000-00000000000c');
  if exists (select 1 from public.promotion_review_steps where promotion_id = '46000000-0000-0000-0000-00000000000c') then raise exception 'steps created with flag off'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.org_settings (org_id, features) values ('26000000-0000-0000-0000-000000000001', '{"multi_level_approval": true}')
on conflict (org_id) do update set features = excluded.features;

-- Admin: sequential default preset (reviewer → named admin) and a parallel preset (reviewer + reviewer).
set local role authenticated;
select pg_temp.as_user('16000000-0000-0000-0000-000000000002');
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
do $$ begin
  insert into ids values ('seq', public.save_approval_preset('26000000-0000-0000-0000-000000000001', null, 'تسلسلي', 'sequential', true,
    '[{"role":"reviewer","label_ar":"الالتزام"},{"user_ids":["16000000-0000-0000-0000-000000000002"],"label_ar":"القانونية"}]'));
  insert into ids values ('par', public.save_approval_preset('26000000-0000-0000-0000-000000000001', null, 'متوازي', 'parallel', false,
    '[{"role":"reviewer","label_ar":"أ"},{"role":"reviewer","label_ar":"ب"}]'));
  perform pg_temp.expect_error($q$select public.save_approval_preset('26000000-0000-0000-0000-000000000001', null, 'x', 'sequential', false, '[{"user_ids":["16000000-0000-0000-0000-000000000005"],"label_ar":"x"}]')$q$, 'code:not_a_reviewer');
end $$;

-- A: sequential.
select pg_temp.as_user('16000000-0000-0000-0000-000000000005');
do $$ begin
  if (public.preset_preview('46000000-0000-0000-0000-00000000000a')->>'mode') <> 'sequential' then raise exception 'preview'; end if;
  perform public.submit_promotion('46000000-0000-0000-0000-00000000000a');
  if pg_temp.step_status('46000000-0000-0000-0000-00000000000a', 1) <> 'open' or pg_temp.step_status('46000000-0000-0000-0000-00000000000a', 2) <> 'waiting' then
    raise exception 'sequential start wrong';
  end if;
  perform pg_temp.expect_error(format('select public.decide_promotion_step(%L, %L, %L)', '46000000-0000-0000-0000-00000000000a',
    pg_temp.step('46000000-0000-0000-0000-00000000000a', 1), 'approve'), 'code:forbidden');
end $$;
select pg_temp.as_user('16000000-0000-0000-0000-000000000003');
do $$ begin
  if (public.can_decide('46000000-0000-0000-0000-00000000000a')->'reasons') ? 'multi_level_flow' is not true then raise exception 'single decision not blocked'; end if;
  perform pg_temp.expect_error(format('select public.decide_promotion_step(%L, %L, %L)', '46000000-0000-0000-0000-00000000000a',
    pg_temp.step('46000000-0000-0000-0000-00000000000a', 2), 'approve'), 'code:');
  perform pg_temp.expect_error(format('select public.decide_promotion_step(%L, %L, %L)', '46000000-0000-0000-0000-00000000000a',
    pg_temp.step('46000000-0000-0000-0000-00000000000a', 1), 'conditional_approve'), 'code:not_available_in_flow');
  perform public.decide_promotion_step('46000000-0000-0000-0000-00000000000a', pg_temp.step('46000000-0000-0000-0000-00000000000a', 1), 'approve');
  if (select review_status from public.promotions where id = '46000000-0000-0000-0000-00000000000a') <> 'in_review' then raise exception 'approved too early'; end if;
  if pg_temp.step_status('46000000-0000-0000-0000-00000000000a', 2) <> 'open' then raise exception 'next step not opened'; end if;
  perform pg_temp.expect_error(format('select public.decide_promotion_step(%L, %L, %L)', '46000000-0000-0000-0000-00000000000a',
    pg_temp.step('46000000-0000-0000-0000-00000000000a', 2), 'approve'), 'code:not_step_assignee');
end $$;
select pg_temp.as_user('16000000-0000-0000-0000-000000000002');
do $$ begin
  perform public.decide_promotion_step('46000000-0000-0000-0000-00000000000a', pg_temp.step('46000000-0000-0000-0000-00000000000a', 2), 'request_changes', '{}', 'أضف المعدل');
  if (select review_status from public.promotions where id = '46000000-0000-0000-0000-00000000000a') <> 'changes_requested' then raise exception 'not changes_requested'; end if;
  if (select step_id from public.review_decisions where promotion_id = '46000000-0000-0000-0000-00000000000a' order by created_at desc limit 1) is null then raise exception 'step not sealed'; end if;
  if not (public.verify_decision_chain('46000000-0000-0000-0000-00000000000a')->>'valid')::boolean then raise exception 'chain broken'; end if;
end $$;

-- Resubmit carrying step 1 forward; sequential resumes at step 2.
select pg_temp.as_user('16000000-0000-0000-0000-000000000005');
do $$ begin
  if (public.preset_preview('46000000-0000-0000-0000-00000000000a')->'carryable') <> '[1]'::jsonb then raise exception 'carryable wrong'; end if;
  perform pg_temp.expect_error($q$select public.submit_promotion_carry('46000000-0000-0000-0000-00000000000a', 'تم', false, '{1,2}')$q$, 'code:carry_all_not_allowed');
  perform public.submit_promotion_carry('46000000-0000-0000-0000-00000000000a', 'تم', false, '{1}');
  if pg_temp.step_status('46000000-0000-0000-0000-00000000000a', 1) <> 'carried_forward' or pg_temp.step_status('46000000-0000-0000-0000-00000000000a', 2) <> 'open' then
    raise exception 'carry-forward wrong';
  end if;
end $$;

-- Admin replaces the preset: the carried decision is discarded and logged.
select pg_temp.as_user('16000000-0000-0000-0000-000000000002');
do $$ begin
  perform public.replace_review_flow('46000000-0000-0000-0000-00000000000a', (select v from ids where k = 'par'));
  if (select (payload->>'discarded_decisions')::int from public.review_events where promotion_id = '46000000-0000-0000-0000-00000000000a'
      and event_type = 'flow_replaced') <> 1 then raise exception 'discard not logged'; end if;
  if pg_temp.step_status('46000000-0000-0000-0000-00000000000a', 1) <> 'open' or pg_temp.step_status('46000000-0000-0000-0000-00000000000a', 2) <> 'open' then
    raise exception 'replacement flow wrong';
  end if;
end $$;

-- Parallel on A now: one person cannot act on both steps; approved when all approve.
select pg_temp.as_user('16000000-0000-0000-0000-000000000003');
do $$ begin
  perform public.decide_promotion_step('46000000-0000-0000-0000-00000000000a', pg_temp.step('46000000-0000-0000-0000-00000000000a', 1), 'approve');
  perform pg_temp.expect_error(format('select public.decide_promotion_step(%L, %L, %L)', '46000000-0000-0000-0000-00000000000a',
    pg_temp.step('46000000-0000-0000-0000-00000000000a', 2), 'approve'), 'code:two_steps_same_person');
end $$;
select pg_temp.as_user('16000000-0000-0000-0000-000000000004');
do $$ begin
  perform public.decide_promotion_step('46000000-0000-0000-0000-00000000000a', pg_temp.step('46000000-0000-0000-0000-00000000000a', 2), 'approve');
  if (select review_status from public.promotions where id = '46000000-0000-0000-0000-00000000000a') <> 'approved' then raise exception 'parallel not approved'; end if;
end $$;

-- B: a reviewer requires a fresh review → no carry-forward on the next version.
select pg_temp.as_user('16000000-0000-0000-0000-000000000005');
select public.submit_promotion('46000000-0000-0000-0000-00000000000b');
select pg_temp.as_user('16000000-0000-0000-0000-000000000003');
do $$ begin
  perform public.decide_promotion_step('46000000-0000-0000-0000-00000000000b', pg_temp.step('46000000-0000-0000-0000-00000000000b', 1), 'approve');
end $$;
select pg_temp.as_user('16000000-0000-0000-0000-000000000002');
do $$ begin
  perform public.decide_promotion_step('46000000-0000-0000-0000-00000000000b', pg_temp.step('46000000-0000-0000-0000-00000000000b', 2), 'reject', '{}', 'مضلل', null, true);
  if (select review_status from public.promotions where id = '46000000-0000-0000-0000-00000000000b') <> 'rejected' then raise exception 'not rejected'; end if;
end $$;
select pg_temp.as_user('16000000-0000-0000-0000-000000000005');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256)
values ('36000000-0000-0000-0000-0000000000b2', '16000000-0000-0000-0000-000000000005', 'text', 'b2', 'x', 'finance', '46000000-0000-0000-0000-00000000000b', 'b2');
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.submissions set status = 'done', analyzed_at = now() where id = '36000000-0000-0000-0000-0000000000b2';
set local role authenticated;
select pg_temp.as_user('16000000-0000-0000-0000-000000000005');
do $$ begin
  if (public.preset_preview('46000000-0000-0000-0000-00000000000b')->'carryable') <> '[]'::jsonb then raise exception 'carry offered after fresh review'; end if;
  perform pg_temp.expect_error($q$select public.submit_promotion_carry('46000000-0000-0000-0000-00000000000b', null, false, '{1}')$q$, 'code:carry_not_allowed');
  perform public.submit_promotion_carry('46000000-0000-0000-0000-00000000000b', null, false, '{}');
  if pg_temp.step_status('46000000-0000-0000-0000-00000000000b', 1) <> 'open' then raise exception 'fresh flow wrong'; end if;
end $$;

-- Nobody writes steps directly.
do $$ begin
  perform pg_temp.expect_error($q$update public.promotion_review_steps set status = 'approved'$q$, 'permission denied');
end $$;
reset role;

select pass('p6 approval flows');
select * from finish();
rollback;
