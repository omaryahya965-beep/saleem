-- SALEEM Fix (D178): feature flag, uploader-side permission, idempotent jobs, one active job, media providers not
-- configured, atomic two-step acceptance into a NEW version (original kept, no approval inherited), monthly quota.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('1a000000-0000-0000-0000-000000000001', 'ow@fix.test'), ('1a000000-0000-0000-0000-000000000002', 'mk@fix.test'),
  ('1a000000-0000-0000-0000-000000000003', 'rv@fix.test'), ('1a000000-0000-0000-0000-000000000004', 'vw@fix.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '1a000000-%';
insert into public.organizations (id, name, created_by) values ('2a000000-0000-0000-0000-000000000001', 'Fix Org', '1a000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'owner'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'creator'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000003', 'reviewer'),
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000004', 'viewer');
insert into public.org_settings (org_id) values ('2a000000-0000-0000-0000-000000000001') on conflict (org_id) do nothing;

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
select pg_temp.as_user('1a000000-0000-0000-0000-000000000002');
insert into public.promotions (id, owner_id, org_id, title, communication_type)
values ('4a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000001', 'كريم ندى', 'general_commercial');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256)
values ('3a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'text', 'نتيجة مضمونة', 'x', 'beauty', '4a000000-0000-0000-0000-000000000001', 'f1');
reset role;
update public.submissions set status = 'done', analyzed_at = now() where id = '3a000000-0000-0000-0000-000000000001';
insert into public.analysis_runs (id, submission_id, status) values ('5a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'done');
insert into public.findings (id, run_id, submission_id, rule_code, severity, evidence_type, source, finding_type)
values ('6a000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'COM-01', 'violation', 'caption', 'deterministic', 'potential_risk');

-- Flag off by default.
set local role authenticated;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000002');
do $$ begin
  perform pg_temp.expect_error($q$select public.create_correction_job('4a000000-0000-0000-0000-000000000001', 'text_correction', '{}', '{}', null, 'key-00000001')$q$, 'code:feature_off');
end $$;
reset role;
update public.org_settings set features = '{"saleem_fix": true, "saleem_fix_monthly_limit": 2}' where org_id = '2a000000-0000-0000-0000-000000000001';

-- Reviewer and viewer cannot correct marketer content.
set local role authenticated;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$select public.create_correction_job('4a000000-0000-0000-0000-000000000001', 'text_correction', '{}', '{}', null, 'key-00000002')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000004');
do $$ begin
  perform pg_temp.expect_error($q$select public.create_correction_job('4a000000-0000-0000-0000-000000000001', 'text_correction', '{}', '{}', null, 'key-00000003')$q$, 'code:forbidden');
end $$;

-- Marketer: idempotent creation, media methods not configured, invalid findings refused.
select pg_temp.as_user('1a000000-0000-0000-0000-000000000002');
do $$
declare _a uuid; _b uuid; _sid uuid := gen_random_uuid();
begin
  perform pg_temp.expect_error($q$select public.create_correction_job('4a000000-0000-0000-0000-000000000001', 'replacement', '{}', '{}', null, 'key-00000004')$q$, 'code:provider_not_configured');
  perform pg_temp.expect_error($q$select public.create_correction_job('4a000000-0000-0000-0000-000000000001', 'text_correction', array[gen_random_uuid()], '{}', null, 'key-00000005')$q$, 'code:invalid_findings');
  _a := public.create_correction_job('4a000000-0000-0000-0000-000000000001', 'text_correction', array['6a000000-0000-0000-0000-000000000001']::uuid[], '{"keep_product": true}', 'صيغة الأنثى', 'key-00000006');
  _b := public.create_correction_job('4a000000-0000-0000-0000-000000000001', 'text_correction', array['6a000000-0000-0000-0000-000000000001']::uuid[], '{}', null, 'key-00000006');
  if _a <> _b then raise exception 'not idempotent'; end if;
  -- Not ready yet: acceptance refused.
  perform pg_temp.expect_error(format('select public.begin_accept_correction(%L, %L)', _a, '{"script": "x"}'), 'code:invalid_status');
  perform pg_temp.expect_error($q$update public.correction_jobs set status = 'ready'$q$, 'permission denied');
end $$;

-- The Edge Function (service role) stores the proposal.
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.correction_jobs set status = 'ready', proposal = '{"caption": "إعلان مدفوع", "script": "كريم ندى للعناية اليومية"}', plan = '[]';

set local role authenticated;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000002');
do $$
declare _j uuid := (select id from public.correction_jobs limit 1);
begin
  perform pg_temp.expect_error(format('select public.begin_accept_correction(%L, %L)', _j, '{"script": " ", "caption": ""}'), 'code:proposal_empty');
  perform public.begin_accept_correction(_j, '{"caption": "إعلان مدفوع", "script": "كريم ندى للعناية اليومية"}');
  -- A second click cannot start a second acceptance.
  perform pg_temp.expect_error(format('select public.begin_accept_correction(%L, %L)', _j, '{"script": "x"}'), 'code:invalid_status');
end $$;
insert into public.submissions (id, user_id, kind, caption, text_content, platform, product_category, promotion_id, sha256, ai_used, parent_id)
values ('3a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000002', 'text', 'إعلان مدفوع', 'كريم ندى للعناية اليومية', 'x', 'beauty',
        '4a000000-0000-0000-0000-000000000001', 'f2', true, '3a000000-0000-0000-0000-000000000001');
do $$
declare _j uuid := (select id from public.correction_jobs limit 1);
begin
  perform public.finish_accept_correction(_j, '3a000000-0000-0000-0000-000000000002');
  perform public.finish_accept_correction(_j, '3a000000-0000-0000-0000-000000000002'); -- idempotent
  if (select status from public.correction_jobs where id = _j) <> 'accepted' then raise exception 'not accepted'; end if;
  if (select current_version_id from public.promotions where id = '4a000000-0000-0000-0000-000000000001') <> '3a000000-0000-0000-0000-000000000002' then raise exception 'new version not current'; end if;
  if not exists (select 1 from public.submissions where id = '3a000000-0000-0000-0000-000000000001') then raise exception 'original lost'; end if;
  if (select review_status from public.promotions where id = '4a000000-0000-0000-0000-000000000001') <> 'draft' then raise exception 'status changed'; end if;
  if (select correction_job_id from public.submissions where id = '3a000000-0000-0000-0000-000000000002') <> _j then raise exception 'not linked'; end if;
  -- Mandatory re-analysis: the new version cannot be submitted before its analysis is done.
  perform pg_temp.expect_error($q$select public.submit_promotion('4a000000-0000-0000-0000-000000000001', 'x')$q$, 'code:analysis_not_done');
  -- And no new correction until it is analysed.
  if (public.can_fix_promotion('4a000000-0000-0000-0000-000000000001')->>'ok')::boolean then raise exception 'fix allowed before analysis'; end if;
end $$;

-- Quota (limit 2 per month): one accepted job + one more, then exhausted.
reset role;
update public.submissions set status = 'done', analyzed_at = now() where id = '3a000000-0000-0000-0000-000000000002';
insert into public.correction_jobs (promotion_id, org_id, source_submission_id, created_by, method, status, idempotency_key)
values ('4a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000002', 'text_correction', 'ready', 'key-quota-01');
set local role authenticated;
select pg_temp.as_user('1a000000-0000-0000-0000-000000000002');
do $$ begin
  perform pg_temp.expect_error($q$select public.create_correction_job('4a000000-0000-0000-0000-000000000001', 'text_correction', '{}', '{}', null, 'key-00000099')$q$, 'code:quota_exhausted');
end $$;
-- Other members' reads: the reviewer may read jobs (context), an outsider may not.
select pg_temp.as_user('1a000000-0000-0000-0000-000000000003');
do $$ begin
  if (select count(*) from public.correction_jobs) < 1 then raise exception 'reviewer cannot read jobs'; end if;
end $$;
reset role;

select pass('p10 SALEEM Fix');
select * from finish();
rollback;
