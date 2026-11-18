-- v2 Phase 3 — M5 `v2_review`: human review state machine (00_MASTER_PROMPT §4.1), immutable hash-chained
-- decisions, append-only review events, rejection reasons, legal escalation, in-app notifications and media
-- retention by policy. AI never calls these RPCs; no code path approves without a human reviewer.

-- ---------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------
create table if not exists public.rejection_reasons (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid null references public.organizations(id) on delete cascade,
  kind       text not null check (kind in ('promotion', 'claim')),
  label_ar   text not null,
  label_en   text not null,
  is_other   boolean not null default false,
  is_default boolean not null default false,
  archived   boolean not null default false,
  sort_order integer not null default 100
);
insert into public.rejection_reasons (id, org_id, kind, label_ar, label_en, is_other, is_default, sort_order)
select v.id::uuid, null, 'promotion', v.ar, v.en, v.other, true, v.ord from (values
  ('a1000000-0000-0000-0000-000000000001', 'معلومة إلزامية ناقصة', 'Missing mandatory information', false, 10),
  ('a1000000-0000-0000-0000-000000000002', 'ادعاء غير مثبت', 'Unsubstantiated claim', false, 20),
  ('a1000000-0000-0000-0000-000000000003', 'رقم أو سعر غير مطابق', 'Incorrect figure or price', false, 30),
  ('a1000000-0000-0000-0000-000000000004', 'إفصاح غير واضح أو غير بارز', 'Unclear or non-prominent disclosure', false, 40),
  ('a1000000-0000-0000-0000-000000000005', 'لغة مبالغة أو مضللة', 'Exaggerated or misleading language', false, 50),
  ('a1000000-0000-0000-0000-000000000006', 'مخالفة لسياسة داخلية', 'Internal policy breach', false, 60),
  ('a1000000-0000-0000-0000-000000000007', 'جودة الملف لا تسمح بالمراجعة', 'File quality prevents review', false, 70),
  ('a1000000-0000-0000-0000-000000000008', 'أخرى', 'Other', true, 900)
) as v(id, ar, en, other, ord)
on conflict (id) do nothing;

alter table public.promotions add column if not exists escalated_to uuid null references auth.users(id) on delete set null;

create table if not exists public.review_decisions (
  id                  uuid primary key default gen_random_uuid(),
  promotion_id        uuid not null references public.promotions(id) on delete restrict,
  submission_id       uuid not null references public.submissions(id) on delete restrict,
  decision            text not null check (decision in ('approve', 'conditional_approve', 'request_changes', 'reject', 'escalate', 'legal_response')),
  actor_id            uuid not null,
  actor_role          text not null,
  reason_ids          uuid[] not null default '{}',
  reason_other        text null,
  condition_ar        text null,
  comment             text null,
  from_status         public.promotion_review_status not null,
  to_status           public.promotion_review_status not null,
  findings_snapshot   jsonb not null,
  asset_sha256        text not null,
  rulebook_version_id uuid null,
  prev_hash           text null,
  hash                text not null,
  created_at          timestamptz not null default now()
);
create index if not exists review_decisions_promotion_idx on public.review_decisions (promotion_id, created_at);

create table if not exists public.review_events (
  id            bigint generated always as identity primary key,
  org_id        uuid null,
  promotion_id  uuid not null references public.promotions(id) on delete restrict,
  submission_id uuid null references public.submissions(id) on delete set null,
  event_type    text not null,
  actor_id      uuid null,
  from_status   text null,
  to_status     text null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists review_events_promotion_idx on public.review_events (promotion_id, created_at);
create index if not exists review_events_org_type_idx on public.review_events (org_id, event_type, created_at);

create or replace function public.forbid_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'code:immutable_record' using errcode = 'P0001';
end $$;
drop trigger if exists review_decisions_immutable on public.review_decisions;
create trigger review_decisions_immutable before update or delete on public.review_decisions
  for each row execute function public.forbid_mutation();
drop trigger if exists review_events_immutable on public.review_events;
create trigger review_events_immutable before update or delete on public.review_events
  for each row execute function public.forbid_mutation();

-- Responses to findings (append-only; written by respond_finding in M6). Created here because the review
-- RPCs below read them.
create table if not exists public.finding_responses (
  id            uuid primary key default gen_random_uuid(),
  finding_id    uuid not null references public.findings(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  actor_id      uuid not null references auth.users(id) on delete cascade,
  actor_role    text not null check (actor_role in ('uploader', 'reviewer')),
  action        text not null check (action in ('agree_will_action', 'dispute', 'reply', 'agree_please_action', 'not_required', 'dismiss')),
  comment       text null check (char_length(comment) <= 2000),
  created_at    timestamptz not null default now(),
  check (action not in ('dispute', 'not_required', 'dismiss') or length(trim(coalesce(comment, ''))) > 0),
  check ((actor_role = 'uploader') = (action in ('agree_will_action', 'dispute', 'reply')) or action = 'reply')
);
create index if not exists finding_responses_finding_idx on public.finding_responses (finding_id, created_at);
drop trigger if exists finding_responses_immutable on public.finding_responses;
create trigger finding_responses_immutable before update or delete on public.finding_responses
  for each row execute function public.forbid_mutation();

-- Notification kinds for the review workflow (superset of the existing list).
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention'));
alter table public.notifications add column if not exists emailed_at timestamptz null;

-- ---------------------------------------------------------------------------------------------
-- 2. Read access: legal members read their organisation's promotions (to answer escalations)
-- ---------------------------------------------------------------------------------------------
create or replace function public.can_read_submission(_sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.submissions s
    where s.id = _sid and (
      s.is_demo or s.user_id = auth.uid()
      or (s.org_id is not null and public.is_org_member(s.org_id, array['owner', 'admin', 'reviewer', 'legal']::public.org_role[]))
    )
  )
$$;
create or replace function public.can_read_promotion(_pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.promotions p
    where p.id = _pid
      and (p.is_demo
           or p.owner_id = auth.uid()
           or (p.org_id is not null
               and public.is_org_member(p.org_id, array['owner', 'admin', 'reviewer', 'legal']::public.org_role[])))
  )
$$;
drop policy if exists "org read submissions" on public.submissions;
create policy "org read submissions" on public.submissions for select to authenticated
  using (org_id is not null and public.is_org_member(org_id, array['owner', 'admin', 'reviewer', 'legal']::public.org_role[]));

alter table public.rejection_reasons enable row level security;
alter table public.review_decisions enable row level security;
alter table public.review_events enable row level security;
alter table public.finding_responses enable row level security;
grant select on public.rejection_reasons, public.review_decisions, public.review_events, public.finding_responses to authenticated;
grant all on public.rejection_reasons, public.review_decisions, public.review_events, public.finding_responses to service_role;
drop policy if exists reasons_read on public.rejection_reasons;
create policy reasons_read on public.rejection_reasons for select to authenticated
  using (org_id is null or public.is_org_member(org_id));
drop policy if exists decisions_read on public.review_decisions;
create policy decisions_read on public.review_decisions for select to authenticated using (public.can_read_promotion(promotion_id));
drop policy if exists events_read on public.review_events;
create policy events_read on public.review_events for select to authenticated using (public.can_read_promotion(promotion_id));
drop policy if exists responses_read on public.finding_responses;
create policy responses_read on public.finding_responses for select to authenticated using (public.can_read_submission(submission_id));

-- ---------------------------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------------------------
create or replace function public.decision_hash(_prev text, _payload jsonb)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(coalesce(_prev, '') || '|' || _payload::text, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function public.decision_payload(d public.review_decisions)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'promotion_id', d.promotion_id, 'submission_id', d.submission_id, 'decision', d.decision, 'actor_id', d.actor_id,
    'actor_role', d.actor_role, 'reason_ids', to_jsonb(d.reason_ids), 'reason_other', d.reason_other, 'condition_ar', d.condition_ar,
    'comment', d.comment, 'from_status', d.from_status, 'to_status', d.to_status, 'asset_sha256', d.asset_sha256,
    'rulebook_version_id', d.rulebook_version_id, 'findings_snapshot', d.findings_snapshot, 'created_at', to_char(d.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
$$;

/** {valid, broken_at}: recomputes the decision chain of a promotion. */
create or replace function public.verify_decision_chain(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare d public.review_decisions; _prev text := null;
begin
  if not public.can_read_promotion(_pid) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  for d in select * from public.review_decisions where promotion_id = _pid order by created_at, id loop
    if d.prev_hash is distinct from _prev or d.hash <> public.decision_hash(_prev, public.decision_payload(d)) then
      return jsonb_build_object('valid', false, 'broken_at', d.id);
    end if;
    _prev := d.hash;
  end loop;
  return jsonb_build_object('valid', true, 'broken_at', null);
end $$;

create or replace function public.promotion_uploader(_pid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.user_id from public.promotions p join public.submissions s on s.id = p.current_version_id where p.id = _pid
$$;

create or replace function public.latest_run_id(_sid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.analysis_runs where submission_id = _sid order by started_at desc limit 1
$$;

/** Findings of the latest run of a version, with their latest response, for decisions and guards. */
create or replace function public.findings_snapshot(_sid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'finding_id', f.id, 'rule_code', f.rule_code, 'finding_type', f.finding_type, 'status', f.status,
    'last_response', (select jsonb_build_object('action', r.action, 'actor_role', r.actor_role)
                      from public.finding_responses r where r.finding_id = f.id order by r.created_at desc limit 1))
    order by f.rule_code, f.id), '[]'::jsonb)
  from public.findings f where f.run_id = public.latest_run_id(_sid)
$$;

create or replace function public.log_review_event(_pid uuid, _sid uuid, _type text, _from text, _to text, _payload jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.review_events (org_id, promotion_id, submission_id, event_type, actor_id, from_status, to_status, payload)
  select p.org_id, _pid, _sid, _type, auth.uid(), _from, _to, coalesce(_payload, '{}'::jsonb) from public.promotions p where p.id = _pid
$$;

/** In-app notification to org members with the given roles (excluding the actor). */
create or replace function public.notify_org(_org uuid, _roles public.org_role[], _kind text, _sid uuid, _payload jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, submission_id, payload)
  select m.user_id, _kind, _sid, _payload from public.org_members m
  where m.org_id = _org and m.role = any(_roles) and m.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
$$;
create or replace function public.notify_user(_user uuid, _kind text, _sid uuid, _payload jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, submission_id, payload)
  select _user, _kind, _sid, _payload where _user is not null and _user <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
$$;

revoke all on function public.decision_hash(text, jsonb), public.decision_payload(public.review_decisions), public.promotion_uploader(uuid),
  public.latest_run_id(uuid), public.findings_snapshot(uuid), public.log_review_event(uuid, uuid, text, text, text, jsonb),
  public.notify_org(uuid, public.org_role[], text, uuid, jsonb), public.notify_user(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.decision_hash(text, jsonb), public.decision_payload(public.review_decisions), public.findings_snapshot(uuid),
  public.log_review_event(uuid, uuid, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. Preflights (UI) — same checks as the actions, no writes. Return {ok, reasons[]} with code keys.
-- ---------------------------------------------------------------------------------------------
create or replace function public.can_submit(_pid uuid, _note text default null, _ack_failed boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p public.promotions; s public.submissions; _reasons text[] := '{}'; _role public.org_role; _settings public.org_settings;
  _last_decided uuid; _open int;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('not_found')); end if;
  if p.org_id is null then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('personal_promotion')); end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if not (p.owner_id = auth.uid() or _role in ('owner', 'admin', 'creator')) then _reasons := array_append(_reasons, ('forbidden')::text); end if;
  if p.review_status not in ('draft', 'changes_requested', 'rejected', 'conditionally_approved') then _reasons := array_append(_reasons, ('invalid_status')::text); end if;
  select * into s from public.submissions where id = p.current_version_id;
  if s.id is null then _reasons := array_append(_reasons, ('no_version')::text);
  elsif s.status = 'failed' and not _ack_failed then _reasons := array_append(_reasons, ('analysis_failed')::text);
  elsif s.status not in ('done', 'failed') then _reasons := array_append(_reasons, ('analysis_not_done')::text);
  end if;
  select * into _settings from public.org_settings where org_id = p.org_id;
  if s.id is not null and coalesce(_settings.require_uploader_responses, true) then
    select count(*) into _open from public.findings f
    where f.run_id = public.latest_run_id(s.id) and f.status not in ('resolved')
      and not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'uploader');
    if _open > 0 then _reasons := array_append(_reasons, (('missing_uploader_responses:' || _open))::text); end if;
  end if;
  select submission_id into _last_decided from public.review_decisions
  where promotion_id = _pid and decision in ('approve', 'conditional_approve', 'request_changes', 'reject') order by created_at desc limit 1;
  if _last_decided is not null and _last_decided = p.current_version_id then
    if p.review_status = 'changes_requested' then
      if coalesce(trim(_note), '') = '' then _reasons := array_append(_reasons, ('note_required_same_version')::text); end if;
    elsif p.review_status in ('rejected', 'conditionally_approved') then
      _reasons := array_append(_reasons, ('new_version_required')::text);
    end if;
  end if;
  return jsonb_build_object('ok', cardinality(_reasons) = 0, 'reasons', to_jsonb(_reasons));
end $$;

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

-- ---------------------------------------------------------------------------------------------
-- 5. Transitions
-- ---------------------------------------------------------------------------------------------
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

create or replace function public.open_review(_pid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if _role is null or _role not in ('owner', 'admin', 'reviewer') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if p.review_status <> 'pending_review' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if public.promotion_uploader(_pid) = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  update public.promotions set review_status = 'in_review', assigned_reviewer_id = coalesce(assigned_reviewer_id, auth.uid()), updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'opened', 'pending_review', 'in_review', '{}'::jsonb);
end $$;

create or replace function public.assign_reviewer(_pid uuid, _user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role; _target public.org_role;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  _target := public.org_role_of(p.org_id, _user);
  if not (_role in ('owner', 'admin') or (_role = 'reviewer' and _user = auth.uid())) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _target is null or _target not in ('owner', 'admin', 'reviewer') then raise exception 'code:not_a_reviewer' using errcode = 'P0001'; end if;
  if public.promotion_uploader(_pid) = _user then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  if p.review_status not in ('pending_review', 'in_review') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  update public.promotions set assigned_reviewer_id = _user, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'assigned', p.review_status::text, p.review_status::text, jsonb_build_object('assignee', _user));
  perform public.notify_user(_user, 'review_assigned', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title));
end $$;

/** Writes one hash-chained decision row. Internal: called by the decision RPCs only. */
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
revoke all on function public.write_decision(public.promotions, text, text, public.promotion_review_status, uuid[], text, text, text) from public, anon, authenticated;

create or replace function public.decide_promotion(_pid uuid, _decision text, _reason_ids uuid[] default '{}',
  _reason_other text default null, _condition text default null, _comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _check jsonb; _to public.promotion_review_status; d public.review_decisions; _role public.org_role;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _check := public.can_decide(_pid);
  if not (_check->>'ok')::boolean then
    raise exception 'code:%', split_part(_check->'reasons'->>0, ':', 1) using errcode = 'P0001', detail = _check::text;
  end if;
  _to := case _decision when 'approve' then 'approved' when 'conditional_approve' then 'conditionally_approved'
                        when 'request_changes' then 'changes_requested' when 'reject' then 'rejected' end;
  if _to is null then raise exception 'code:invalid_decision' using errcode = 'P0001'; end if;
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
  if _decision = 'conditional_approve' and coalesce(trim(_condition), '') = '' then raise exception 'code:condition_required' using errcode = 'P0001'; end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  d := public.write_decision(p, _decision, _role::text, _to, _reason_ids, _reason_other, _condition, _comment);
  update public.promotions set
    review_status = _to,
    first_decision_at = coalesce(first_decision_at, now()),
    approved_at = case when _to in ('approved', 'conditionally_approved') then now() else approved_at end,
    approved_version_id = case when _to in ('approved', 'conditionally_approved') then current_version_id else approved_version_id end,
    updated_at = now()
  where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'decided', 'in_review', _to::text, jsonb_build_object('decision', _decision, 'decision_id', d.id));
  perform public.notify_user(public.promotion_uploader(_pid), 'review_decided', p.current_version_id,
    jsonb_build_object('promotion_id', _pid, 'title', p.title, 'decision', _decision));
  if p.owner_id is distinct from public.promotion_uploader(_pid) then
    perform public.notify_user(p.owner_id, 'review_decided', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title, 'decision', _decision));
  end if;
  return d.id;
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

create or replace function public.respond_escalation(_pid uuid, _response text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; d public.review_decisions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if p.review_status <> 'escalated' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if p.escalated_to is distinct from auth.uid() or public.org_role_of(p.org_id, auth.uid()) is distinct from 'legal' then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(_response), '') = '' then raise exception 'code:response_required' using errcode = 'P0001'; end if;
  d := public.write_decision(p, 'legal_response', 'legal', 'in_review', '{}', null, null, _response);
  update public.promotions set review_status = 'in_review', escalated_to = null, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'legal_responded', 'escalated', 'in_review', jsonb_build_object('decision_id', d.id));
  perform public.notify_user(p.assigned_reviewer_id, 'review_legal_response', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title));
  return d.id;
end $$;

create or replace function public.archive_promotion(_pid uuid, _reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not ((p.org_id is null and p.owner_id = auth.uid()) or (p.org_id is not null and public.is_org_member(p.org_id, array['owner', 'admin']::public.org_role[]))) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  if p.review_status in ('approved', 'archived', 'withdrawn') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'code:reason_required' using errcode = 'P0001'; end if;
  update public.promotions set review_status = 'archived', updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'archived', p.review_status::text, 'archived', jsonb_build_object('reason', _reason));
end $$;

revoke all on function public.can_submit(uuid, text, boolean), public.can_decide(uuid), public.submit_promotion(uuid, text, boolean),
  public.open_review(uuid), public.assign_reviewer(uuid, uuid), public.decide_promotion(uuid, text, uuid[], text, text, text),
  public.escalate_promotion(uuid, uuid, text), public.respond_escalation(uuid, text), public.archive_promotion(uuid, text),
  public.verify_decision_chain(uuid) from public, anon;
grant execute on function public.can_submit(uuid, text, boolean), public.can_decide(uuid), public.submit_promotion(uuid, text, boolean),
  public.open_review(uuid), public.assign_reviewer(uuid, uuid), public.decide_promotion(uuid, text, uuid[], text, text, text),
  public.escalate_promotion(uuid, uuid, text), public.respond_escalation(uuid, text), public.archive_promotion(uuid, text),
  public.verify_decision_chain(uuid) to authenticated;

-- Version events: created and version_added (old and new upload paths).
create or replace function public.submissions_v2_version_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.promotion_id is not null then
    insert into public.review_events (org_id, promotion_id, submission_id, event_type, actor_id, payload)
    values (new.org_id, new.promotion_id, new.id, case when new.version_no = 1 then 'created' else 'version_added' end, new.user_id,
            jsonb_build_object('version_no', new.version_no));
  end if;
  return new;
end $$;
drop trigger if exists submissions_v2_version_event on public.submissions;
create trigger submissions_v2_version_event after insert on public.submissions
  for each row execute function public.submissions_v2_version_event();

-- ---------------------------------------------------------------------------------------------
-- 6. Media retention by policy (used by cleanup-media). Never returns a version of a promotion that was
--    submitted, decided or approved, nor demo rows.
-- ---------------------------------------------------------------------------------------------
create or replace function public.media_retention_candidates(_limit int default 100)
returns table (id uuid, user_id uuid) language sql stable security definer set search_path = '' as $$
  select s.id, s.user_id
  from public.submissions s
  left join public.promotions p on p.id = s.promotion_id
  left join public.org_settings o on o.org_id = p.org_id
  where s.media_deleted_at is null and not s.is_demo
    and (s.analyzed_at is not null or s.status = 'failed')
    and (
      -- personal creators: 24 h, as before
      (p.org_id is null and coalesce(s.analyzed_at, s.created_at) < now() - interval '24 hours')
      or
      -- organisations: only versions of promotions never submitted, after media_retention.unsubmitted_hours
      (p.org_id is not null and p.submitted_at is null and p.review_status = 'draft'
        and not exists (select 1 from public.review_decisions d where d.promotion_id = p.id)
        and coalesce(s.analyzed_at, s.created_at) < now() - make_interval(hours => coalesce((o.media_retention->>'unsubmitted_hours')::int, 24)))
    )
  order by coalesce(s.analyzed_at, s.created_at)
  limit _limit
$$;
revoke all on function public.media_retention_candidates(int) from public, anon, authenticated;
grant execute on function public.media_retention_candidates(int) to service_role;
