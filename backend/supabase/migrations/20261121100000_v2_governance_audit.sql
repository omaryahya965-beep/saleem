-- V2 completion — governance audit (D186–D187).
--
-- Self-approval re-audit. Enabling the feature must never bypass: confirmed or open violations, required evidence,
-- outstanding conditions, high-risk regulatory packs, multi-stage approval or partial analysis coverage. Before this
-- migration, an `all_answered` rule let the uploader self-approve a version with open violations as soon as they had
-- answered them, and the high-risk check only used packs an organisation had listed itself.
--
-- Lifecycle: «published» can no longer be recorded while an advertisement is only conditionally approved
-- (conditions unmet). Publication under risk acceptance stays possible but is labelled in the audit event.
-- Risk acceptance itself was audited and needs no change: it never edits findings, writes its own hash-chained
-- `risk_accept` decision on the current version, needs a documented reason and a capability holder other than the
-- requester and the uploader, does not set approved_version_id and is counted separately in analytics.

-- Regulator packs whose rules are high risk by default (an organisation may add more, never remove these).
create or replace function public.self_approval_default_blocked_packs()
returns text[] language sql immutable set search_path = '' as $$
  select array['sa-sama-advertising', 'sa-cma-securities', 'sa-ia-insurance', 'sa-bank', 'sa-cma']::text[]
$$;

create or replace function public.can_self_approve(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role; _reasons text[] := '{}'; _rule public.self_approval_rules; _run uuid; _ptype text;
  _psector text; _coverage jsonb; _blocked text[];
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or p.org_id is null or not public.can_read_promotion(_pid) then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('not_found')); end if;
  if not public.org_feature(p.org_id, 'self_approval') then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('feature_off')); end if;
  if public.promotion_uploader(_pid) is distinct from auth.uid() then _reasons := array_append(_reasons, 'not_uploader'::text); end if;
  if p.review_status <> 'pending_review' then _reasons := array_append(_reasons, 'invalid_status'::text); end if;
  -- Multi-stage approval: a live flow, or a preset that applies to this advertisement.
  if public.flow_is_live(_pid) or (public.org_feature(p.org_id, 'multi_level_approval') and public.preset_for(_pid) is not null) then
    _reasons := array_append(_reasons, 'multi_level_flow'::text);
  end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  select pr.product_type, pr.sector into _ptype, _psector from public.products pr where pr.id = p.product_id;
  -- Financial promotions are regulated advertising: never self-approved.
  if p.communication_type = 'financial_promotion' then _reasons := array_append(_reasons, 'financial_promotion'::text); end if;
  select r.* into _rule from public.self_approval_rules r
  where r.org_id = p.org_id and r.active
    and (cardinality(r.channels) = 0 or p.channels <@ r.channels)
    and (cardinality(r.product_types) = 0 or _ptype = any(r.product_types))
    and (cardinality(r.markets) = 0 or p.market = any(r.markets))
    and (auth.uid() = any(r.user_ids) or _role = any(r.roles))
  order by (r.ai_requirement = 'no_findings') desc, r.created_at limit 1;
  if _rule.id is null then _reasons := array_append(_reasons, 'no_matching_rule'::text);
  else
    _run := public.latest_run_id(p.current_version_id);
    select coverage into _coverage from public.analysis_runs where id = _run;
    if _run is null or (select status from public.submissions where id = p.current_version_id) <> 'done' then
      _reasons := array_append(_reasons, 'analysis_not_done'::text);
    else
      if coalesce(_coverage->>'status', 'complete') = 'partial' then _reasons := array_append(_reasons, 'coverage_partial'::text); end if;
      if _rule.ai_requirement = 'no_findings' and exists (select 1 from public.findings f where f.run_id = _run) then
        _reasons := array_append(_reasons, 'has_findings'::text);
      elsif _rule.ai_requirement = 'all_answered' and exists (select 1 from public.findings f where f.run_id = _run
            and not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'uploader')) then
        _reasons := array_append(_reasons, 'findings_unanswered'::text);
      end if;
      -- Whatever the rule says: no open violation, no evidence request, no open clarification.
      if exists (select 1 from public.findings f where f.run_id = _run and f.severity = 'violation'
                 and f.status not in ('resolved', 'verified', 'not_required', 'dismissed')) then
        _reasons := array_append(_reasons, 'open_violations'::text);
      end if;
      if exists (select 1 from public.findings f where f.run_id = _run and f.status not in ('resolved', 'verified', 'not_required', 'dismissed')
                 and (f.finding_type = 'needs_evidence' or f.status in ('evidence_required', 'clarification_required'))) then
        _reasons := array_append(_reasons, 'evidence_required'::text);
      end if;
    end if;
    _blocked := public.self_approval_default_blocked_packs()
      || coalesce((select s.self_approval_blocked_packs from public.org_settings s where s.org_id = p.org_id), '{}');
    if _run is not null and exists (select 1 from public.rule_checks c join public.rules ru on ru.id = c.rule_id
               where c.run_id = _run and c.outcome <> 'not_applicable' and ru.pack = any(_blocked)) then
      _reasons := array_append(_reasons, 'high_risk_pack'::text);
    end if;
  end if;
  -- Outstanding conditions of an earlier conditional approval on this same version.
  if exists (select 1 from public.approval_conditions c where c.promotion_id = _pid and c.submission_id = p.current_version_id and c.status <> 'verified') then
    _reasons := array_append(_reasons, 'conditions_unverified'::text);
  end if;
  return jsonb_build_object('ok', cardinality(_reasons) = 0, 'reasons', to_jsonb(_reasons), 'rule_id', _rule.id);
end $$;

create or replace function public.record_lifecycle(_pid uuid, _event text, _at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or not public.lifecycle_can_edit(p) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _event not in ('published', 'taken_down') then raise exception 'code:invalid_event' using errcode = 'P0001'; end if;
  -- A conditional approval is not a final approval: publication waits for the verified final decision.
  if _event = 'published' and p.review_status not in ('approved', 'risk_accepted', 'due_for_rereview') then
    raise exception 'code:not_approved' using errcode = 'P0001';
  end if;
  update public.promotions set
    published_at = case when _event = 'published' then coalesce(_at, now()) else published_at end,
    taken_down_at = case when _event = 'taken_down' then coalesce(_at, now()) else taken_down_at end,
    updated_at = now()
  where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'lifecycle_' || _event, p.review_status::text, p.review_status::text,
    jsonb_build_object('at', coalesce(_at, now()), 'under_risk_acceptance', p.review_status = 'risk_accepted'));
end $$;

-- Demo sandbox: every AI run of sandbox users counts toward one daily cap (analysis and SALEEM Fix), so public demo
-- access cannot consume unrestricted quota. Read by the Edge Functions (service role); default 40 per day.
create or replace function public.demo_ai_runs_today()
returns integer language sql stable security definer set search_path = '' as $$
  select (
    (select count(*) from public.analysis_runs r join public.submissions s on s.id = r.submission_id
       where r.started_at >= now() - interval '24 hours'
         and exists (select 1 from public.org_members m join public.demo_sandbox_orgs d on d.org_id = m.org_id where m.user_id = s.user_id))
    + (select count(*) from public.correction_jobs j
       where j.updated_at >= now() - interval '24 hours' and j.attempts > 0 and j.org_id in (select org_id from public.demo_sandbox_orgs))
  )::int
$$;
create or replace function public.is_demo_sandbox_user(_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.org_members m join public.demo_sandbox_orgs d on d.org_id = m.org_id where m.user_id = _user)
$$;
revoke all on function public.demo_ai_runs_today(), public.is_demo_sandbox_user(uuid) from public, anon, authenticated;
grant execute on function public.demo_ai_runs_today(), public.is_demo_sandbox_user(uuid) to service_role;
