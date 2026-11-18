-- v2 Phase 7.1: self-approval behind org_settings.features.self_approval (default off).
-- Org rules by channel, product type, market, people/roles and an AI requirement (`no_findings` default or
-- `all_answered`; "nothing" is not offered). Eligibility is re-checked inside the RPC at click time. The record shows
-- the uploader as approver with «اعتماد ذاتي»; there is no self conditional approval; packs the org marks high-risk
-- (any applicable rule from them) block it; it is never available inside a multi-level flow.

create table if not exists public.self_approval_rules (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 120),
  channels       text[] not null default '{}',
  product_types  text[] not null default '{}',
  markets        text[] not null default '{}',
  roles          public.org_role[] not null default '{}',
  user_ids       uuid[] not null default '{}',
  ai_requirement text not null default 'no_findings' check (ai_requirement in ('no_findings', 'all_answered')),
  active         boolean not null default true,
  created_by     uuid null references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  check (cardinality(roles) > 0 or cardinality(user_ids) > 0)
);
alter table public.org_settings add column if not exists self_approval_blocked_packs text[] not null default '{}';
alter table public.self_approval_rules enable row level security;
drop policy if exists self_approval_rules_read on public.self_approval_rules;
create policy self_approval_rules_read on public.self_approval_rules for select to authenticated using (public.is_org_member(org_id));
grant select on public.self_approval_rules to authenticated;

create or replace function public.save_self_approval_rule(_org uuid, _id uuid, _name text, _channels text[], _product_types text[],
  _markets text[], _roles public.org_role[], _users uuid[], _ai text, _active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _rid uuid := _id;
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not public.org_feature(_org, 'self_approval') then raise exception 'code:feature_off' using errcode = 'P0001'; end if;
  if coalesce(_ai, '') not in ('no_findings', 'all_answered') then raise exception 'code:invalid_ai_requirement' using errcode = 'P0001'; end if;
  if cardinality(coalesce(_roles, '{}')) = 0 and cardinality(coalesce(_users, '{}')) = 0 then raise exception 'code:people_required' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(coalesce(_roles, '{}')) r where r in ('external_uploader', 'external_reviewer', 'legal')) then
    raise exception 'code:invalid_role' using errcode = 'P0001';
  end if;
  if _rid is null then
    insert into public.self_approval_rules (org_id, name, channels, product_types, markets, roles, user_ids, ai_requirement, active, created_by)
    values (_org, trim(_name), coalesce(_channels, '{}'), coalesce(_product_types, '{}'), coalesce(_markets, '{}'), coalesce(_roles, '{}'),
      coalesce(_users, '{}'), _ai, coalesce(_active, true), auth.uid()) returning id into _rid;
  else
    update public.self_approval_rules set name = trim(_name), channels = coalesce(_channels, '{}'), product_types = coalesce(_product_types, '{}'),
      markets = coalesce(_markets, '{}'), roles = coalesce(_roles, '{}'), user_ids = coalesce(_users, '{}'), ai_requirement = _ai, active = coalesce(_active, true)
    where id = _rid and org_id = _org;
    if not found then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  end if;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'self_approval_rule.save', 'self_approval_rules', _rid::text, jsonb_build_object('org_id', _org, 'ai', _ai, 'active', _active));
  return _rid;
end $$;

/** {ok, reasons[], rule_id}: same checks as self_approve. */
create or replace function public.can_self_approve(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
end $$;

create or replace function public.self_approve(_pid uuid, _comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _check jsonb; d public.review_decisions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _check := public.can_self_approve(_pid);
  if not (_check->>'ok')::boolean then
    raise exception 'code:%', split_part(_check->'reasons'->>0, ':', 1) using errcode = 'P0001', detail = _check::text;
  end if;
  d := public.write_decision(p, 'approve', 'self_approval', 'approved', '{}', null, null,
    concat_ws(' — ', 'اعتماد ذاتي', nullif(trim(coalesce(_comment, '')), '')));
  update public.promotions set review_status = 'approved', first_decision_at = coalesce(first_decision_at, now()), approved_at = now(),
    approved_version_id = current_version_id, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'self_approved', 'pending_review', 'approved',
    jsonb_build_object('decision_id', d.id, 'rule_id', _check->>'rule_id'));
  perform public.notify_org(p.org_id, array['owner', 'admin']::public.org_role[], 'review_decided', p.current_version_id,
    jsonb_build_object('promotion_id', _pid, 'title', p.title, 'decision', 'self_approval'));
  return d.id;
end $$;

revoke all on function public.save_self_approval_rule(uuid, uuid, text, text[], text[], text[], public.org_role[], uuid[], text, boolean),
  public.can_self_approve(uuid), public.self_approve(uuid, text) from public, anon;
grant execute on function public.save_self_approval_rule(uuid, uuid, text, text[], text[], text[], public.org_role[], uuid[], text, boolean),
  public.can_self_approve(uuid), public.self_approve(uuid, text) to authenticated;
