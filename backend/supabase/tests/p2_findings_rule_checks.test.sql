-- Phase 2 — M4: old seals verify after the hash change; new seals use v2; rule_checks RLS.
-- Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

-- Demo logs were sealed with v1 by the earlier migration: they must still verify as unchanged.
do $$ begin
  if exists (
    select 1 from public.compliance_logs l
    where l.report_hash is not null and l.hash_version = 1 and l.report_hash <> public.compute_report_hash(l.submission_id)) then
    raise exception 'an old seal no longer verifies';
  end if;
  if not ((public.verify_compliance_log('d0000000-0000-0000-0000-000000000001')->>'unchanged')::boolean) then
    raise exception 'demo log does not verify';
  end if;
end $$;

-- Re-sealing switches to v2, still verifies, and detects a change to a finding type.
do $$
declare _sid uuid := 'd0000000-0000-0000-0000-000000000001';
begin
  perform public.seal_compliance_log(_sid);
  if (select hash_version from public.compliance_logs where submission_id = _sid) <> 2 then raise exception 'not v2'; end if;
  if not ((public.verify_compliance_log(_sid)->>'unchanged')::boolean) then raise exception 'v2 seal does not verify'; end if;
  update public.findings set finding_type = 'potential_risk'
  where id = (select id from public.findings where submission_id = _sid order by rule_code limit 1);
  if ((public.verify_compliance_log(_sid)->>'unchanged')::boolean) then raise exception 'tamper not detected'; end if;
end $$;

-- rule_checks: owner reads, outsider does not, client cannot write.
insert into auth.users (id, email) values
  ('13000000-0000-0000-0000-000000000001', 'rc-owner@test.local'),
  ('13000000-0000-0000-0000-000000000002', 'rc-out@test.local');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, status)
values ('33000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'text', 'x', 'x', 'other', 'done');
insert into public.analysis_runs (id, submission_id) values ('43000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001');
insert into public.rule_checks (run_id, submission_id, rule_id, outcome, reason_code)
select '43000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', id, 'not_applicable', 'draft_excluded'
from public.rules where code = 'SAMA-ADV-02' and rulebook_version_id = '22222222-2222-2222-2222-222222222222';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true),
       set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);
do $$ begin
  if (select count(*) from public.rule_checks where submission_id = '33000000-0000-0000-0000-000000000001') <> 1 then raise exception 'owner cannot read rule_checks'; end if;
  begin
    insert into public.rule_checks (run_id, submission_id, rule_id, outcome)
    select '43000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', id, 'passed' from public.rules where code = 'MAW-01' limit 1;
    raise exception 'client wrote a rule check';
  exception when insufficient_privilege then null; end;
  begin
    update public.findings set status = 'dismissed' where submission_id = '33000000-0000-0000-0000-000000000001';
    raise exception 'client updated finding status';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000002', true);
do $$ begin
  if exists (select 1 from public.rule_checks where submission_id = '33000000-0000-0000-0000-000000000001') then raise exception 'outsider reads rule_checks'; end if;
end $$;
reset role;

select pass('findings v2, rule_checks and versioned report hash');
select * from finish();
rollback;
