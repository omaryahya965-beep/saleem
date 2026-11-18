-- Phase 5 — claims lifecycle and permissions, fix from a finding resolves all its findings, disclaimers,
-- overrides, saved views, reminders, RLS. Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('16000000-0000-0000-0000-000000000001', 'ad@l.test'), ('16000000-0000-0000-0000-000000000002', 'rv@l.test'),
  ('16000000-0000-0000-0000-000000000003', 'cr@l.test'), ('16000000-0000-0000-0000-000000000004', 'out@l.test');
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '16000000-%';
insert into public.organizations (id, name, created_by) values ('26000000-0000-0000-0000-000000000001', 'Bank L', '16000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'admin'),
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', 'reviewer'),
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003', 'creator');

create or replace function pg_temp.as_user(_u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', _u, true), set_config('request.jwt.claim.role', 'authenticated', true)
$$;
create or replace function pg_temp.expect_error(_sql text, _code text) returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'expected % but succeeded: %', _code, _sql;
exception when others then
  if sqlerrm not like '%' || _code || '%' then raise exception 'expected %, got %', _code, sqlerrm; end if;
end $$;

do $$ begin
  if (select count(*) from public.rules where rulebook_version_id = '22222222-2222-2222-2222-222222222222' and code in ('SYS-CLAIMS', 'SYS-DISCLAIMERS')) <> 2 then
    raise exception 'system rules missing'; end if;
  if (select count(*) from public.disclaimers where org_id is null and is_template and name like 'صيغة مقترحة%') <> 2 then raise exception 'templates missing'; end if;
end $$;

-- Creator drafts and submits a claim; substantiation required; the creator cannot review it.
set local role authenticated;
select pg_temp.as_user('16000000-0000-0000-0000-000000000003');
do $$
declare _c uuid;
begin
  _c := public.save_claim(null, '26000000-0000-0000-0000-000000000001', 'عدد العملاء', 'أكثر من 45,000 عميل', null, '{}', '{}', '{}', '[]', current_date + 7, null);
  perform set_config('test.c', _c::text, true);
  if (select normalized_text from public.claims where id = _c) <> 'اكثر من 45,000 عميل' then raise exception 'normalisation %', (select normalized_text from public.claims where id = _c); end if;
  perform pg_temp.expect_error(format($q$select public.submit_claim(%L)$q$, _c), 'code:substantiation_required');
  perform public.save_claim(_c, '26000000-0000-0000-0000-000000000001', 'عدد العملاء', 'أكثر من 45,000 عميل', null, '{}', '{}', '{}', '[{"kind":"url","url":"https://example.test/report"}]', current_date + 7, null);
  perform public.submit_claim(_c);
  perform pg_temp.expect_error(format($q$select public.review_claim(%L, 'approve')$q$, _c), 'code:forbidden');
end $$;

-- Reviewer approves; approved claims are locked; a new version supersedes.
select pg_temp.as_user('16000000-0000-0000-0000-000000000002');
do $$
declare _c uuid := current_setting('test.c')::uuid; _v2 uuid;
begin
  perform pg_temp.expect_error(format($q$select public.review_claim(%L, 'reject')$q$, _c), 'code:reason_required');
  perform public.review_claim(_c, 'approve');
  if (select status from public.claims where id = _c) <> 'approved' then raise exception 'not approved'; end if;
  perform pg_temp.expect_error(format($q$select public.save_claim(%L, '26000000-0000-0000-0000-000000000001', 'x', 'y', null, '{}', '{}', '{}', '[]', null, null)$q$, _c), 'code:claim_locked');
  _v2 := public.new_claim_version(_c);
  if (select version from public.claims where id = _v2) <> 2 then raise exception 'version 2'; end if;
end $$;

-- Fix from a finding: the reviewer adds + approves; every open SYS-CLAIMS finding with that text is resolved.
select pg_temp.as_user('16000000-0000-0000-0000-000000000003');
insert into public.promotions (id, owner_id, org_id, title) values ('46000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003', '26000000-0000-0000-0000-000000000001', 'L');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id)
values ('36000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003', 'text', 'x', 'x', 'finance', '46000000-0000-0000-0000-000000000001');
reset role;
select set_config('request.jwt.claim.role', '', true), set_config('request.jwt.claim.sub', '', true);
insert into public.analysis_runs (id, submission_id, status) values ('56000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'done');
insert into public.findings (id, run_id, submission_id, rule_code, severity, evidence_type, evidence_text, source, finding_type) values
  ('66000000-0000-0000-0000-000000000001', '56000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'SYS-CLAIMS', 'warning', 'caption', 'الأقل تكلفة في المملكة', 'deterministic', 'needs_evidence'),
  ('66000000-0000-0000-0000-000000000002', '56000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'SYS-CLAIMS', 'warning', 'frame', 'الأقل تكلفة في المملكة', 'llm', 'needs_evidence');
set local role authenticated;
select pg_temp.as_user('16000000-0000-0000-0000-000000000003');
do $$ begin
  perform pg_temp.expect_error($q$select public.claim_add_from_finding('66000000-0000-0000-0000-000000000001', 'أقل تكلفة', 'الأقل تكلفة في المملكة', '[{"kind":"url","url":"https://x.test"}]', true)$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('16000000-0000-0000-0000-000000000002');
do $$ begin
  perform public.claim_add_from_finding('66000000-0000-0000-0000-000000000001', 'أقل تكلفة', 'الأقل تكلفة في المملكة', '[{"kind":"url","url":"https://x.test"}]', true);
  if exists (select 1 from public.findings where id in ('66000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000002') and status <> 'resolved') then
    raise exception 'not every finding for the claim was resolved'; end if;
  if not exists (select 1 from public.promotion_claims where promotion_id = '46000000-0000-0000-0000-000000000001' and link_source = 'finding_fix') then raise exception 'not linked'; end if;
end $$;

-- Overrides: admin only, narrow keys only, reason required, audited.
select pg_temp.as_user('16000000-0000-0000-0000-000000000002');
do $$ begin
  perform pg_temp.expect_error($q$select public.set_rule_override('26000000-0000-0000-0000-000000000001', 'SAMA-ADV-04', '{"exclude_channels":["branch"]}', 'الفروع لا تعرض العروض')$q$, 'code:forbidden');
end $$;
select pg_temp.as_user('16000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.expect_error($q$select public.set_rule_override('26000000-0000-0000-0000-000000000001', 'SAMA-ADV-04', '{"applicability":{"sectors":["*"]}}', 'widen')$q$, 'code:invalid_override');
  perform pg_temp.expect_error($q$select public.set_rule_override('26000000-0000-0000-0000-000000000001', 'SAMA-ADV-04', '{"exclude_channels":["branch"]}', '')$q$, 'code:reason_required');
  perform public.set_rule_override('26000000-0000-0000-0000-000000000001', 'SAMA-ADV-04', '{"exclude_channels":["branch"]}', 'الفروع لا تعرض العروض');
  perform public.save_disclaimer(null, '26000000-0000-0000-0000-000000000001', 'إشراف', 'بنك ل خاضع لإشراف ورقابة البنك المركزي السعودي', null, '{}', '{}', '{financial_promotion}', '{SAMA-ADV-03-9}', false, 'active');
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.audit_events where action = 'rule_override') then raise exception 'override not audited'; end if;
end $$;

-- Saved views: own + shared; outsider sees no library data.
set local role authenticated;
select pg_temp.as_user('16000000-0000-0000-0000-000000000003');
insert into public.saved_views (org_id, scope, name, filters, shared) values ('26000000-0000-0000-0000-000000000001', 'promotions', 'بانتظاري', '{"status":"changes_requested"}', true);
select pg_temp.as_user('16000000-0000-0000-0000-000000000002');
do $$ begin
  if not exists (select 1 from public.saved_views where name = 'بانتظاري') then raise exception 'shared view not visible'; end if;
end $$;
select pg_temp.as_user('16000000-0000-0000-0000-000000000004');
do $$ begin
  if exists (select 1 from public.claims) or exists (select 1 from public.saved_views) or exists (select 1 from public.org_rule_overrides)
     or exists (select 1 from public.disclaimers where org_id is not null) then raise exception 'outsider reads library data'; end if;
  perform pg_temp.expect_error($q$select public.save_claim(null, '26000000-0000-0000-0000-000000000001', 'x', 'y', null, '{}', '{}', '{}', '[]', null, null)$q$, 'code:forbidden');
end $$;
reset role;

-- Reminders: due in 7 days → notification; expired → status expired.
select set_config('request.jwt.claim.role', '', true), set_config('request.jwt.claim.sub', '', true);
update public.claims set expires_at = current_date - 1 where id = current_setting('test.c')::uuid;
do $$ begin
  perform public.claims_reminders();
  if (select status from public.claims where id = current_setting('test.c')::uuid) <> 'expired' then raise exception 'not expired'; end if;
  if not exists (select 1 from public.notifications where kind = 'claim_expired') then raise exception 'no expiry notification'; end if;
end $$;

select pass('libraries');
select * from finish();
rollback;
