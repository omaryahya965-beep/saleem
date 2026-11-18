-- v2 Phase 2 — M4 `v2_findings_rule_checks`.
-- Typed, cited findings; one recorded outcome per considered rule; coverage and context per run; report hash
-- v2 (adds finding type and rule id) while logs sealed before keep verifying with the v1 input. Additive only.

alter table public.findings
  add column if not exists rule_id                   uuid null references public.rules(id) on delete set null,
  add column if not exists finding_type              text null check (finding_type in
    ('confirmed_mismatch', 'potential_risk', 'missing_required', 'needs_evidence', 'unable_to_verify')),
  add column if not exists location                  jsonb null,
  add column if not exists missing_information_ar    text null,
  add column if not exists citation                  jsonb null,
  add column if not exists rule_draft                boolean not null default false,
  add column if not exists carried_from_finding_id   uuid null references public.findings(id) on delete set null,
  add column if not exists resolved_in_submission_id uuid null references public.submissions(id) on delete set null,
  add column if not exists status                    text not null default 'open'
    check (status in ('open', 'actioned', 'disputed', 'dismissed', 'not_required', 'resolved'));
create index if not exists findings_submission_status_idx on public.findings (submission_id, status);
create index if not exists findings_rule_idx on public.findings (rule_id);

create table if not exists public.rule_checks (
  id            bigint generated always as identity primary key,
  run_id        uuid not null references public.analysis_runs(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  rule_id       uuid not null references public.rules(id) on delete cascade,
  outcome       text not null check (outcome in ('passed', 'failed', 'not_applicable', 'unable_to_verify')),
  reason_code   text null,
  finding_ids   uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  unique (run_id, rule_id)
);
create index if not exists rule_checks_submission_idx on public.rule_checks (submission_id);
alter table public.rule_checks enable row level security;
grant select on public.rule_checks to anon, authenticated;
grant all on public.rule_checks to service_role;
drop policy if exists rule_checks_select on public.rule_checks;
create policy rule_checks_select on public.rule_checks for select to anon, authenticated
  using (public.can_read_submission(submission_id));

alter table public.analysis_runs
  add column if not exists coverage         jsonb null,
  add column if not exists context_snapshot jsonb null;

-- ---------------------------------------------------------------------------------------------
-- Report hash v2. compute_report_hash() dispatches on compliance_logs.hash_version, so a log sealed
-- with v1 verifies with the v1 input forever.
-- ---------------------------------------------------------------------------------------------
alter table public.compliance_logs add column if not exists hash_version int not null default 1 check (hash_version in (1, 2));

create or replace function public.compute_report_hash_v1(_sid uuid)
returns text language sql stable security definer set search_path = public, extensions as $$
  with run as (
    select id, coalesce(rulebook_version, '') as rv from public.analysis_runs
    where submission_id = _sid order by started_at desc limit 1
  )
  select encode(extensions.digest(
    concat_ws('|',
      _sid::text,
      (select coalesce(sha256, '') from public.submissions where id = _sid),
      (select coalesce(overall_status::text, '') from public.submissions where id = _sid),
      (select rv from run),
      coalesce((select string_agg(concat_ws(':', f.rule_code, f.severity, coalesce(f.t_start::text, '-'), coalesce(f.evidence_text, '')), ';'
                         order by f.rule_code, f.t_start nulls last, f.evidence_text)
                from public.findings f where f.run_id = (select id from run)), '')
    ), 'sha256'), 'hex')
$$;

create or replace function public.compute_report_hash_v2(_sid uuid)
returns text language sql stable security definer set search_path = public, extensions as $$
  with run as (
    select id, coalesce(rulebook_version, '') as rv from public.analysis_runs
    where submission_id = _sid order by started_at desc limit 1
  )
  select encode(extensions.digest(
    concat_ws('|',
      'v2',
      _sid::text,
      (select coalesce(sha256, '') from public.submissions where id = _sid),
      (select coalesce(overall_status::text, '') from public.submissions where id = _sid),
      (select rv from run),
      coalesce((select string_agg(concat_ws(':', f.rule_code, coalesce(f.rule_id::text, '-'), coalesce(f.finding_type, '-'), f.severity,
                                            coalesce(f.t_start::text, '-'), coalesce(f.evidence_text, '')), ';'
                         order by f.rule_code, f.t_start nulls last, f.evidence_text, f.finding_type)
                from public.findings f where f.run_id = (select id from run)), '')
    ), 'sha256'), 'hex')
$$;

create or replace function public.compute_report_hash(_sid uuid)
returns text language sql stable security definer set search_path = public, extensions as $$
  select case when coalesce((select hash_version from public.compliance_logs where submission_id = _sid), 1) = 2
              then public.compute_report_hash_v2(_sid) else public.compute_report_hash_v1(_sid) end
$$;

-- New seals use v2.
create or replace function public.seal_compliance_log(_sid uuid)
returns void language sql security definer set search_path = public as $$
  update public.compliance_logs set hash_version = 2, report_hash = public.compute_report_hash_v2(_sid), generated_at = now()
  where submission_id = _sid
$$;

revoke all on function public.compute_report_hash_v1(uuid), public.compute_report_hash_v2(uuid), public.compute_report_hash(uuid),
  public.seal_compliance_log(uuid) from public, anon, authenticated;
grant execute on function public.compute_report_hash_v1(uuid), public.compute_report_hash_v2(uuid), public.compute_report_hash(uuid),
  public.seal_compliance_log(uuid) to service_role;
