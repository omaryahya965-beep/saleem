-- Rollback of 20261118060100_v2_approval_flows.sql: drop the flow objects, restore the Phase 3 bodies.
drop function if exists public.preset_preview(uuid);
drop function if exists public.set_preset_auto_apply(uuid, text, text, uuid);
drop function if exists public.archive_approval_preset(uuid);
drop function if exists public.save_approval_preset(uuid, uuid, text, text, boolean, jsonb);
drop function if exists public.replace_review_flow(uuid, uuid);
drop function if exists public.decide_promotion_step(uuid, uuid, text, uuid[], text, text, boolean);
drop function if exists public.can_act_on_step(uuid);

create or replace function public.submit_promotion(_pid uuid, _note text default null, _ack_failed boolean default false)
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
  perform public.notify_org(p.org_id, array['owner', 'admin', 'reviewer']::public.org_role[], 'review_submitted', p.current_version_id,
    jsonb_build_object('promotion_id', _pid, 'title', p.title));
end $$;

drop function if exists public.submit_promotion_carry(uuid, text, boolean, integer[]);
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
  if public.org_role_of(p.org_id, _legal_user) is distinct from 'legal' then raise exception 'code:not_legal_member' using errcode = 'P0001'; end if;
  if coalesce(trim(_question), '') = '' then raise exception 'code:question_required' using errcode = 'P0001'; end if;
  d := public.write_decision(p, 'escalate', _role::text, 'escalated', '{}', null, null, _question);
  update public.promotions set review_status = 'escalated', escalated_to = _legal_user, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'escalated', 'in_review', 'escalated', jsonb_build_object('legal_user', _legal_user, 'decision_id', d.id));
  perform public.notify_user(_legal_user, 'review_escalated', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title));
  return d.id;
end $$;

create or replace function public.write_decision(p public.promotions, _decision text, _role text, _to public.promotion_review_status,
  _reason_ids uuid[], _reason_other text, _condition text, _comment text)
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
  d.prev_hash := _prev;
  d.hash := public.decision_hash(_prev, public.decision_payload(d));
  insert into public.review_decisions values (d.*);
  return d;
end $$;

drop function if exists public.write_decision_step(public.promotions, text, text, public.promotion_review_status, uuid[], text, text, text, uuid);
create or replace function public.decision_payload(d public.review_decisions)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'promotion_id', d.promotion_id, 'submission_id', d.submission_id, 'decision', d.decision, 'actor_id', d.actor_id,
    'actor_role', d.actor_role, 'reason_ids', to_jsonb(d.reason_ids), 'reason_other', d.reason_other, 'condition_ar', d.condition_ar,
    'comment', d.comment, 'from_status', d.from_status, 'to_status', d.to_status, 'asset_sha256', d.asset_sha256,
    'rulebook_version_id', d.rulebook_version_id, 'findings_snapshot', d.findings_snapshot, 'created_at', to_char(d.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
$$;

drop function if exists public.notify_step_open(uuid, integer);
drop function if exists public.start_review_flow(uuid, integer[], uuid);
drop function if exists public.preset_for(uuid);
drop function if exists public.flow_is_live(uuid);
drop function if exists public.current_flow_no(uuid);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired'));
alter table public.review_decisions drop column if exists step_id;
drop table if exists public.promotion_review_steps;
drop table if exists public.preset_auto_apply;
drop table if exists public.approval_preset_steps;
drop table if exists public.approval_presets;
drop function if exists public.org_feature(uuid, text);
