-- V2 (D208): approval needs a completed automated analysis of the CURRENT version. Found by the partner browser test:
-- with the analysis failed (no provider), the reviewer could approve a version nobody had analysed. Requesting
-- changes or rejecting stays possible (the reviewer can always send it back); only approve / conditional approve are
-- blocked, through approval_blockers → can_decide.approve_ok → decide_promotion.
create or replace function public.approval_blockers(_pid uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _settings public.org_settings; _run uuid; _out text[] := '{}'; _n int; _status text;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null then return array['not_found']; end if;
  select status::text into _status from public.submissions where id = p.current_version_id;
  if _status is distinct from 'done' then _out := array_append(_out, ('analysis_not_done:' || coalesce(_status, 'none'))::text); end if;
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
end $$;
revoke all on function public.approval_blockers(uuid) from public, anon;
grant execute on function public.approval_blockers(uuid) to authenticated, service_role;
