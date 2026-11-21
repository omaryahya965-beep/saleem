-- Rollback of 20261121180000_v2_approval_requires_analysis.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
CREATE OR REPLACE FUNCTION public.approval_blockers(_pid uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.promotions; _settings public.org_settings; _run uuid; _out text[] := '{}'; _n int;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null then return array['not_found']; end if;
  _run := public.latest_run_id(p.current_version_id);
  select * into _settings from public.org_settings where org_id = p.org_id;
  -- Confirmed violations the reviewer asked to correct (or asked evidence for) and nobody verified.
  select count(*) into _n from public.findings f
  where f.run_id = _run and f.severity = 'violation' and f.status in ('actioned', 'evidence_required', 'clarification_required')
    and exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'reviewer');
  if _n > 0 then _out := array_append(_out, ('confirmed_violations:' || _n)::text); end if;
  if coalesce(_settings.require_reviewer_responses, true) then
    select count(*) into _n from public.findings f
    where f.run_id = _run and f.status not in ('resolved', 'verified')
      and not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'reviewer');
    if _n > 0 then _out := array_append(_out, ('missing_reviewer_responses:' || _n)::text); end if;
  end if;
  return _out;
end $function$;
commit;
