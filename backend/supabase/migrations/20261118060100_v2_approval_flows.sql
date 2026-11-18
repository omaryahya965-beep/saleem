-- v2 Phase 6.1 (M9): multi-level approval behind org_settings.features.multi_level_approval (default off).
-- Presets (sequential | parallel) with steps by role or named users, auto-apply by market (+ product type), the live
-- copy per submission (promotion_review_steps), step decisions (sealed like every decision), carry-forward on
-- resubmission, and replacing a live flow (discards recorded step decisions, logged). Additive only.

-- ---------------------------------------------------------------------------------------------
-- 0. Feature flags: exactly `true` enables; anything else is off.
-- ---------------------------------------------------------------------------------------------
create or replace function public.org_feature(_org uuid, _key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.features->>_key = 'true' from public.org_settings s where s.org_id = _org), false)
$$;
revoke all on function public.org_feature(uuid, text) from public, anon;
grant execute on function public.org_feature(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------
create table if not exists public.approval_presets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 120),
  mode        text not null check (mode in ('sequential', 'parallel')),
  is_default  boolean not null default false,
  active      boolean not null default true,
  version     integer not null default 1,
  created_by  uuid null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists approval_presets_one_default on public.approval_presets (org_id) where is_default and active;

create table if not exists public.approval_preset_steps (
  id         uuid primary key default gen_random_uuid(),
  preset_id  uuid not null references public.approval_presets(id) on delete cascade,
  position   integer not null check (position between 1 and 10),
  role       public.org_role null,
  user_ids   uuid[] not null default '{}',
  label_ar   text not null check (char_length(trim(label_ar)) between 1 and 120),
  unique (preset_id, position),
  check (role is not null or cardinality(user_ids) > 0)
);

create table if not exists public.preset_auto_apply (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  market        text not null,
  product_type  text null,
  preset_id     uuid not null references public.approval_presets(id) on delete cascade
);
create unique index if not exists preset_auto_apply_key on public.preset_auto_apply (org_id, market, coalesce(product_type, '*'));

create table if not exists public.promotion_review_steps (
  id              uuid primary key default gen_random_uuid(),
  promotion_id    uuid not null references public.promotions(id) on delete restrict,
  submission_id   uuid not null references public.submissions(id) on delete restrict,
  flow_no         integer not null,
  preset_id       uuid null references public.approval_presets(id) on delete set null,
  preset_version  integer not null,
  mode            text not null check (mode in ('sequential', 'parallel')),
  step_no         integer not null,
  label_ar        text not null,
  role            public.org_role null,
  assignee_ids    uuid[] not null default '{}',
  status          text not null check (status in ('waiting', 'open', 'approved', 'changes_requested', 'rejected', 'skipped', 'carried_forward')),
  fresh_required  boolean not null default false,
  decided_by      uuid null,
  decided_at      timestamptz null,
  decision_id     uuid null references public.review_decisions(id) on delete restrict,
  created_at      timestamptz not null default now(),
  unique (promotion_id, flow_no, step_no)
);
create index if not exists promotion_review_steps_open_idx on public.promotion_review_steps (promotion_id, flow_no) where status in ('open', 'waiting');

alter table public.review_decisions add column if not exists step_id uuid null references public.promotion_review_steps(id) on delete restrict;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired', 'review_step_open', 'review_flow_replaced'));

-- ---------------------------------------------------------------------------------------------
-- 2. RLS: members read; writes through RPCs only
-- ---------------------------------------------------------------------------------------------
alter table public.approval_presets enable row level security;
alter table public.approval_preset_steps enable row level security;
alter table public.preset_auto_apply enable row level security;
alter table public.promotion_review_steps enable row level security;

drop policy if exists approval_presets_select on public.approval_presets;
create policy approval_presets_select on public.approval_presets for select to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin', 'reviewer', 'creator', 'legal']::public.org_role[]));
drop policy if exists approval_preset_steps_select on public.approval_preset_steps;
create policy approval_preset_steps_select on public.approval_preset_steps for select to authenticated
  using (exists (select 1 from public.approval_presets p where p.id = preset_id
                 and public.is_org_member(p.org_id, array['owner', 'admin', 'reviewer', 'creator', 'legal']::public.org_role[])));
drop policy if exists preset_auto_apply_select on public.preset_auto_apply;
create policy preset_auto_apply_select on public.preset_auto_apply for select to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin', 'reviewer', 'creator', 'legal']::public.org_role[]));
drop policy if exists promotion_review_steps_select on public.promotion_review_steps;
create policy promotion_review_steps_select on public.promotion_review_steps for select to authenticated
  using (public.can_read_promotion(promotion_id));

grant select on public.approval_presets, public.approval_preset_steps, public.preset_auto_apply, public.promotion_review_steps to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Decisions carry the step (sealed when present; old rows hash exactly as before)
-- ---------------------------------------------------------------------------------------------
create or replace function public.decision_payload(d public.review_decisions)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'promotion_id', d.promotion_id, 'submission_id', d.submission_id, 'decision', d.decision, 'actor_id', d.actor_id,
    'actor_role', d.actor_role, 'reason_ids', to_jsonb(d.reason_ids), 'reason_other', d.reason_other, 'condition_ar', d.condition_ar,
    'comment', d.comment, 'from_status', d.from_status, 'to_status', d.to_status, 'asset_sha256', d.asset_sha256,
    'rulebook_version_id', d.rulebook_version_id, 'findings_snapshot', d.findings_snapshot, 'created_at', to_char(d.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
    || case when d.step_id is null then '{}'::jsonb else jsonb_build_object('step_id', d.step_id) end
$$;

create or replace function public.write_decision_step(p public.promotions, _decision text, _role text, _to public.promotion_review_status,
  _reason_ids uuid[], _reason_other text, _condition text, _comment text, _step uuid)
returns public.review_decisions language plpgsql security definer set search_path = '' as $$
declare d public.review_decisions; _prev text;
begin
  select hash into _prev from public.review_decisions where promotion_id = p.id order by created_at desc, id desc limit 1;
  d.id := gen_random_uuid();
  d.promotion_id := p.id;
  d.submission_id := p.current_version_id;
  d.decision := _decision;
  d.actor_id := auth.uid();
  d.actor_role := _role;
  d.reason_ids := coalesce(_reason_ids, '{}');
  d.reason_other := nullif(trim(coalesce(_reason_other, '')), '');
  d.condition_ar := nullif(trim(coalesce(_condition, '')), '');
  d.comment := nullif(trim(coalesce(_comment, '')), '');
  d.from_status := p.review_status;
  d.to_status := _to;
  d.findings_snapshot := public.findings_snapshot(p.current_version_id);
  d.asset_sha256 := coalesce((select sha256 from public.submissions where id = p.current_version_id), '');
  d.rulebook_version_id := (select rulebook_version_id from public.analysis_runs where id = public.latest_run_id(p.current_version_id));
  d.created_at := date_trunc('milliseconds', clock_timestamp());
  d.step_id := _step;
  d.prev_hash := _prev;
  d.hash := public.decision_hash(_prev, public.decision_payload(d));
  insert into public.review_decisions values (d.*);
  return d;
end $$;

create or replace function public.write_decision(p public.promotions, _decision text, _role text, _to public.promotion_review_status,
  _reason_ids uuid[], _reason_other text, _condition text, _comment text)
returns public.review_decisions language sql security definer set search_path = '' as $$
  select public.write_decision_step(p, _decision, _role, _to, _reason_ids, _reason_other, _condition, _comment, null)
$$;
revoke all on function public.write_decision_step(public.promotions, text, text, public.promotion_review_status, uuid[], text, text, text, uuid),
  public.write_decision(public.promotions, text, text, public.promotion_review_status, uuid[], text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Flow helpers
-- ---------------------------------------------------------------------------------------------
create or replace function public.current_flow_no(_pid uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select max(flow_no) from public.promotion_review_steps where promotion_id = _pid
$$;

create or replace function public.flow_is_live(_pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.promotion_review_steps s
                 where s.promotion_id = _pid and s.flow_no = public.current_flow_no(_pid) and s.status in ('open', 'waiting'))
$$;

/** The preset that applies to a promotion: auto-apply (market + product type), then market only, then the default. */
create or replace function public.preset_for(_pid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select a.preset_id from public.preset_auto_apply a join public.approval_presets ap on ap.id = a.preset_id and ap.active
       join public.promotions p on p.id = _pid and p.org_id = a.org_id and p.market = a.market
       join public.products pr on pr.id = p.product_id and pr.product_type = a.product_type limit 1),
    (select a.preset_id from public.preset_auto_apply a join public.approval_presets ap on ap.id = a.preset_id and ap.active
       join public.promotions p on p.id = _pid and p.org_id = a.org_id and p.market = a.market
     where a.product_type is null limit 1),
    (select ap.id from public.approval_presets ap join public.promotions p on p.id = _pid and p.org_id = ap.org_id
     where ap.is_default and ap.active limit 1))
$$;

/** Creates the live steps for the current version. `_carry` = step numbers of the previous flow to carry forward. */
create or replace function public.start_review_flow(_pid uuid, _carry integer[], _preset uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  p public.promotions; ap public.approval_presets; _prev integer; _flow integer; st public.approval_preset_steps;
  _first_open integer := null; _status text; _carried boolean; prev_step public.promotion_review_steps;
begin
  select * into p from public.promotions where id = _pid;
  if p.org_id is null or not public.org_feature(p.org_id, 'multi_level_approval') then return null; end if;
  select * into ap from public.approval_presets where id = coalesce(_preset, public.preset_for(_pid)) and active and org_id = p.org_id;
  if ap.id is null then
    if cardinality(coalesce(_carry, '{}')) > 0 then raise exception 'code:carry_not_allowed' using errcode = 'P0001'; end if;
    return null;
  end if;
  _prev := public.current_flow_no(_pid);
  _flow := coalesce(_prev, 0) + 1;
  if cardinality(coalesce(_carry, '{}')) > 0 then
    if _prev is null
       or exists (select 1 from public.promotion_review_steps s where s.promotion_id = _pid and s.flow_no = _prev
                  and (s.fresh_required or s.preset_id is distinct from ap.id or s.preset_version <> ap.version)) then
      raise exception 'code:carry_not_allowed' using errcode = 'P0001';
    end if;
    if (select count(*) from public.approval_preset_steps where preset_id = ap.id) <= cardinality(_carry) then
      raise exception 'code:carry_all_not_allowed' using errcode = 'P0001';
    end if;
  end if;
  for st in select * from public.approval_preset_steps where preset_id = ap.id order by position loop
    _carried := st.position = any(coalesce(_carry, '{}'));
    prev_step := null;
    if _carried then
      select * into prev_step from public.promotion_review_steps
      where promotion_id = _pid and flow_no = _prev and step_no = st.position and status in ('approved', 'carried_forward');
      if prev_step.id is null then raise exception 'code:carry_not_allowed' using errcode = 'P0001'; end if;
      _status := 'carried_forward';
    elsif ap.mode = 'parallel' or _first_open is null then
      _status := 'open';
      _first_open := coalesce(_first_open, st.position);
    else
      _status := 'waiting';
    end if;
    insert into public.promotion_review_steps (promotion_id, submission_id, flow_no, preset_id, preset_version, mode, step_no, label_ar,
      role, assignee_ids, status, decided_by, decided_at, decision_id)
    values (_pid, p.current_version_id, _flow, ap.id, ap.version, ap.mode, st.position, st.label_ar, st.role, st.user_ids, _status,
      prev_step.decided_by, prev_step.decided_at, prev_step.decision_id);
  end loop;
  perform public.log_review_event(_pid, p.current_version_id, 'flow_started', p.review_status::text, p.review_status::text,
    jsonb_build_object('flow_no', _flow, 'preset_id', ap.id, 'mode', ap.mode, 'carried', to_jsonb(coalesce(_carry, '{}'))));
  perform public.notify_step_open(_pid, _flow);
  return _flow;
end $$;

/** Notifies the people who can act on the open steps of a flow. */
create or replace function public.notify_step_open(_pid uuid, _flow integer)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, submission_id, payload)
  select distinct m.user_id, 'review_step_open', s.submission_id,
         jsonb_build_object('promotion_id', _pid, 'title', p.title, 'step', s.label_ar)
  from public.promotion_review_steps s
  join public.promotions p on p.id = s.promotion_id
  join public.org_members m on m.org_id = p.org_id
  where s.promotion_id = _pid and s.flow_no = _flow and s.status = 'open'
    and (m.user_id = any(s.assignee_ids) or (cardinality(s.assignee_ids) = 0 and (m.role = s.role or (s.role = 'admin' and m.role = 'owner'))))
    and m.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and m.user_id is distinct from public.promotion_uploader(_pid)
$$;

revoke all on function public.current_flow_no(uuid), public.flow_is_live(uuid), public.preset_for(uuid),
  public.start_review_flow(uuid, integer[], uuid), public.notify_step_open(uuid, integer) from public, anon, authenticated;
grant execute on function public.current_flow_no(uuid), public.flow_is_live(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Submit (same checks) + flow; single decisions and escalation are blocked while a flow is live
-- ---------------------------------------------------------------------------------------------
create or replace function public.submit_promotion_carry(_pid uuid, _note text default null, _ack_failed boolean default false, _carry integer[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _check jsonb; _from public.promotion_review_status;
begin
  select * into p from public.promotions where id = _pid for update;
  _check := public.can_submit(_pid, _note, _ack_failed);
  if not (_check->>'ok')::boolean then
    raise exception 'code:%', split_part(_check->'reasons'->>0, ':', 1) using errcode = 'P0001', detail = _check::text;
  end if;
  _from := p.review_status;
  update public.promotions set review_status = 'pending_review', submitted_at = coalesce(submitted_at, now()), updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'submitted', _from::text, 'pending_review',
    jsonb_build_object('note', nullif(trim(coalesce(_note, '')), ''), 'analysis_failed_acknowledged', _ack_failed));
  if public.start_review_flow(_pid, _carry) is null then
    perform public.notify_org(p.org_id, array['owner', 'admin', 'reviewer']::public.org_role[], 'review_submitted', p.current_version_id,
      jsonb_build_object('promotion_id', _pid, 'title', p.title));
  end if;
end $$;

create or replace function public.submit_promotion(_pid uuid, _note text default null, _ack_failed boolean default false)
returns void language sql security definer set search_path = '' as $$
  select public.submit_promotion_carry(_pid, _note, _ack_failed, '{}'::integer[])
$$;

create or replace function public.can_decide(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _reasons text[] := '{}'; _role public.org_role; _settings public.org_settings; _open int;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('not_found')); end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if _role is null or _role not in ('owner', 'admin', 'reviewer') then _reasons := array_append(_reasons, ('forbidden')::text); end if;
  if p.review_status <> 'in_review' then _reasons := array_append(_reasons, ('invalid_status')::text); end if;
  if public.promotion_uploader(_pid) = auth.uid() then _reasons := array_append(_reasons, ('separation_of_duties')::text); end if;
  if public.flow_is_live(_pid) then _reasons := array_append(_reasons, ('multi_level_flow')::text); end if;
  select * into _settings from public.org_settings where org_id = p.org_id;
  if coalesce(_settings.require_reviewer_responses, true) then
    select count(*) into _open from public.findings f
    where f.run_id = public.latest_run_id(p.current_version_id) and f.status <> 'resolved'
      and not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'reviewer');
    if _open > 0 then _reasons := array_append(_reasons, (('missing_reviewer_responses:' || _open))::text); end if;
  end if;
  return jsonb_build_object('ok', cardinality(_reasons) = 0, 'reasons', to_jsonb(_reasons));
end $$;

create or replace function public.escalate_promotion(_pid uuid, _legal_user uuid, _question text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role; d public.review_decisions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if _role is null or _role not in ('owner', 'admin', 'reviewer') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if p.review_status <> 'in_review' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if public.promotion_uploader(_pid) = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  if public.flow_is_live(_pid) then raise exception 'code:multi_level_flow' using errcode = 'P0001'; end if;
  if public.org_role_of(p.org_id, _legal_user) is distinct from 'legal' then raise exception 'code:not_legal_member' using errcode = 'P0001'; end if;
  if coalesce(trim(_question), '') = '' then raise exception 'code:question_required' using errcode = 'P0001'; end if;
  d := public.write_decision(p, 'escalate', _role::text, 'escalated', '{}', null, null, _question);
  update public.promotions set review_status = 'escalated', escalated_to = _legal_user, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'escalated', 'in_review', 'escalated', jsonb_build_object('legal_user', _legal_user, 'decision_id', d.id));
  perform public.notify_user(_legal_user, 'review_escalated', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title));
  return d.id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Step decisions
-- ---------------------------------------------------------------------------------------------
create or replace function public.can_act_on_step(_step uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.promotion_review_steps; p public.promotions; _role public.org_role; _reasons text[] := '{}';
begin
  select * into s from public.promotion_review_steps where id = _step;
  select * into p from public.promotions where id = s.promotion_id;
  if s.id is null or not public.can_read_promotion(p.id) then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('not_found')); end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if _role is null or _role not in ('owner', 'admin', 'reviewer') then _reasons := array_append(_reasons, ('forbidden')::text);
  elsif cardinality(s.assignee_ids) > 0 and not auth.uid() = any(s.assignee_ids) then _reasons := array_append(_reasons, ('not_step_assignee')::text);
  elsif cardinality(s.assignee_ids) = 0 and s.role is not null and not (_role = s.role or (s.role = 'admin' and _role = 'owner')) then
    _reasons := array_append(_reasons, ('not_step_assignee')::text);
  end if;
  if s.status <> 'open' or s.flow_no <> public.current_flow_no(p.id) or s.submission_id <> p.current_version_id
     or p.review_status not in ('pending_review', 'in_review') then
    _reasons := array_append(_reasons, ('invalid_status')::text);
  end if;
  if public.promotion_uploader(p.id) = auth.uid() then _reasons := array_append(_reasons, ('separation_of_duties')::text); end if;
  if exists (select 1 from public.promotion_review_steps o where o.promotion_id = p.id and o.flow_no = s.flow_no and o.id <> s.id
             and o.decided_by = auth.uid() and o.status in ('approved', 'carried_forward', 'changes_requested', 'rejected')) then
    _reasons := array_append(_reasons, ('two_steps_same_person')::text);
  end if;
  return jsonb_build_object('ok', cardinality(_reasons) = 0, 'reasons', to_jsonb(_reasons));
end $$;

create or replace function public.decide_promotion_step(_pid uuid, _step uuid, _decision text, _reason_ids uuid[] default '{}',
  _reason_other text default null, _comment text default null, _fresh_review boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.promotions; s public.promotion_review_steps; _check jsonb; _to public.promotion_review_status; d public.review_decisions;
  _role public.org_role; _done boolean; _next integer;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select * into s from public.promotion_review_steps where id = _step and promotion_id = _pid for update;
  if s.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _check := public.can_act_on_step(_step);
  if not (_check->>'ok')::boolean then
    raise exception 'code:%', split_part(_check->'reasons'->>0, ':', 1) using errcode = 'P0001', detail = _check::text;
  end if;
  if _decision not in ('approve', 'request_changes', 'reject') then raise exception 'code:not_available_in_flow' using errcode = 'P0001'; end if;
  if _decision in ('reject', 'request_changes') and cardinality(coalesce(_reason_ids, '{}')) = 0 and coalesce(trim(_reason_other), '') = '' then
    raise exception 'code:reason_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rejection_reasons r where r.id = any(coalesce(_reason_ids, '{}')) and r.is_other) and coalesce(trim(_reason_other), '') = '' then
    raise exception 'code:reason_other_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(coalesce(_reason_ids, '{}')) x where not exists (
      select 1 from public.rejection_reasons r where r.id = x and not r.archived and (r.org_id is null or r.org_id = p.org_id))) then
    raise exception 'code:invalid_reason' using errcode = 'P0001';
  end if;
  _role := public.org_role_of(p.org_id, auth.uid());

  if _decision = 'approve' then
    -- Done when no other step of this flow is still open or waiting.
    _done := not exists (select 1 from public.promotion_review_steps o where o.promotion_id = _pid and o.flow_no = s.flow_no
                         and o.id <> s.id and o.status in ('open', 'waiting'));
    _to := case when _done then 'approved' else 'in_review' end;
  else
    _to := case _decision when 'request_changes' then 'changes_requested' else 'rejected' end;
  end if;

  d := public.write_decision_step(p, _decision, _role::text, _to, _reason_ids, _reason_other, null, _comment, _step);
  update public.promotion_review_steps set
    status = case _decision when 'approve' then 'approved' when 'request_changes' then 'changes_requested' else 'rejected' end,
    fresh_required = _decision <> 'approve' and coalesce(_fresh_review, false),
    decided_by = auth.uid(), decided_at = now(), decision_id = d.id
  where id = _step;

  if _decision = 'approve' and not _done and s.mode = 'sequential' then
    select min(step_no) into _next from public.promotion_review_steps where promotion_id = _pid and flow_no = s.flow_no and status = 'waiting';
    update public.promotion_review_steps set status = 'open' where promotion_id = _pid and flow_no = s.flow_no and step_no = _next;
    perform public.notify_step_open(_pid, s.flow_no);
  elsif _decision <> 'approve' then
    update public.promotion_review_steps set status = 'skipped' where promotion_id = _pid and flow_no = s.flow_no and status in ('open', 'waiting');
  end if;

  update public.promotions set
    review_status = _to,
    first_decision_at = case when _to <> 'in_review' then coalesce(first_decision_at, now()) else first_decision_at end,
    approved_at = case when _to = 'approved' then now() else approved_at end,
    approved_version_id = case when _to = 'approved' then current_version_id else approved_version_id end,
    assigned_reviewer_id = coalesce(assigned_reviewer_id, auth.uid()),
    updated_at = now()
  where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'step_decided', p.review_status::text, _to::text,
    jsonb_build_object('decision', _decision, 'decision_id', d.id, 'step_no', s.step_no, 'flow_no', s.flow_no));
  if _to <> 'in_review' then
    perform public.log_review_event(_pid, p.current_version_id, 'decided', p.review_status::text, _to::text,
      jsonb_build_object('decision', _decision, 'decision_id', d.id, 'flow_no', s.flow_no));
    perform public.notify_user(public.promotion_uploader(_pid), 'review_decided', p.current_version_id,
      jsonb_build_object('promotion_id', _pid, 'title', p.title, 'decision', _decision));
  end if;
  return d.id;
end $$;

/** Admins replace the preset of a live flow. Recorded step decisions are discarded (they stay sealed in the log). */
create or replace function public.replace_review_flow(_pid uuid, _preset uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _flow integer; _discarded integer; _new integer;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not public.is_org_member(p.org_id, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not public.org_feature(p.org_id, 'multi_level_approval') then raise exception 'code:feature_off' using errcode = 'P0001'; end if;
  if p.review_status not in ('pending_review', 'in_review') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.approval_presets where id = _preset and org_id = p.org_id and active) then
    raise exception 'code:not_found' using errcode = 'P0001';
  end if;
  _flow := public.current_flow_no(_pid);
  select count(*) into _discarded from public.promotion_review_steps
  where promotion_id = _pid and flow_no = _flow and status in ('approved', 'carried_forward');
  update public.promotion_review_steps set status = 'skipped' where promotion_id = _pid and flow_no = _flow and status in ('open', 'waiting', 'approved', 'carried_forward');
  perform public.log_review_event(_pid, p.current_version_id, 'flow_replaced', p.review_status::text, p.review_status::text,
    jsonb_build_object('flow_no', _flow, 'preset_id', _preset, 'discarded_decisions', _discarded));
  _new := public.start_review_flow(_pid, '{}'::integer[], _preset);
  perform public.notify_org(p.org_id, array['owner', 'admin']::public.org_role[], 'review_flow_replaced', p.current_version_id,
    jsonb_build_object('promotion_id', _pid, 'title', p.title, 'discarded_decisions', _discarded));
  return _new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Presets (owners/admins)
-- ---------------------------------------------------------------------------------------------
/** Upserts a preset and replaces its steps. `_steps` = [{role?, user_ids?, label_ar}] in order. Editing bumps the version. */
create or replace function public.save_approval_preset(_org uuid, _id uuid, _name text, _mode text, _is_default boolean, _steps jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _pid uuid := _id; x jsonb; _i integer := 0; _users uuid[];
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _mode not in ('sequential', 'parallel') then raise exception 'code:invalid_mode' using errcode = 'P0001'; end if;
  if jsonb_typeof(_steps) <> 'array' or jsonb_array_length(_steps) not between 1 and 10 then raise exception 'code:steps_required' using errcode = 'P0001'; end if;
  if coalesce(trim(_name), '') = '' then raise exception 'code:name_required' using errcode = 'P0001'; end if;
  if _is_default then update public.approval_presets set is_default = false where org_id = _org and id is distinct from _pid; end if;
  if _pid is null then
    insert into public.approval_presets (org_id, name, mode, is_default, created_by) values (_org, trim(_name), _mode, _is_default, auth.uid()) returning id into _pid;
  else
    update public.approval_presets set name = trim(_name), mode = _mode, is_default = _is_default, version = version + 1, updated_at = now()
    where id = _pid and org_id = _org;
    if not found then raise exception 'code:not_found' using errcode = 'P0001'; end if;
    delete from public.approval_preset_steps where preset_id = _pid;
  end if;
  for x in select * from jsonb_array_elements(_steps) loop
    _i := _i + 1;
    _users := coalesce((select array_agg(v::uuid) from jsonb_array_elements_text(coalesce(x->'user_ids', '[]'::jsonb)) v), '{}');
    if exists (select 1 from unnest(_users) u where public.org_role_of(_org, u) is null or public.org_role_of(_org, u) not in ('owner', 'admin', 'reviewer')) then
      raise exception 'code:not_a_reviewer' using errcode = 'P0001';
    end if;
    if nullif(x->>'role', '') is not null and (x->>'role') not in ('owner', 'admin', 'reviewer') then raise exception 'code:invalid_role' using errcode = 'P0001'; end if;
    insert into public.approval_preset_steps (preset_id, position, role, user_ids, label_ar)
    values (_pid, _i, nullif(x->>'role', '')::public.org_role, _users, coalesce(nullif(trim(x->>'label_ar'), ''), 'المرحلة ' || _i));
  end loop;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'approval_preset.save', 'approval_presets', _pid::text, jsonb_build_object('org_id', _org, 'mode', _mode, 'steps', _steps));
  return _pid;
end $$;

create or replace function public.archive_approval_preset(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare _org uuid;
begin
  select org_id into _org from public.approval_presets where id = _id;
  if _org is null or not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  update public.approval_presets set active = false, is_default = false, updated_at = now() where id = _id;
  delete from public.preset_auto_apply where preset_id = _id;
end $$;

create or replace function public.set_preset_auto_apply(_org uuid, _market text, _product_type text, _preset uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  delete from public.preset_auto_apply where org_id = _org and market = _market and coalesce(product_type, '*') = coalesce(nullif(_product_type, ''), '*');
  if _preset is not null then
    if not exists (select 1 from public.approval_presets where id = _preset and org_id = _org and active) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
    insert into public.preset_auto_apply (org_id, market, product_type, preset_id) values (_org, _market, nullif(_product_type, ''), _preset);
  end if;
end $$;

/** For the submit form: the preset that will apply and whether it is locked by an auto-apply rule. */
create or replace function public.preset_preview(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _preset uuid; ap public.approval_presets; _prev integer;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) or p.org_id is null or not public.org_feature(p.org_id, 'multi_level_approval') then
    return jsonb_build_object('enabled', false);
  end if;
  _preset := public.preset_for(_pid);
  select * into ap from public.approval_presets where id = _preset;
  _prev := public.current_flow_no(_pid);
  return jsonb_build_object('enabled', true, 'preset_id', ap.id, 'name', ap.name, 'mode', ap.mode,
    'locked', exists (select 1 from public.preset_auto_apply a where a.preset_id = ap.id and a.org_id = p.org_id and a.market = p.market),
    'carryable', coalesce((select jsonb_agg(s.step_no order by s.step_no) from public.promotion_review_steps s
       where s.promotion_id = _pid and s.flow_no = _prev and s.status in ('approved', 'carried_forward')
         and s.preset_id = ap.id and s.preset_version = ap.version
         and not exists (select 1 from public.promotion_review_steps f where f.promotion_id = _pid and f.flow_no = _prev and f.fresh_required)), '[]'::jsonb));
end $$;

revoke all on function public.submit_promotion_carry(uuid, text, boolean, integer[]), public.can_act_on_step(uuid),
  public.decide_promotion_step(uuid, uuid, text, uuid[], text, text, boolean), public.replace_review_flow(uuid, uuid),
  public.save_approval_preset(uuid, uuid, text, text, boolean, jsonb), public.archive_approval_preset(uuid),
  public.set_preset_auto_apply(uuid, text, text, uuid), public.preset_preview(uuid) from public, anon;
grant execute on function public.submit_promotion_carry(uuid, text, boolean, integer[]), public.can_act_on_step(uuid),
  public.decide_promotion_step(uuid, uuid, text, uuid[], text, text, boolean), public.replace_review_flow(uuid, uuid),
  public.save_approval_preset(uuid, uuid, text, text, boolean, jsonb), public.archive_approval_preset(uuid),
  public.set_preset_auto_apply(uuid, text, text, uuid), public.preset_preview(uuid) to authenticated;
