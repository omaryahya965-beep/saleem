-- v2 Phase 3 — M6 `v2_finding_responses`: structured responses to findings (05_UX_SPEC §6.4).
-- Responses are append-only rows in finding_responses (created in M5); finding_feedback keeps working for
-- the existing dispute UI (D104). A reviewer response always overrides an uploader response.

/** Status a response leaves the finding in (null = unchanged, e.g. a reply). */
create or replace function public.response_status(_action text)
returns text language sql immutable set search_path = '' as $$
  select case _action
    when 'agree_will_action' then 'actioned' when 'dispute' then 'disputed'
    when 'agree_please_action' then 'actioned' when 'not_required' then 'not_required' when 'dismiss' then 'dismissed'
  end
$$;

create or replace function public.respond_finding(_finding uuid, _action text, _comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  f public.findings; s public.submissions; p public.promotions; _role public.org_role; _actor text; _id uuid;
  _uploader_actions constant text[] := array['agree_will_action', 'dispute'];
  _reviewer_actions constant text[] := array['agree_please_action', 'not_required', 'dismiss'];
begin
  select * into f from public.findings where id = _finding;
  if f.id is null or not public.can_read_submission(f.submission_id) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select * into s from public.submissions where id = f.submission_id;
  select * into p from public.promotions where id = s.promotion_id;
  if p.id is null or s.is_demo then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if f.run_id <> public.latest_run_id(s.id) then raise exception 'code:finding_superseded' using errcode = 'P0001'; end if;
  _role := case when p.org_id is null then null else public.org_role_of(p.org_id, auth.uid()) end;

  if _action = any(_uploader_actions) or (_action = 'reply' and (p.owner_id = auth.uid() or s.user_id = auth.uid() or _role in ('creator'))) then
    -- Uploader side: the promotion owner, the uploader of the version, or an org uploader role.
    if not (p.owner_id = auth.uid() or s.user_id = auth.uid() or _role in ('owner', 'admin', 'creator')) then
      raise exception 'code:forbidden' using errcode = '42501';
    end if;
    if p.review_status not in ('draft', 'changes_requested', 'rejected', 'conditionally_approved', 'pending_review') then
      raise exception 'code:invalid_status' using errcode = 'P0001';
    end if;
    _actor := 'uploader';
  elsif _action = any(_reviewer_actions) or _action = 'reply' then
    -- Reviewer side: org reviewers, never on a version they uploaded (separation of duties).
    if _role is null or _role not in ('owner', 'admin', 'reviewer') then raise exception 'code:forbidden' using errcode = '42501'; end if;
    if s.user_id = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
    if p.review_status not in ('in_review', 'escalated') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
    _actor := 'reviewer';
  else
    raise exception 'code:invalid_action' using errcode = 'P0001';
  end if;
  if _action in ('dispute', 'not_required', 'dismiss') and coalesce(trim(_comment), '') = '' then
    raise exception 'code:comment_required' using errcode = 'P0001';
  end if;

  insert into public.finding_responses (finding_id, submission_id, actor_id, actor_role, action, comment)
  values (f.id, f.submission_id, auth.uid(), _actor, _action, nullif(trim(coalesce(_comment, '')), ''))
  returning id into _id;

  -- Status sync: a reviewer response always overrides an uploader response.
  if public.response_status(_action) is not null and (
       _actor = 'reviewer'
       or not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'reviewer')) then
    update public.findings set status = public.response_status(_action) where id = f.id;
  end if;
  return _id;
end $$;
revoke all on function public.respond_finding(uuid, text, text) from public, anon;
grant execute on function public.respond_finding(uuid, text, text) to authenticated;
