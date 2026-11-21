-- Rollback of 20261121100000_v2_governance_audit.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
drop function if exists public.self_approval_default_blocked_packs();
drop function if exists public.demo_ai_runs_today();
drop function if exists public.is_demo_sandbox_user(uuid);
CREATE OR REPLACE FUNCTION public.record_lifecycle(_pid uuid, _event text, _at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.promotions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or not public.lifecycle_can_edit(p) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _event not in ('published', 'taken_down') then raise exception 'code:invalid_event' using errcode = 'P0001'; end if;
  if _event = 'published' and p.review_status not in ('approved', 'conditionally_approved', 'risk_accepted', 'due_for_rereview') then
    raise exception 'code:not_approved' using errcode = 'P0001';
  end if;
  update public.promotions set
    published_at = case when _event = 'published' then coalesce(_at, now()) else published_at end,
    taken_down_at = case when _event = 'taken_down' then coalesce(_at, now()) else taken_down_at end,
    updated_at = now()
  where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'lifecycle_' || _event, p.review_status::text, p.review_status::text,
    jsonb_build_object('at', coalesce(_at, now())));
end $function$;
CREATE OR REPLACE FUNCTION public.can_self_approve(_pid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.promotions; _role public.org_role; _reasons text[] := '{}'; _rule public.self_approval_rules; _run uuid; _ptype text;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or p.org_id is null or not public.can_read_promotion(_pid) then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('not_found')); end if;
  if not public.org_feature(p.org_id, 'self_approval') then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('feature_off')); end if;
  if public.promotion_uploader(_pid) is distinct from auth.uid() then _reasons := array_append(_reasons, ('not_uploader')::text); end if;
  if p.review_status <> 'pending_review' then _reasons := array_append(_reasons, ('invalid_status')::text); end if;
  if public.flow_is_live(_pid) then _reasons := array_append(_reasons, ('multi_level_flow')::text); end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  select pr.product_type into _ptype from public.products pr where pr.id = p.product_id;
  select r.* into _rule from public.self_approval_rules r
  where r.org_id = p.org_id and r.active
    and (cardinality(r.channels) = 0 or p.channels <@ r.channels)
    and (cardinality(r.product_types) = 0 or _ptype = any(r.product_types))
    and (cardinality(r.markets) = 0 or p.market = any(r.markets))
    and (auth.uid() = any(r.user_ids) or _role = any(r.roles))
  order by (r.ai_requirement = 'no_findings') desc, r.created_at limit 1;
  if _rule.id is null then _reasons := array_append(_reasons, ('no_matching_rule')::text);
  else
    _run := public.latest_run_id(p.current_version_id);
    if _run is null or (select status from public.submissions where id = p.current_version_id) <> 'done' then
      _reasons := array_append(_reasons, ('analysis_not_done')::text);
    elsif _rule.ai_requirement = 'no_findings' and exists (select 1 from public.findings f where f.run_id = _run) then
      _reasons := array_append(_reasons, ('has_findings')::text);
    elsif _rule.ai_requirement = 'all_answered' and exists (select 1 from public.findings f where f.run_id = _run
          and not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'uploader')) then
      _reasons := array_append(_reasons, ('findings_unanswered')::text);
    end if;
    if exists (select 1 from public.rule_checks c join public.rules ru on ru.id = c.rule_id
               where c.run_id = _run and c.outcome <> 'not_applicable'
                 and ru.pack = any(coalesce((select s.self_approval_blocked_packs from public.org_settings s where s.org_id = p.org_id), '{}'))) then
      _reasons := array_append(_reasons, ('high_risk_pack')::text);
    end if;
  end if;
  return jsonb_build_object('ok', cardinality(_reasons) = 0, 'reasons', to_jsonb(_reasons), 'rule_id', _rule.id);
end $function$;
commit;
