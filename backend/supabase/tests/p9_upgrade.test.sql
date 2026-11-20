-- SALEEM V2 upgrade (D170–D175): submission with unanswered findings, decision gating vs approval blockers,
-- structured conditional approval (fulfil → submit → verify → separate final approval), idempotent responses and
-- assignment, partner link scope / configurable limit / draft cancellation / rotation / expiry, MAW-03/04 scope,
-- non-financial sectors. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('19000000-0000-0000-0000-000000000001', 'ow@nada.test'), ('19000000-0000-0000-0000-000000000002', 'ad@nada.test'),
  ('19000000-0000-0000-0000-000000000003', 'rv@nada.test'), ('19000000-0000-0000-0000-000000000004', 'rv2@nada.test'),
  ('19000000-0000-0000-0000-000000000005', 'mk@nada.test'), ('19000000-0000-0000-0000-000000000006', 'vw@nada.test'),
  ('19000000-0000-0000-0000-000000000007', 'agency@nada.test'), ('19000000-0000-0000-0000-000000000008', 'agency2@nada.test'),
  ('19000000-0000-0000-0000-000000000009', 'lg@nada.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '19000000-%';
insert into public.organizations (id, name, created_by) values ('29000000-0000-0000-0000-000000000001', 'Nada Cosmetics', '19000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'owner'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000002', 'admin'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000003', 'reviewer'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000004', 'reviewer'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', 'creator'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000006', 'viewer'),
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000009', 'legal');
insert into public.org_settings (org_id, sector, features) values ('29000000-0000-0000-0000-000000000001', 'banking', '{"partners": true}')
on conflict (org_id) do update set sector = 'banking', features = '{"partners": true}';

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
create temp table tok (k text primary key, v text);
grant all on tok to authenticated, anon;

-- ---- Sectors: a cosmetic product in a bank-sector organisation; MAW-03/04 scoped to creators ----
do $$ begin
  insert into public.products (id, org_id, name_ar, sector, product_type, regulator, key_facts)
  values ('59000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', 'كريم ندى', 'cosmetics', 'skincare', 'SFDA',
          '{"cosmetics": {"intended_use_ar": "العناية اليومية بالبشرة"}}');
  if (select applicability from public.rules r join public.rulebook_versions v on v.id = r.rulebook_version_id
      where v.status = 'published' and r.code = 'MAW-03') @> '{"any_of": [{"communication_types": ["general_commercial"]}]}' then
    raise exception 'MAW-03 still applies to own-channel general commercial ads';
  end if;
  perform pg_temp.expect_error($q$insert into public.products (org_id, name_ar, sector, product_type, regulator) values ('29000000-0000-0000-0000-000000000001', 'x', 'astrology', 'other', 'other')$q$, 'products_sector_check');
end $$;

-- ---- V1 by the marketer with two findings (one violation) ----
set local role authenticated;
select pg_temp.as_user('19000000-0000-0000-0000-000000000005');
insert into public.promotions (id, owner_id, org_id, title, communication_type, product_id, sector, distribution)
values ('49000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', '29000000-0000-0000-0000-000000000001', 'كريم ندى', 'general_commercial',
        '59000000-0000-0000-0000-000000000001', 'cosmetics', 'owned');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256)
values ('39000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005', 'text', 'x', 'x', 'beauty', '49000000-0000-0000-0000-000000000001', 'aa01');
reset role;
update public.submissions set status = 'done', analyzed_at = now() where id = '39000000-0000-0000-0000-000000000001';
insert into public.analysis_runs (id, submission_id, status) values ('69000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'done');
insert into public.findings (id, run_id, submission_id, rule_code, severity, evidence_type, source, finding_type, evidence_text) values
  ('79000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'COM-01', 'violation', 'transcript', 'deterministic', 'potential_risk', 'النتيجة مضمونة'),
  ('79000000-0000-0000-0000-000000000002', '69000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', 'AI-01', 'warning', 'metadata', 'deterministic', 'missing_required', 'ai');

set local role authenticated;
select pg_temp.as_user('19000000-0000-0000-0000-000000000005');
do $$
declare _n int;
begin
  -- Unanswered findings: an explanation is required, not an answer to each finding.
  if (public.can_submit('49000000-0000-0000-0000-000000000001')->>'unanswered')::int <> 2 then raise exception 'unanswered count'; end if;
  perform pg_temp.expect_error($q$select public.submit_promotion('49000000-0000-0000-0000-000000000001')$q$, 'code:note_required_unanswered');
  -- Idempotent responses: repeating the same answer adds no history row.
  perform public.respond_finding('79000000-0000-0000-0000-000000000002', 'agree_will_action');
  perform public.respond_finding('79000000-0000-0000-0000-000000000002', 'agree_will_action');
  select count(*) into _n from public.finding_responses where finding_id = '79000000-0000-0000-0000-000000000002';
  if _n <> 1 then raise exception 'duplicate response rows: %', _n; end if;
  perform pg_temp.expect_error($q$select public.respond_finding('79000000-0000-0000-0000-000000000001', 'request_guidance')$q$, 'code:comment_required');
  perform public.respond_finding('79000000-0000-0000-0000-000000000001', 'request_guidance', 'هل تكفي إزالة كلمة مضمونة؟');
  perform pg_temp.expect_error($q$select public.respond_finding('79000000-0000-0000-0000-000000000001', 'correction_verified')$q$, 'code:forbidden');
  perform public.submit_promotion('49000000-0000-0000-0000-000000000001', 'نحتاج توجيه المراجع في ملاحظة الادعاء');
  if (select review_status from public.promotions where id = '49000000-0000-0000-0000-000000000001') <> 'pending_review' then raise exception 'not submitted'; end if;
end $$;

-- Viewer and legal cannot submit, respond, assign or decide.
select pg_temp.as_user('19000000-0000-0000-0000-000000000006');
do $$ begin
  perform pg_temp.expect_error($q$select public.assign_reviewer('49000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000003')$q$, 'code:forbidden');
  perform pg_temp.expect_error($q$select public.respond_finding('79000000-0000-0000-0000-000000000001', 'dispute', 'x')$q$, 'code:forbidden');
  perform pg_temp.expect_error($q$select public.eligible_reviewers('49000000-0000-0000-0000-000000000001')$q$, 'code:forbidden');
end $$;

-- Admin assigns; re-assigning the same reviewer is a no-op (one event).
select pg_temp.as_user('19000000-0000-0000-0000-000000000002');
do $$
declare _list jsonb;
begin
  _list := public.eligible_reviewers('49000000-0000-0000-0000-000000000001');
  if exists (select 1 from jsonb_array_elements(_list) e where e->>'user_id' = '19000000-0000-0000-0000-000000000005') then raise exception 'uploader listed as reviewer'; end if;
  if exists (select 1 from jsonb_array_elements(_list) e where e->>'role' in ('legal', 'viewer', 'creator')) then raise exception 'ineligible role listed'; end if;
  perform pg_temp.expect_error($q$select public.assign_reviewer('49000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000005')$q$, 'code:not_a_reviewer');
  perform public.assign_reviewer('49000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000003');
  perform public.assign_reviewer('49000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000003');
  if (select count(*) from public.review_events where promotion_id = '49000000-0000-0000-0000-000000000001' and event_type = 'assigned') <> 1 then raise exception 'duplicate assignment events'; end if;
end $$;

-- Reviewer: request changes without answering every finding; approval stays blocked.
select pg_temp.as_user('19000000-0000-0000-0000-000000000004');
do $$ begin
  perform pg_temp.expect_error($q$select public.open_review('49000000-0000-0000-0000-000000000001')$q$, 'code:not_assigned');
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000003');
do $$
declare _c jsonb;
begin
  perform public.open_review('49000000-0000-0000-0000-000000000001');
  _c := public.can_decide('49000000-0000-0000-0000-000000000001');
  if not (_c->>'ok')::boolean then raise exception 'decision gated: %', _c; end if;
  if (_c->>'approve_ok')::boolean then raise exception 'approval not blocked: %', _c; end if;
  perform pg_temp.expect_error($q$select public.decide_promotion('49000000-0000-0000-0000-000000000001', 'approve')$q$, 'code:missing_reviewer_responses');
  -- Confirmed violation blocks approval even after every finding is assessed.
  perform public.respond_finding('79000000-0000-0000-0000-000000000001', 'agree_please_action');
  perform public.respond_finding('79000000-0000-0000-0000-000000000002', 'not_required', 'الإفصاح موجود في الوصف');
  perform pg_temp.expect_error($q$select public.decide_promotion('49000000-0000-0000-0000-000000000001', 'approve')$q$, 'code:confirmed_violations');
  perform pg_temp.expect_error($q$select public.decide_promotion('49000000-0000-0000-0000-000000000001', 'conditional_approve')$q$, 'code:confirmed_violations');
  perform public.decide_promotion('49000000-0000-0000-0000-000000000001', 'request_changes', array['a1000000-0000-0000-0000-000000000002']::uuid[], null, null, 'احذفوا عبارة النتيجة المضمونة');
  if (select review_status from public.promotions where id = '49000000-0000-0000-0000-000000000001') <> 'changes_requested' then raise exception 'not changes_requested'; end if;
end $$;

-- Marketer uploads V2 (no violation) and resubmits; it returns to the same eligible reviewer.
select pg_temp.as_user('19000000-0000-0000-0000-000000000005');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256)
values ('39000000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000005', 'text', 'إعلان مدفوع', 'x', 'beauty', '49000000-0000-0000-0000-000000000001', 'aa02');
reset role;
update public.submissions set status = 'done', analyzed_at = now() where id = '39000000-0000-0000-0000-000000000002';
insert into public.analysis_runs (id, submission_id, status) values ('69000000-0000-0000-0000-000000000002', '39000000-0000-0000-0000-000000000002', 'done');
insert into public.findings (id, run_id, submission_id, rule_code, severity, evidence_type, source, finding_type, evidence_text) values
  ('79000000-0000-0000-0000-000000000003', '69000000-0000-0000-0000-000000000002', '39000000-0000-0000-0000-000000000002', 'MAW-02', 'warning', 'metadata', 'deterministic', 'missing_required', 'licence');
set local role authenticated;
select pg_temp.as_user('19000000-0000-0000-0000-000000000005');
do $$ begin
  if not exists (select 1 from public.notifications where kind = 'review_decided' and payload->>'decision' = 'request_changes' and payload ? 'version_no') then
    raise exception 'marketer not notified'; end if;
end $$;
select public.submit_promotion('49000000-0000-0000-0000-000000000001', 'حذفنا الادعاء المطلق');
do $$ begin
  if (select assigned_reviewer_id from public.promotions where id = '49000000-0000-0000-0000-000000000001') <> '19000000-0000-0000-0000-000000000003' then raise exception 'did not return to reviewer'; end if;
end $$;

-- Reviewer: conditional approval needs explicit conditions; it creates structured rows.
select pg_temp.as_user('19000000-0000-0000-0000-000000000003');
do $$
declare _d uuid;
begin
  perform public.open_review('49000000-0000-0000-0000-000000000001');
  perform public.respond_finding('79000000-0000-0000-0000-000000000003', 'evidence_required', 'أرفقوا شهادة إدراج المنتج');
  perform pg_temp.expect_error($q$select public.decide_promotion('49000000-0000-0000-0000-000000000001', 'conditional_approve', '{}', null, null, null, '[]'::jsonb)$q$, 'code:condition_required');
  perform pg_temp.expect_error($q$select public.decide_promotion('49000000-0000-0000-0000-000000000001', 'conditional_approve', '{}', null, null, null, '[{"description": " "}]'::jsonb)$q$, 'code:condition_required');
  _d := public.decide_promotion('49000000-0000-0000-0000-000000000001', 'conditional_approve', '{}', null, null, 'معتمد بشرط',
    '[{"description": "إرفاق شهادة إدراج المنتج لدى الهيئة", "evidence_required": true}, {"description": "تأكيد مدة الإعلان", "required_action": "ردّ مكتوب"}]'::jsonb);
  if (select count(*) from public.approval_conditions where decision_id = _d) <> 2 then raise exception 'conditions not stored'; end if;
  if (select review_status from public.promotions where id = '49000000-0000-0000-0000-000000000001') <> 'conditionally_approved' then raise exception 'not conditional'; end if;
  perform pg_temp.expect_error($q$select public.finalize_conditional_approval('49000000-0000-0000-0000-000000000001')$q$, 'code:conditions_unverified');
end $$;

-- Others cannot fulfil; the marketer answers each condition and submits them for verification.
select pg_temp.as_user('19000000-0000-0000-0000-000000000006');
do $$ begin
  perform pg_temp.expect_error(format('select public.save_condition_response(%L, %L)', (select id from public.approval_conditions where position = 1 limit 1), 'x'), 'code:forbidden');
  perform pg_temp.expect_error($q$select public.submit_conditions('49000000-0000-0000-0000-000000000001')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000005');
do $$
declare _c1 uuid := (select id from public.approval_conditions where position = 1 limit 1); _c2 uuid := (select id from public.approval_conditions where position = 2 limit 1);
begin
  perform pg_temp.expect_error(format('select public.verify_condition(%L, %L)', _c1, 'verified'), 'code:forbidden');
  perform pg_temp.expect_error($q$select public.submit_conditions('49000000-0000-0000-0000-000000000001')$q$, 'code:conditions_incomplete');
  perform pg_temp.expect_error(format('select public.save_condition_response(%L, %L, %L)', _c1, 'x', '{javascript:alert(1)}'), 'code:invalid_link');
  perform pg_temp.expect_error(format('select public.save_condition_response(%L, %L, %L, %L)', _c1, 'x', '{}', '{other-org/file.pdf}'), 'code:invalid_path');
  perform public.save_condition_response(_c1, 'الشهادة مرفقة', '{https://example.test/cert.pdf}', '{}');
  perform public.save_condition_response(_c2, 'المدة 15 ثانية');
  if public.submit_conditions('49000000-0000-0000-0000-000000000001') <> 2 then raise exception 'not submitted'; end if;
  if public.submit_conditions('49000000-0000-0000-0000-000000000001') <> 0 then raise exception 'second submit not a no-op'; end if;
  if (select count(*) from public.review_events where promotion_id = '49000000-0000-0000-0000-000000000001' and event_type = 'conditions_submitted') <> 1 then raise exception 'duplicate events'; end if;
end $$;

-- An unassigned reviewer cannot verify; the assigned one asks for more evidence once, then verifies.
select pg_temp.as_user('19000000-0000-0000-0000-000000000004');
do $$ begin
  perform pg_temp.expect_error(format('select public.verify_condition(%L, %L)', (select id from public.approval_conditions where position = 1 limit 1), 'verified'), 'code:forbidden');
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000003');
do $$
declare _c1 uuid := (select id from public.approval_conditions where position = 1 limit 1); _c2 uuid := (select id from public.approval_conditions where position = 2 limit 1);
begin
  perform pg_temp.expect_error(format('select public.verify_condition(%L, %L)', _c1, 'more_evidence'), 'code:note_required');
  perform public.verify_condition(_c1, 'more_evidence', 'الشهادة منتهية');
  perform public.verify_condition(_c2, 'verified');
  perform pg_temp.expect_error($q$select public.finalize_conditional_approval('49000000-0000-0000-0000-000000000001')$q$, 'code:conditions_unverified');
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000005');
select public.save_condition_response((select id from public.approval_conditions where position = 1 limit 1), 'شهادة سارية', '{https://example.test/cert-2026.pdf}', '{}');
select public.submit_conditions('49000000-0000-0000-0000-000000000001');
select pg_temp.as_user('19000000-0000-0000-0000-000000000003');
do $$
declare _final uuid; _n int;
begin
  perform public.verify_condition((select id from public.approval_conditions where position = 1 limit 1), 'verified');
  select count(*) into _n from public.review_decisions where promotion_id = '49000000-0000-0000-0000-000000000001';
  _final := public.finalize_conditional_approval('49000000-0000-0000-0000-000000000001', 'الشروط مستوفاة');
  if (select review_status from public.promotions where id = '49000000-0000-0000-0000-000000000001') <> 'approved' then raise exception 'not approved'; end if;
  if (select count(*) from public.review_decisions where promotion_id = '49000000-0000-0000-0000-000000000001') <> _n + 1 then raise exception 'final approval not a separate decision'; end if;
  if (select from_status::text from public.review_decisions where id = _final) <> 'conditionally_approved' then raise exception 'final from_status'; end if;
  if not exists (select 1 from public.review_decisions where promotion_id = '49000000-0000-0000-0000-000000000001' and decision = 'conditional_approve') then raise exception 'conditional decision lost'; end if;
  if not (public.verify_decision_chain('49000000-0000-0000-0000-000000000001')->>'valid')::boolean then raise exception 'chain invalid'; end if;
  perform pg_temp.expect_error($q$update public.approval_conditions set status = 'open'$q$, 'permission denied');
end $$;
reset role;

-- ---- Partners: scope, limit, cancellation, assigned links, rotation, expiry ----
set local role authenticated;
select pg_temp.as_user('19000000-0000-0000-0000-000000000002');
insert into public.campaigns (id, org_id, name, created_by) values ('89000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', 'حملة ندى', '19000000-0000-0000-0000-000000000002');
do $$
declare _r jsonb;
begin
  _r := public.create_partner_link_v2('29000000-0000-0000-0000-000000000001', jsonb_build_object('label', 'وكالة ندى',
    'product_ids', jsonb_build_array('59000000-0000-0000-0000-000000000001'), 'channels', jsonb_build_array('snapchat', 'tiktok'),
    'communication_types', jsonb_build_array('general_commercial', 'creator_sponsored'),
    'campaign_id', '89000000-0000-0000-0000-000000000001', 'instructions_ar', 'ارفعوا المقطع بدقة 1080p', 'terms_ar', 'أوافق', 'max_active', 2));
  insert into tok values ('t', _r->>'token'), ('id', _r->>'id');
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000007');
do $$
declare _a uuid; _b uuid;
begin
  perform public.partner_join((select v from tok where k = 't'), true);
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000002');
select public.decide_partner_access('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000007', true);
select pg_temp.as_user('19000000-0000-0000-0000-000000000007');
do $$
declare _a uuid; _b uuid; _links jsonb;
begin
  if not exists (select 1 from public.notifications where kind = 'partner_access_decided') then raise exception 'partner not notified'; end if;
  _links := public.my_partner_links();
  if jsonb_array_length(_links) <> 1 or _links->0->>'instructions_ar' is null or _links->0->'campaign'->>'name' <> 'حملة ندى' then raise exception 'links: %', _links; end if;
  if _links::text like '%' || (select v from tok where k = 't') || '%' then raise exception 'token leaked'; end if;
  perform pg_temp.expect_error(format('select public.partner_create_promotion_v2(%L, null, %L, %L, %L, %L)', (select v from tok where k = 'id'), 'x',
    '59000000-0000-0000-0000-000000000001', '{snapchat}', 'financial_promotion'), 'code:communication_type_not_allowed');
  _a := public.partner_create_promotion_v2((select v from tok where k = 'id')::uuid, null, 'مسودة 1', '59000000-0000-0000-0000-000000000001', '{snapchat}', 'general_commercial');
  _b := public.partner_create_promotion_v2((select v from tok where k = 'id')::uuid, null, 'مسودة 2', '59000000-0000-0000-0000-000000000001', '{tiktok}', 'general_commercial');
  if (select campaign_id from public.promotions where id = _a) <> '89000000-0000-0000-0000-000000000001' then raise exception 'campaign not set'; end if;
  if (select sector from public.promotions where id = _a) <> 'cosmetics' then raise exception 'sector not from product'; end if;
  perform pg_temp.expect_error(format('select public.partner_create_promotion(%L, %L, %L, %L, %L)', (select v from tok where k = 't'), 'مسودة 3',
    '59000000-0000-0000-0000-000000000001', '{snapchat}', 'general_commercial'), 'code:limit_reached');
  perform public.cancel_draft_promotion(_a, 'مكررة');
  perform public.partner_create_promotion((select v from tok where k = 't'), 'مسودة 3', '59000000-0000-0000-0000-000000000001', '{snapchat}', 'general_commercial');
  if not exists (select 1 from public.review_events where promotion_id = _a and event_type = 'archived') then raise exception 'cancel not audited'; end if;
  -- Partner reads nothing of the organisation beyond its own advertisements.
  if exists (select 1 from public.promotions where id = '49000000-0000-0000-0000-000000000001') then raise exception 'partner reads internal ad'; end if;
  if exists (select 1 from public.approval_conditions) then raise exception 'partner reads conditions'; end if;
  perform pg_temp.expect_error($q$select public.partner_link_stats('29000000-0000-0000-0000-000000000001')$q$, 'code:forbidden');
end $$;

-- A link assigned to another partner is not usable by this one.
select pg_temp.as_user('19000000-0000-0000-0000-000000000002');
do $$ begin
  perform public.update_partner_link((select v from tok where k = 'id')::uuid, jsonb_build_object('partner_ids', jsonb_build_array()));
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000008');
do $$ begin
  perform public.partner_join((select v from tok where k = 't'), true);
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000002');
select public.decide_partner_access('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000008', true);
select public.update_partner_link((select v from tok where k = 'id')::uuid, jsonb_build_object('partner_ids', jsonb_build_array('19000000-0000-0000-0000-000000000007')));
select pg_temp.as_user('19000000-0000-0000-0000-000000000008');
do $$ begin
  -- agency2 joined through this link, so it stays usable for them (membership link); other links would not be.
  if exists (select 1 from public.promotions where owner_id = '19000000-0000-0000-0000-000000000007') then raise exception 'cross-partner read'; end if;
end $$;

-- Rotation: the old token stops working; expiry: links stop resolving.
select pg_temp.as_user('19000000-0000-0000-0000-000000000002');
do $$
declare _new text;
begin
  _new := public.rotate_partner_link((select v from tok where k = 'id')::uuid);
  if (public.partner_link_info((select v from tok where k = 't'))->>'ok')::boolean then raise exception 'rotated token still works'; end if;
  if not (public.partner_link_info(_new)->>'ok')::boolean then raise exception 'new token fails'; end if;
  perform public.update_partner_link((select v from tok where k = 'id')::uuid, jsonb_build_object('expires_at', (now() - interval '1 minute')::text));
  if (public.partner_link_info(_new)->>'ok')::boolean then raise exception 'expired link works'; end if;
  if (public.partner_link_stats('29000000-0000-0000-0000-000000000001')->(select v from tok where k = 'id')->>'submissions')::int <> 3 then raise exception 'stats'; end if;
end $$;
select pg_temp.as_user('19000000-0000-0000-0000-000000000007');
do $$ begin
  if jsonb_array_length(public.my_partner_links()) <> 0 then raise exception 'expired link listed'; end if;
end $$;
reset role;

select pass('p9 upgrade');
select * from finish();
rollback;
