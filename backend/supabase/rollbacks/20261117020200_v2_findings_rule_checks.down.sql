-- Rollback of 20261117020200_v2_findings_rule_checks.sql. Logs sealed with v2 stop verifying after rollback
-- (re-seal them with the v1 function first if needed). Data loss: finding types, citations, rule checks, coverage.
create or replace function public.compute_report_hash(_sid uuid)
returns text language sql stable security definer set search_path = public, extensions as $$
  select public.compute_report_hash_v1(_sid)
$$;
create or replace function public.seal_compliance_log(_sid uuid)
returns void language sql security definer set search_path = public as $$
  update public.compliance_logs set report_hash = public.compute_report_hash_v1(_sid), generated_at = now() where submission_id = _sid
$$;
drop function if exists public.compute_report_hash_v2(uuid);
alter table public.compliance_logs drop column if exists hash_version;
alter table public.analysis_runs drop column if exists coverage, drop column if exists context_snapshot;
drop table if exists public.rule_checks;
alter table public.findings
  drop column if exists rule_id, drop column if exists finding_type, drop column if exists location,
  drop column if exists missing_information_ar, drop column if exists citation, drop column if exists rule_draft,
  drop column if exists carried_from_finding_id, drop column if exists resolved_in_submission_id, drop column if exists status;
