-- Personal workspaces (D211): own-only scope, no organisation membership or role from a personal account, no
-- enterprise review/approval path for personal promotions, authority selection only on personal promotions,
-- personal AI allowances, demo confinement, recommendation and verified coverage.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('1e000000-0000-0000-0000-000000000001', 'p1@personal.test'), ('1e000000-0000-0000-0000-000000000002', 'p2@personal.test'),
  ('1e000000-0000-0000-0000-000000000003', 'owner@personal.test'), ('1e000000-0000-0000-0000-000000000004', 'rev@personal.test'),
  ('1e000000-0000-0000-0000-000000000005', 'demo-ent@personal.test'), ('1e000000-0000-0000-0000-000000000006', 'demo-ind@personal.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '1e000000-%';
insert into public.organizations (id, name, created_by) values
  ('2e000000-0000-0000-0000-000000000001', 'Personal Test Org', '1e000000-0000-0000-0000-000000000003'),
  ('2e000000-0000-0000-0000-000000000002', 'Demo Sandbox', '1e000000-0000-0000-0000-000000000005');
insert into public.org_members (org_id, user_id, role) values
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000003', 'owner'),
  ('2e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000004', 'reviewer'),
  ('2e000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-000000000005', 'creator');
insert into public.demo_sandbox_orgs (org_id) values ('2e000000-0000-0000-0000-000000000002');
insert into public.personal_workspaces (user_id, is_demo) values ('1e000000-0000-0000-0000-000000000006', true);

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
-- Runs a statement and ignores whether it raised: the assertion is on the resulting state.
create or replace function pg_temp.try(_sql text) returns void language plpgsql as $$
begin execute _sql; exception when others then null; end $$;

-- Demo flags are service-side.
do $$ begin
  if not public.is_demo_sandbox_user('1e000000-0000-0000-0000-000000000006') then raise exception 'individual demo must share the demo cap'; end if;
  if not public.is_demo_sandbox_user('1e000000-0000-0000-0000-000000000005') then raise exception 'enterprise sandbox unchanged'; end if;
  if public.is_demo_sandbox_user('1e000000-0000-0000-0000-000000000001') then raise exception 'real user is not a demo'; end if;
  -- Recommendation and coverage.
  if public.recommend_authorities('cosmetics', 'beauty', 'creator_sponsored', array['snapchat'], true, true) <> array['GMEDIA', 'MC', 'SDAIA', 'SFDA'] then
    raise exception 'recommendation: %', public.recommend_authorities('cosmetics', 'beauty', 'creator_sponsored', array['snapchat'], true, true); end if;
  if not ('SAMA' = any (public.recommend_authorities('banking', 'finance', 'financial_promotion', '{}', false, false))) then raise exception 'SAMA for banking'; end if;
  if (select active_rules from public.authority_coverage() where authority = 'GMEDIA') < 1 then raise exception 'GMEDIA has verified rules'; end if;
  if (select active_rules from public.authority_coverage() where authority = 'SFDA') <> 0 then raise exception 'SFDA rules are drafts: none active'; end if;
end $$;

set local role authenticated;

-- A real user chooses personal use: own workspace only, never a membership or a role.
select pg_temp.as_user('1e000000-0000-0000-0000-000000000001');
select public.ensure_personal_workspace('صانع محتوى');
select public.ensure_personal_workspace('again'); -- idempotent
do $$ begin
  if (select count(*) from public.personal_workspaces) <> 1 then raise exception 'sees only own workspace'; end if;
  if exists (select 1 from public.org_members where user_id = '1e000000-0000-0000-0000-000000000001') then raise exception 'personal use granted a membership'; end if;
  perform pg_temp.expect_error($q$update public.personal_workspaces set is_demo = true$q$, 'permission denied');
  perform pg_temp.expect_error($q$insert into public.personal_workspaces (user_id) values ('1e000000-0000-0000-0000-000000000002')$q$, 'permission denied');
  perform pg_temp.expect_error($q$select public.save_personal_preferences('x', array['FAKE'])$q$, 'code:invalid_authorities');
  perform public.save_personal_preferences('صانع', array['GMEDIA', 'SFDA']);
  -- Personal allowances: separate, modest; generated media has no provider.
  if (public.ai_allowance(null, 'analysis')->>'limit')::int <> 30 then raise exception 'personal analysis limit'; end if;
  if (public.ai_allowance(null, 'ask')->>'limit')::int <> 60 then raise exception 'personal ask limit'; end if;
  if (public.ai_allowance(null, 'video')->>'ok')::boolean then raise exception 'no generated video'; end if;
  if public.personal_ai_allowances()->'script'->>'limit' <> '20' then raise exception 'allowance summary'; end if;
  perform pg_temp.expect_error($q$insert into public.ai_usage (capability, provider) values ('ask', 'gemini')$q$, 'permission denied');
end $$;

-- A personal promotion: its sector, never its authorities (D213: every authority is considered automatically).
insert into public.promotions (id, owner_id, org_id, title, communication_type, sector)
values ('3e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000001', null, 'Personal ad', 'creator_sponsored', 'real_estate');
do $$ begin
  -- No client can select or exclude authorities, by insert or update.
  perform pg_temp.expect_error($q$insert into public.promotions (owner_id, title, selected_authorities) values ('1e000000-0000-0000-0000-000000000001', 'x', array['MC'])$q$, 'permission denied');
  perform pg_temp.expect_error($q$update public.promotions set selected_authorities = array['MC'] where id = '3e000000-0000-0000-0000-000000000001'$q$, 'permission denied');
  -- No enterprise state can be written directly.
  perform pg_temp.expect_error($q$update public.promotions set review_status = 'approved' where id = '3e000000-0000-0000-0000-000000000001'$q$, 'permission denied');
end $$;
insert into public.submissions (id, user_id, kind, title, caption, text_content, platform, product_category, is_paid_ad, has_written_contract, ai_used, promotion_id, sha256)
values ('4e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000001', 'text', 'Personal ad', '', 'نص', 'snapchat', 'beauty', true, true, false,
        '3e000000-0000-0000-0000-000000000001', 'p16');
reset role;
update public.submissions set status = 'done' where id = '4e000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-000000000001');

-- Every enterprise review/approval RPC leaves a personal promotion outside the enterprise workflow.
select pg_temp.try($q$select public.submit_promotion('3e000000-0000-0000-0000-000000000001', 'x', true)$q$);
select pg_temp.try($q$select public.assign_reviewer('3e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000004')$q$);
select pg_temp.try($q$select public.decide_promotion('3e000000-0000-0000-0000-000000000001', 'approve', '{}', null, null, 'ok', null)$q$);
select pg_temp.try($q$select public.self_approve('3e000000-0000-0000-0000-000000000001', 'ok')$q$);
select pg_temp.try($q$select public.request_risk_acceptance('3e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000004', 'x')$q$);
select pg_temp.try($q$select public.escalate_promotion('3e000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000004', 'x')$q$);
select pg_temp.try($q$select public.finalize_conditional_approval('3e000000-0000-0000-0000-000000000001', 'x')$q$);
select pg_temp.try($q$select public.record_lifecycle('3e000000-0000-0000-0000-000000000001', 'published', now())$q$);
do $$ begin
  if (select review_status from public.promotions where id = '3e000000-0000-0000-0000-000000000001') <> 'draft' then
    raise exception 'personal promotion entered the enterprise workflow: %', (select review_status from public.promotions where id = '3e000000-0000-0000-0000-000000000001'); end if;
  if (select assigned_reviewer_id from public.promotions where id = '3e000000-0000-0000-0000-000000000001') is not null then raise exception 'reviewer assigned'; end if;
  if ((public.can_submit('3e000000-0000-0000-0000-000000000001', null, true))->>'ok')::boolean then raise exception 'can_submit must refuse'; end if;
end $$;

-- Another personal user sees nothing of it.
select pg_temp.as_user('1e000000-0000-0000-0000-000000000002');
do $$ begin
  if exists (select 1 from public.promotions where id = '3e000000-0000-0000-0000-000000000001') then raise exception 'personal promotion leaked'; end if;
  if exists (select 1 from public.submissions where id = '4e000000-0000-0000-0000-000000000001') then raise exception 'personal submission leaked'; end if;
  if exists (select 1 from public.personal_workspaces) then raise exception 'workspace leaked'; end if;
end $$;
do $$ begin
  update public.promotions set title = 'hijack' where id = '3e000000-0000-0000-0000-000000000001';
end $$;
-- An organisation reviewer cannot read it either.
select pg_temp.as_user('1e000000-0000-0000-0000-000000000004');
do $$ begin
  if exists (select 1 from public.promotions where id = '3e000000-0000-0000-0000-000000000001') then raise exception 'org member reads personal ad'; end if;
end $$;

-- Organisations cannot set it either (they keep their rule-pack settings).
select pg_temp.as_user('1e000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$insert into public.promotions (owner_id, org_id, title, selected_authorities) values ('1e000000-0000-0000-0000-000000000003', '2e000000-0000-0000-0000-000000000001', 'org ad', array['MC'])$q$, 'permission denied');
end $$;
-- An enterprise sandbox demo persona cannot open a personal workspace (demo confinement).
select pg_temp.as_user('1e000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.ensure_personal_workspace(null)$q$, 'code:demo_forbidden');
end $$;

reset role;
do $$ begin
  if (select title from public.promotions where id = '3e000000-0000-0000-0000-000000000001') <> 'Personal ad' then raise exception 'another user changed the ad'; end if;
end $$;
select pass('personal workspaces: own scope, no enterprise workflow, authority selection, allowances, demo confinement');
select * from finish();
rollback;
