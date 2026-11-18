-- Phase 3 — review state machine, separation of duties, guards, immutable hash-chained decisions,
-- privileges and media retention. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('14000000-0000-0000-0000-000000000001', 'ow@bank.test'), ('14000000-0000-0000-0000-000000000002', 'ad@bank.test'),
  ('14000000-0000-0000-0000-000000000003', 'rv@bank.test'), ('14000000-0000-0000-0000-000000000004', 'lg@bank.test'),
  ('14000000-0000-0000-0000-000000000005', 'cr@bank.test'), ('14000000-0000-0000-0000-000000000006', 'out@test.local'),
  ('14000000-0000-0000-0000-000000000007', 'solo@test.local');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '14000000-%';
insert into public.organizations (id, name, created_by) values ('24000000-0000-0000-0000-000000000001', 'Bank Review', '14000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'owner'),
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', 'admin'),
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000003', 'reviewer'),
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000004', 'legal'),
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000005', 'creator');

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

-- Creator uploads V1 of promotion P (org) through the client path.
set local role authenticated;
select pg_temp.as_user('14000000-0000-0000-0000-000000000005');
insert into public.promotions (id, owner_id, org_id, title, communication_type)
values ('44000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000005', '24000000-0000-0000-0000-000000000001', 'إعلان تمويل', 'financial_promotion');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256)
values ('34000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000005', 'text', 'x', 'x', 'finance', '44000000-0000-0000-0000-000000000001', 'ab12');
reset role;
-- The pipeline (service role) finishes the analysis with one open finding.
update public.submissions set status = 'done', analyzed_at = now() - interval '30 hours' where id = '34000000-0000-0000-0000-000000000001';
insert into public.analysis_runs (id, submission_id, status) values ('54000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', 'done');
insert into public.findings (id, run_id, submission_id, rule_code, severity, evidence_type, source, finding_type)
values ('64000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001', '34000000-0000-0000-0000-000000000001', 'SAMA-ADV-03-8', 'warning', 'caption', 'deterministic', 'missing_required');

set local role authenticated;
select pg_temp.as_user('14000000-0000-0000-0000-000000000005');
do $$ begin
  if (public.can_submit('44000000-0000-0000-0000-000000000001')->>'ok')::boolean then raise exception 'submit allowed without uploader responses'; end if;
  perform pg_temp.expect_error($q$select public.submit_promotion('44000000-0000-0000-0000-000000000001')$q$, 'code:missing_uploader_responses');
  perform pg_temp.expect_error($q$select public.respond_finding('64000000-0000-0000-0000-000000000001', 'dispute')$q$, 'code:comment_required');
  perform pg_temp.expect_error($q$select public.respond_finding('64000000-0000-0000-0000-000000000001', 'dismiss', 'x')$q$, 'code:forbidden');
  perform public.respond_finding('64000000-0000-0000-0000-000000000001', 'agree_will_action');
  if (select status from public.findings where id = '64000000-0000-0000-0000-000000000001') <> 'actioned' then raise exception 'status not synced'; end if;
  perform public.submit_promotion('44000000-0000-0000-0000-000000000001', 'جاهز');
  if (select review_status from public.promotions where id = '44000000-0000-0000-0000-000000000001') <> 'pending_review' then raise exception 'not pending'; end if;
  perform pg_temp.expect_error($q$select public.open_review('44000000-0000-0000-0000-000000000001')$q$, 'code:forbidden');
  perform pg_temp.expect_error($q$update public.promotions set review_status = 'approved' where id = '44000000-0000-0000-0000-000000000001'$q$, 'permission denied');
end $$;

-- Reviewer opens, must respond to findings, then requests changes with a reason.
select pg_temp.as_user('14000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$select public.decide_promotion('44000000-0000-0000-0000-000000000001', 'approve')$q$, 'code:invalid_status');
  perform public.open_review('44000000-0000-0000-0000-000000000001');
  if (select assigned_reviewer_id from public.promotions where id = '44000000-0000-0000-0000-000000000001') <> '14000000-0000-0000-0000-000000000003' then raise exception 'not assigned'; end if;
  perform pg_temp.expect_error($q$select public.decide_promotion('44000000-0000-0000-0000-000000000001', 'approve')$q$, 'code:missing_reviewer_responses');
  perform pg_temp.expect_error($q$select public.respond_finding('64000000-0000-0000-0000-000000000001', 'dismiss')$q$, 'code:comment_required');
  perform public.respond_finding('64000000-0000-0000-0000-000000000001', 'dismiss', 'المعدل مذكور في الصورة');
  if (select status from public.findings where id = '64000000-0000-0000-0000-000000000001') <> 'dismissed' then raise exception 'dismiss not synced'; end if;
  perform pg_temp.expect_error($q$select public.decide_promotion('44000000-0000-0000-0000-000000000001', 'request_changes')$q$, 'code:reason_required');
  perform pg_temp.expect_error($q$select public.decide_promotion('44000000-0000-0000-0000-000000000001', 'reject', array['a1000000-0000-0000-0000-000000000008']::uuid[])$q$, 'code:reason_other_required');
  perform public.decide_promotion('44000000-0000-0000-0000-000000000001', 'request_changes', array['a1000000-0000-0000-0000-000000000001']::uuid[]);
  if (select review_status from public.promotions where id = '44000000-0000-0000-0000-000000000001') <> 'changes_requested' then raise exception 'not changes_requested'; end if;
end $$;

-- Creator resubmits the same version only with a note.
select pg_temp.as_user('14000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.submit_promotion('44000000-0000-0000-0000-000000000001')$q$, 'code:note_required_same_version');
  perform public.submit_promotion('44000000-0000-0000-0000-000000000001', 'التوضيح في الصورة الثانية');
end $$;

-- Reviewer opens and escalates; only the chosen legal member answers.
select pg_temp.as_user('14000000-0000-0000-0000-000000000003');
do $$ begin
  perform public.open_review('44000000-0000-0000-0000-000000000001');
  perform pg_temp.expect_error($q$select public.escalate_promotion('44000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', 'سؤال')$q$, 'code:not_legal_member');
  perform pg_temp.expect_error($q$select public.escalate_promotion('44000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000004', '')$q$, 'code:question_required');
  perform public.escalate_promotion('44000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000004', 'هل تكفي عبارة الإشراف؟');
  perform pg_temp.expect_error($q$select public.respond_escalation('44000000-0000-0000-0000-000000000001', 'x')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('14000000-0000-0000-0000-000000000004');
do $$ begin
  if not exists (select 1 from public.promotions where id = '44000000-0000-0000-0000-000000000001') then raise exception 'legal cannot read'; end if;
  perform public.respond_escalation('44000000-0000-0000-0000-000000000001', 'تكفي بالصياغة المعتمدة');
  if (select review_status from public.promotions where id = '44000000-0000-0000-0000-000000000001') <> 'in_review' then raise exception 'not back in review'; end if;
end $$;

-- Reviewer approves (condition required for conditional approval).
select pg_temp.as_user('14000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$select public.decide_promotion('44000000-0000-0000-0000-000000000001', 'conditional_approve')$q$, 'code:condition_required');
  perform public.decide_promotion('44000000-0000-0000-0000-000000000001', 'approve', '{}', null, null, 'معتمد');
  if (select review_status from public.promotions where id = '44000000-0000-0000-0000-000000000001') <> 'approved' then raise exception 'not approved'; end if;
  if (select approved_version_id from public.promotions where id = '44000000-0000-0000-0000-000000000001') <> '34000000-0000-0000-0000-000000000001' then raise exception 'approved version'; end if;
  if (select count(*) from public.review_decisions where promotion_id = '44000000-0000-0000-0000-000000000001') <> 4 then raise exception 'decision count'; end if;
  if not (public.verify_decision_chain('44000000-0000-0000-0000-000000000001')->>'valid')::boolean then raise exception 'chain invalid'; end if;
  perform pg_temp.expect_error($q$update public.review_decisions set comment = 'x'$q$, 'permission denied');
end $$;
select pg_temp.as_user('14000000-0000-0000-0000-000000000005');
do $$ begin
  perform pg_temp.expect_error($q$select public.submit_promotion('44000000-0000-0000-0000-000000000001', 'x')$q$, 'code:invalid_status');
  if not exists (select 1 from public.notifications where kind = 'review_decided') then raise exception 'uploader not notified'; end if;
end $$;
-- Outsider sees nothing.
select pg_temp.as_user('14000000-0000-0000-0000-000000000006');
do $$ begin
  if exists (select 1 from public.review_decisions) or exists (select 1 from public.review_events where promotion_id = '44000000-0000-0000-0000-000000000001') then
    raise exception 'outsider reads review data'; end if;
  perform pg_temp.expect_error($q$select public.open_review('44000000-0000-0000-0000-000000000001')$q$, 'code:');
end $$;

-- Separation of duties: the owner uploads and submits; the owner cannot open or decide it.
select pg_temp.as_user('14000000-0000-0000-0000-000000000001');
insert into public.promotions (id, owner_id, org_id, title) values ('44000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', 'SoD');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id)
values ('34000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', 'text', 'x', 'x', 'finance', '44000000-0000-0000-0000-000000000002');
reset role;
update public.submissions set status = 'done', analyzed_at = now() - interval '30 hours' where id = '34000000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.as_user('14000000-0000-0000-0000-000000000001');
do $$ begin
  perform public.submit_promotion('44000000-0000-0000-0000-000000000002');
  perform pg_temp.expect_error($q$select public.open_review('44000000-0000-0000-0000-000000000002')$q$, 'code:separation_of_duties');
  perform pg_temp.expect_error($q$select public.assign_reviewer('44000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001')$q$, 'code:separation_of_duties');
end $$;
reset role;

-- Immutability and tamper detection (superuser bypasses the trigger to simulate tampering).
do $$ begin
  perform pg_temp.expect_error($q$delete from public.review_decisions$q$, 'code:immutable_record');
  perform pg_temp.expect_error($q$update public.review_events set event_type = 'x'$q$, 'code:immutable_record');
end $$;
alter table public.review_decisions disable trigger review_decisions_immutable;
update public.review_decisions set comment = 'tampered' where decision = 'request_changes';
alter table public.review_decisions enable trigger review_decisions_immutable;
set local role authenticated;
select pg_temp.as_user('14000000-0000-0000-0000-000000000003');
do $$ begin
  if (public.verify_decision_chain('44000000-0000-0000-0000-000000000001')->>'valid')::boolean then raise exception 'tamper not detected'; end if;
end $$;
reset role;

-- Retention: personal 24 h → deleted; org unsubmitted → deleted; org submitted / approved → kept.
-- Clear the JWT claims so the insert trigger treats these rows as service-role fixtures.
select set_config('request.jwt.claim.role', '', true), set_config('request.jwt.claim.sub', '', true);
insert into public.submissions (id, user_id, kind, caption, platform, product_category, status, analyzed_at, created_at)
values ('34000000-0000-0000-0000-000000000003', '14000000-0000-0000-0000-000000000007', 'text', 'x', 'x', 'other', 'done', now() - interval '25 hours', now() - interval '25 hours'),
       ('34000000-0000-0000-0000-000000000004', '14000000-0000-0000-0000-000000000005', 'text', 'x', 'x', 'other', 'done', now() - interval '25 hours', now() - interval '25 hours');
update public.submissions set org_id = '24000000-0000-0000-0000-000000000001' where id = '34000000-0000-0000-0000-000000000004';
update public.promotions set org_id = '24000000-0000-0000-0000-000000000001'
where id = (select promotion_id from public.submissions where id = '34000000-0000-0000-0000-000000000004');
do $$
declare _ids uuid[] := array(select id from public.media_retention_candidates(500));
begin
  if not ('34000000-0000-0000-0000-000000000003' = any(_ids)) then raise exception 'personal media not due'; end if;
  if not ('34000000-0000-0000-0000-000000000004' = any(_ids)) then raise exception 'unsubmitted org media not due'; end if;
  if '34000000-0000-0000-0000-000000000001' = any(_ids) then raise exception 'approved version media would be deleted'; end if;
  if '34000000-0000-0000-0000-000000000002' = any(_ids) then raise exception 'submitted version media would be deleted'; end if;
end $$;

select pass('review workflow');
select * from finish();
rollback;
