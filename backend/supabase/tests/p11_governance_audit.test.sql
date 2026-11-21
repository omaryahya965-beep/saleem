-- D186–D187 governance audit: self-approval cannot bypass open violations, evidence requests, financial promotions,
-- high-risk packs, partial coverage or multi-stage presets; risk acceptance keeps findings and is not an approval;
-- conditional approval does not allow recording publication.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('1b000000-0000-0000-0000-000000000001', 'ow@audit.test'), ('1b000000-0000-0000-0000-000000000002', 'mk@audit.test'),
  ('1b000000-0000-0000-0000-000000000003', 'rv@audit.test'), ('1b000000-0000-0000-0000-000000000004', 'ra@audit.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '1b000000-%';
insert into public.organizations (id, name, created_by) values ('2b000000-0000-0000-0000-000000000001', 'Audit Org', '1b000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role, can_accept_risk) values
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'owner', false),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002', 'creator', false),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000003', 'reviewer', false),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000004', 'compliance_lead', true);
insert into public.org_settings (org_id, features) values ('2b000000-0000-0000-0000-000000000001', '{"self_approval": true, "risk_acceptance": true, "lifecycle": true}')
on conflict (org_id) do update set features = excluded.features;
insert into public.self_approval_rules (org_id, name, roles, ai_requirement, active)
values ('2b000000-0000-0000-0000-000000000001', 'all answered', '{creator}', 'all_answered', true);

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
-- One advertisement per scenario: (id suffix, communication type, finding severity, finding type).
create or replace function pg_temp.ad(_n int, _comm text, _sev text, _type text) returns void language plpgsql as $$
declare pid uuid := ('4b000000-0000-0000-0000-00000000000' || _n)::uuid; sid uuid := ('3b000000-0000-0000-0000-00000000000' || _n)::uuid;
  rid uuid := ('5b000000-0000-0000-0000-00000000000' || _n)::uuid; fid uuid := ('6b000000-0000-0000-0000-00000000000' || _n)::uuid;
begin
  insert into public.promotions (id, owner_id, org_id, title, communication_type, channels)
  values (pid, '1b000000-0000-0000-0000-000000000002', '2b000000-0000-0000-0000-000000000001', 'ad ' || _n, _comm::public.communication_type, '{instagram}');
  insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256)
  values (sid, '1b000000-0000-0000-0000-000000000002', 'text', 'x', 'x', 'beauty', pid, 'a' || _n);
  update public.submissions set status = 'done', analyzed_at = now() where id = sid;
  insert into public.analysis_runs (id, submission_id, status) values (rid, sid, 'done');
  if _sev is not null then
    insert into public.findings (id, run_id, submission_id, rule_code, severity, evidence_type, source, finding_type)
    values (fid, rid, sid, 'COM-01', _sev::public.severity, 'caption', 'deterministic', _type);
  end if;
end $$;

-- Scenarios are created by the service role (pipeline), then answered and submitted by the marketer.
select pg_temp.ad(1, 'general_commercial', 'violation', 'potential_risk');   -- open violation
select pg_temp.ad(2, 'general_commercial', 'warning', 'needs_evidence');     -- evidence request
select pg_temp.ad(3, 'financial_promotion', null, null);                    -- financial promotion, clean
select pg_temp.ad(4, 'general_commercial', 'warning', 'potential_risk');    -- eligible control
select pg_temp.ad(5, 'general_commercial', null, null);                     -- partial coverage
update public.analysis_runs set coverage = '{"status": "partial"}' where id = '5b000000-0000-0000-0000-000000000005';

set local role authenticated;
select pg_temp.as_user('1b000000-0000-0000-0000-000000000002');
do $$
declare i int;
begin
  for i in 1..5 loop
    if exists (select 1 from public.findings where id = ('6b000000-0000-0000-0000-00000000000' || i)::uuid) then
      perform public.respond_finding(('6b000000-0000-0000-0000-00000000000' || i)::uuid,
        case when i = 2 then 'provide_evidence' else 'agree_will_action' end, case when i = 2 then 'المستند لاحقاً' else null end);
    end if;
    perform public.submit_promotion(('4b000000-0000-0000-0000-00000000000' || i)::uuid, 'x');
  end loop;
  -- Answering a violation is not enough (was a bypass before D186).
  perform pg_temp.expect_error($q$select public.self_approve('4b000000-0000-0000-0000-000000000001')$q$, 'code:open_violations');
  perform pg_temp.expect_error($q$select public.self_approve('4b000000-0000-0000-0000-000000000002')$q$, 'code:evidence_required');
  perform pg_temp.expect_error($q$select public.self_approve('4b000000-0000-0000-0000-000000000003')$q$, 'code:financial_promotion');
  perform pg_temp.expect_error($q$select public.self_approve('4b000000-0000-0000-0000-000000000005')$q$, 'code:coverage_partial');
  -- The control case stays eligible (no weakening of the feature itself).
  perform public.self_approve('4b000000-0000-0000-0000-000000000004', 'ok');
  if (select review_status from public.promotions where id = '4b000000-0000-0000-0000-000000000004') <> 'approved' then raise exception 'control not approved'; end if;
end $$;

-- A reviewer can never self-approve someone else's ad.
select pg_temp.as_user('1b000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$select public.self_approve('4b000000-0000-0000-0000-000000000005')$q$, 'code:not_uploader');
end $$;

-- Risk acceptance on ad 1 after changes were requested: findings untouched, not an approval, version-bound.
select pg_temp.as_user('1b000000-0000-0000-0000-000000000001');
select public.assign_reviewer('4b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000003');
select pg_temp.as_user('1b000000-0000-0000-0000-000000000003');
select public.open_review('4b000000-0000-0000-0000-000000000001');
select public.decide_promotion('4b000000-0000-0000-0000-000000000001', 'request_changes', array['a1000000-0000-0000-0000-000000000002']::uuid[]);
select pg_temp.as_user('1b000000-0000-0000-0000-000000000002');
do $$ begin
  perform pg_temp.expect_error($q$select public.request_risk_acceptance('4b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000004', '')$q$, 'code:reason_required');
  perform pg_temp.expect_error($q$select public.request_risk_acceptance('4b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000003', 'x')$q$, 'code:not_risk_acceptor');
  perform public.request_risk_acceptance('4b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000004', 'حملة قصيرة بموافقة الإدارة');
  perform pg_temp.expect_error($q$select public.decide_risk('4b000000-0000-0000-0000-000000000001', true, 'x')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('1b000000-0000-0000-0000-000000000004');
do $$
declare _d uuid;
begin
  perform pg_temp.expect_error($q$select public.decide_risk('4b000000-0000-0000-0000-000000000001', true, '')$q$, 'code:reason_required');
  _d := public.decide_risk('4b000000-0000-0000-0000-000000000001', true, 'مقبول لمدة الحملة فقط');
  if (select review_status from public.promotions where id = '4b000000-0000-0000-0000-000000000001') <> 'risk_accepted' then raise exception 'not risk_accepted'; end if;
  if (select approved_version_id from public.promotions where id = '4b000000-0000-0000-0000-000000000001') is not null then raise exception 'counted as approval'; end if;
  if (select status from public.findings where id = '6b000000-0000-0000-0000-000000000001') in ('resolved', 'dismissed', 'not_required') then raise exception 'findings removed'; end if;
  if (select submission_id from public.review_decisions where id = _d) <> '3b000000-0000-0000-0000-000000000001' then raise exception 'not version-bound'; end if;
  if (select decision from public.review_decisions where id = _d) <> 'risk_accept' then raise exception 'decision kind'; end if;
  perform pg_temp.expect_error(format('update public.review_decisions set comment = %L where id = %L', 'x', _d), 'permission denied');
end $$;
reset role;

-- Conditional approval does not allow recording publication.
select set_config('request.jwt.claim.sub', '', true);
update public.promotions set review_status = 'conditionally_approved' where id = '4b000000-0000-0000-0000-000000000005';
set local role authenticated;
select pg_temp.as_user('1b000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.expect_error($q$select public.record_lifecycle('4b000000-0000-0000-0000-000000000005', 'published', now())$q$, 'code:not_approved');
  perform public.record_lifecycle('4b000000-0000-0000-0000-000000000001', 'published', now());
  if not (select (payload->>'under_risk_acceptance')::boolean from public.review_events
          where promotion_id = '4b000000-0000-0000-0000-000000000001' and event_type = 'lifecycle_published') then raise exception 'risk label missing'; end if;
end $$;
reset role;

-- Demo cap helpers are not callable by end users.
set local role authenticated;
select pg_temp.as_user('1b000000-0000-0000-0000-000000000002');
do $$ begin
  perform pg_temp.expect_error($q$select public.demo_ai_runs_today()$q$, 'permission denied');
end $$;
reset role;

select pass('p11 governance audit');
select * from finish();
rollback;
