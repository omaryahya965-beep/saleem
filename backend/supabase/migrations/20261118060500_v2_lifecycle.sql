-- v2 Phase 6.5 (M9): evergreen re-review and lifecycle dates behind org_settings.features.lifecycle (default off).
-- Approving an evergreen promotion needs a future next_review_at; a daily job moves due items to due_for_rereview
-- (back to reviewers) and reminds; reviewers confirm or request changes (sealed decisions). Lifecycle dates
-- (published, taken down, withdrawn with reason) and «طلب سحب»: the date the regulator's notice was received sets
-- withdrawal_due_at one Saudi business day later (Sun–Thu, plus the org's holiday list). Shown as a deadline only.

alter table public.promotions
  add column if not exists evergreen           boolean not null default false,
  add column if not exists next_review_at      date null,
  add column if not exists published_at        timestamptz null,
  add column if not exists taken_down_at       timestamptz null,
  add column if not exists withdrawn_at        timestamptz null,
  add column if not exists withdrawal_reason   text null,
  add column if not exists regulator_notice_at timestamptz null,
  add column if not exists withdrawal_due_at   timestamptz null;
alter table public.org_settings add column if not exists business_holidays date[] not null default '{}';

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired', 'review_step_open', 'review_flow_replaced', 'risk_requested', 'risk_decided',
  'partner_access_requested', 'rereview_due', 'withdrawal_due'));

/** One Saudi business day after `_at` (Sun–Thu working week; holidays skipped). Same time of day, Asia/Riyadh. */
create or replace function public.saudi_business_day_after(_at timestamptz, _holidays date[] default '{}')
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare _local timestamp := _at at time zone 'Asia/Riyadh'; _d date;
begin
  _d := _local::date;
  loop
    _d := _d + 1;
    exit when extract(dow from _d) between 0 and 4 and not (_d = any(coalesce(_holidays, '{}')));
  end loop;
  return (_d + _local::time) at time zone 'Asia/Riyadh';
end $$;

-- An evergreen promotion cannot become approved without a future re-review date (whatever path approves it).
create or replace function public.promotions_evergreen_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.review_status = 'approved' and old.review_status is distinct from 'approved' and new.evergreen and new.org_id is not null
     and public.org_feature(new.org_id, 'lifecycle') and (new.next_review_at is null or new.next_review_at <= current_date) then
    raise exception 'code:next_review_required' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists promotions_evergreen_guard on public.promotions;
create trigger promotions_evergreen_guard before update of review_status on public.promotions
  for each row execute function public.promotions_evergreen_guard();

create or replace function public.lifecycle_can_edit(p public.promotions)
returns boolean language sql stable security definer set search_path = '' as $$
  select p.org_id is not null and public.org_feature(p.org_id, 'lifecycle')
     and (p.owner_id = auth.uid() or public.is_org_member(p.org_id, array['owner', 'admin', 'reviewer', 'creator']::public.org_role[]))
$$;
revoke all on function public.lifecycle_can_edit(public.promotions) from public, anon, authenticated;

/** Evergreen flag and re-review date (owner, creators, reviewers, admins). */
create or replace function public.set_evergreen(_pid uuid, _evergreen boolean, _next_review date)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or not public.lifecycle_can_edit(p) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if coalesce(_evergreen, false) and _next_review is not null and _next_review <= current_date then raise exception 'code:next_review_required' using errcode = 'P0001'; end if;
  update public.promotions set evergreen = coalesce(_evergreen, false), next_review_at = _next_review, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'lifecycle_evergreen', p.review_status::text, p.review_status::text,
    jsonb_build_object('evergreen', coalesce(_evergreen, false), 'next_review_at', _next_review));
end $$;

/** Published / taken-down dates (no status change). */
create or replace function public.record_lifecycle(_pid uuid, _event text, _at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
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
end $$;

/** «طلب سحب»: records when the regulator's notice was received and sets the deadline (owners/admins). */
create or replace function public.request_withdrawal(_pid uuid, _notice_at timestamptz, _reason text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _due timestamptz;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null or not public.org_feature(p.org_id, 'lifecycle')
     or not public.is_org_member(p.org_id, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'code:reason_required' using errcode = 'P0001'; end if;
  if _notice_at is null or _notice_at > now() + interval '5 minutes' then raise exception 'code:invalid_date' using errcode = 'P0001'; end if;
  _due := public.saudi_business_day_after(_notice_at, (select business_holidays from public.org_settings where org_id = p.org_id));
  update public.promotions set regulator_notice_at = _notice_at, withdrawal_due_at = _due, withdrawal_reason = trim(_reason), updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'withdrawal_requested', p.review_status::text, p.review_status::text,
    jsonb_build_object('notice_at', _notice_at, 'due_at', _due, 'reason', trim(_reason)));
  perform public.notify_user(p.owner_id, 'withdrawal_due', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title, 'due_at', _due));
  return _due;
end $$;

/** Marks the promotion withdrawn (owners/admins), with the reason. */
create or replace function public.mark_withdrawn(_pid uuid, _reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null or not public.org_feature(p.org_id, 'lifecycle')
     or not public.is_org_member(p.org_id, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if p.review_status not in ('approved', 'conditionally_approved', 'risk_accepted', 'due_for_rereview') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if coalesce(nullif(trim(coalesce(_reason, '')), ''), p.withdrawal_reason, '') = '' then raise exception 'code:reason_required' using errcode = 'P0001'; end if;
  update public.promotions set review_status = 'withdrawn', withdrawn_at = now(), withdrawal_reason = coalesce(nullif(trim(_reason), ''), withdrawal_reason), updated_at = now()
  where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'withdrawn', p.review_status::text, 'withdrawn', jsonb_build_object('reason', coalesce(nullif(trim(_reason), ''), p.withdrawal_reason)));
end $$;

/** Reviewer re-review of a due evergreen promotion: still valid (approve with a new date) or request changes. Sealed. */
create or replace function public.complete_rereview(_pid uuid, _still_valid boolean, _next_review date, _comment text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role; d public.review_decisions; _to public.promotion_review_status;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if _role is null or _role not in ('owner', 'admin', 'reviewer') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if p.review_status <> 'due_for_rereview' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if public.promotion_uploader(_pid) = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  if _still_valid and (_next_review is null or _next_review <= current_date) then raise exception 'code:next_review_required' using errcode = 'P0001'; end if;
  if not _still_valid and coalesce(trim(_comment), '') = '' then raise exception 'code:reason_required' using errcode = 'P0001'; end if;
  _to := case when _still_valid then 'approved'::public.promotion_review_status else 'changes_requested' end;
  if _still_valid then update public.promotions set next_review_at = _next_review where id = _pid; end if;
  d := public.write_decision(p, case when _still_valid then 'approve' else 'request_changes' end, _role::text, _to, '{}',
    case when _still_valid then null else _comment end, null, _comment);
  update public.promotions set review_status = _to, approved_at = case when _still_valid then now() else approved_at end, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'rereviewed', 'due_for_rereview', _to::text,
    jsonb_build_object('decision_id', d.id, 'still_valid', _still_valid, 'next_review_at', _next_review));
  perform public.notify_user(p.owner_id, 'review_decided', p.current_version_id,
    jsonb_build_object('promotion_id', _pid, 'title', p.title, 'decision', case when _still_valid then 'approve' else 'request_changes' end));
  return d.id;
end $$;

/** Daily (pg_cron): due evergreen promotions go back to reviewers; withdrawal deadlines within a day are reminded. */
create or replace function public.lifecycle_daily()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; _moved int := 0; _reminded int := 0;
begin
  for r in select p.* from public.promotions p
           where p.review_status = 'approved' and p.evergreen and p.next_review_at <= current_date and p.org_id is not null
             and public.org_feature(p.org_id, 'lifecycle') for update loop
    update public.promotions set review_status = 'due_for_rereview', updated_at = now() where id = r.id;
    insert into public.review_events (org_id, promotion_id, submission_id, event_type, actor_id, from_status, to_status, payload)
    values (r.org_id, r.id, r.current_version_id, 'rereview_due', null, 'approved', 'due_for_rereview', jsonb_build_object('next_review_at', r.next_review_at));
    insert into public.notifications (user_id, kind, submission_id, payload)
    select m.user_id, 'rereview_due', r.current_version_id, jsonb_build_object('promotion_id', r.id, 'title', r.title)
    from public.org_members m where m.org_id = r.org_id and (m.role in ('owner', 'admin', 'reviewer') or m.user_id = r.owner_id);
    _moved := _moved + 1;
  end loop;
  for r in select p.* from public.promotions p
           where p.withdrawal_due_at is not null and p.withdrawn_at is null and p.withdrawal_due_at <= now() + interval '1 day'
             and p.org_id is not null and public.org_feature(p.org_id, 'lifecycle') loop
    insert into public.notifications (user_id, kind, submission_id, payload)
    select m.user_id, 'withdrawal_due', r.current_version_id, jsonb_build_object('promotion_id', r.id, 'title', r.title, 'due_at', r.withdrawal_due_at)
    from public.org_members m where m.org_id = r.org_id and (m.role in ('owner', 'admin') or m.user_id = r.owner_id);
    _reminded := _reminded + 1;
  end loop;
  return jsonb_build_object('moved', _moved, 'reminded', _reminded);
end $$;

revoke all on function public.saudi_business_day_after(timestamptz, date[]) from public;
grant execute on function public.saudi_business_day_after(timestamptz, date[]) to authenticated, service_role;
revoke all on function public.set_evergreen(uuid, boolean, date), public.record_lifecycle(uuid, text, timestamptz),
  public.request_withdrawal(uuid, timestamptz, text), public.mark_withdrawn(uuid, text), public.complete_rereview(uuid, boolean, date, text) from public, anon;
grant execute on function public.set_evergreen(uuid, boolean, date), public.record_lifecycle(uuid, text, timestamptz),
  public.request_withdrawal(uuid, timestamptz, text), public.mark_withdrawn(uuid, text), public.complete_rereview(uuid, boolean, date, text) to authenticated;
revoke all on function public.lifecycle_daily() from public, anon, authenticated;
grant execute on function public.lifecycle_daily() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'saleem-lifecycle';
select cron.schedule('saleem-lifecycle', '15 6 * * *', 'select public.lifecycle_daily()');
