-- Phase 7.1 — self-approval: flag, matching rule, AI requirement (no findings / all answered), high-risk pack,
-- re-check at click time, sealed «اعتماد ذاتي» decision. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values ('1d000000-0000-0000-0000-000000000001', 'ow@self.test'), ('1d000000-0000-0000-0000-000000000005', 'cr@self.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '1d000000-%';
insert into public.organizations (id, name, created_by) values ('2d000000-0000-0000-0000-000000000001', 'Self Bank', '1d000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('2d000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000001', 'owner'),
  ('2d000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000005', 'creator');
insert into public.org_settings (org_id, features) values ('2d000000-0000-0000-0000-000000000001', '{"self_approval": true}')
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
select pg_temp.as_user('1d000000-0000-0000-0000-000000000005');
insert into public.promotions (id, owner_id, org_id, title, communication_type, channels) values
  ('4d000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000005', '2d000000-0000-0000-0000-000000000001', 'S', 'general_commercial', '{instagram}');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256) values
  ('3d000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000005', 'text', 's', 'x', 'finance', '4d000000-0000-0000-0000-000000000001', 's1');
do $$ begin
  perform pg_temp.expect_error($q$select public.save_self_approval_rule('2d000000-0000-0000-0000-000000000001', null, 'x', '{}', '{}', '{}', '{creator}', '{}', 'no_findings', true)$q$, 'code:forbidden');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.submissions set status = 'done', analyzed_at = now() where id = '3d000000-0000-0000-0000-000000000001';
insert into public.analysis_runs (id, submission_id, status) values ('5d000000-0000-0000-0000-000000000001', '3d000000-0000-0000-0000-000000000001', 'done');
insert into public.findings (id, run_id, submission_id, rule_code, severity, evidence_type, source, finding_type)
values ('6d000000-0000-0000-0000-000000000001', '5d000000-0000-0000-0000-000000000001', '3d000000-0000-0000-0000-000000000001', 'MAW-01', 'warning', 'caption', 'deterministic', 'missing_required');

set local role authenticated;
select pg_temp.as_user('1d000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.expect_error($q$select public.save_self_approval_rule('2d000000-0000-0000-0000-000000000001', null, 'x', '{}', '{}', '{}', '{creator}', '{}', 'nothing', true)$q$, 'code:invalid_ai_requirement');
  perform public.save_self_approval_rule('2d000000-0000-0000-0000-000000000001', null, 'إنستغرام', '{instagram}', '{}', '{SA}', '{creator}', '{}', 'no_findings', true);
end $$;
select pg_temp.as_user('1d000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.self_approve('4d000000-0000-0000-0000-000000000001')$q$, 'code:invalid_status');
  perform public.respond_finding('6d000000-0000-0000-0000-000000000001', 'agree_will_action');
  perform public.submit_promotion('4d000000-0000-0000-0000-000000000001');
  perform pg_temp.expect_error($q$select public.self_approve('4d000000-0000-0000-0000-000000000001')$q$, 'code:has_findings');
end $$;
-- The owner relaxes the rule to "all AI findings answered": now eligible (re-checked at click time).
select pg_temp.as_user('1d000000-0000-0000-0000-000000000001');
do $x$ begin
  perform pg_temp.expect_error($q$update public.self_approval_rules set ai_requirement = 'all_answered'$q$, 'permission denied');
end $x$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.self_approval_rules set ai_requirement = 'all_answered';
set local role authenticated;
select pg_temp.as_user('1d000000-0000-0000-0000-000000000005');
do $$ begin
  perform public.self_approve('4d000000-0000-0000-0000-000000000001', 'جاهز');
  if (select review_status from public.promotions where id = '4d000000-0000-0000-0000-000000000001') <> 'approved' then raise exception 'not approved'; end if;
  if (select actor_role from public.review_decisions where promotion_id = '4d000000-0000-0000-0000-000000000001' order by created_at desc limit 1) <> 'self_approval' then raise exception 'not marked'; end if;
  if (select comment from public.review_decisions where promotion_id = '4d000000-0000-0000-0000-000000000001' order by created_at desc limit 1) not like 'اعتماد ذاتي%' then raise exception 'no qualifier'; end if;
  if not (public.verify_decision_chain('4d000000-0000-0000-0000-000000000001')->>'valid')::boolean then raise exception 'chain'; end if;
end $$;
reset role;

select pass('p7 self approval');
select * from finish();
rollback;
