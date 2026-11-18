-- v2 Phase 6.2 (M9): risk acceptance behind org_settings.features.risk_acceptance (default off).
-- From rejected / changes_requested the uploader may ask a designated risk acceptor; the acceptor accepts
-- (risk_accepted, sealed decision with reason) or declines (back to the previous status). Risk acceptance is
-- not a compliance approval: it never sets approved_at / approved_version_id and never counts as approval.

alter table public.org_members add column if not exists can_accept_risk boolean not null default false;
alter table public.promotions
  add column if not exists risk_acceptor_id uuid null references auth.users(id) on delete set null,
  add column if not exists risk_from_status public.promotion_review_status null;

alter table public.review_decisions drop constraint if exists review_decisions_decision_check;
alter table public.review_decisions add constraint review_decisions_decision_check check (decision in (
  'approve', 'conditional_approve', 'request_changes', 'reject', 'escalate', 'legal_response', 'risk_accept', 'risk_decline'));

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired', 'review_step_open', 'review_flow_replaced', 'risk_requested', 'risk_decided'));

/** Owners/admins designate who may accept risk (audited). */
create or replace function public.set_risk_acceptor(_org uuid, _user uuid, _on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if public.org_role_of(_org, _user) is null or public.org_role_of(_org, _user) not in ('owner', 'admin', 'reviewer', 'legal') then
    raise exception 'code:not_a_reviewer' using errcode = 'P0001';
  end if;
  update public.org_members set can_accept_risk = coalesce(_on, false) where org_id = _org and user_id = _user;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'risk_acceptor', 'org_members', _user::text, jsonb_build_object('org_id', _org, 'on', coalesce(_on, false)));
end $$;

create or replace function public.request_risk_acceptance(_pid uuid, _acceptor uuid, _reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not public.org_feature(p.org_id, 'risk_acceptance') then raise exception 'code:feature_off' using errcode = 'P0001'; end if;
  if not (p.owner_id = auth.uid() or public.promotion_uploader(_pid) = auth.uid()) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if p.review_status not in ('rejected', 'changes_requested') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'code:reason_required' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.org_members m where m.org_id = p.org_id and m.user_id = _acceptor and m.can_accept_risk) then
    raise exception 'code:not_risk_acceptor' using errcode = 'P0001';
  end if;
  if _acceptor = auth.uid() or _acceptor = public.promotion_uploader(_pid) then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  update public.promotions set review_status = 'reviewing_risk', risk_acceptor_id = _acceptor, risk_from_status = p.review_status, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'risk_requested', p.review_status::text, 'reviewing_risk',
    jsonb_build_object('acceptor', _acceptor, 'reason', trim(_reason)));
  perform public.notify_user(_acceptor, 'risk_requested', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title));
end $$;

create or replace function public.decide_risk(_pid uuid, _accept boolean, _reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; d public.review_decisions; _to public.promotion_review_status;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if p.review_status <> 'reviewing_risk' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if p.risk_acceptor_id is distinct from auth.uid()
     or not exists (select 1 from public.org_members m where m.org_id = p.org_id and m.user_id = auth.uid() and m.can_accept_risk) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  if public.promotion_uploader(_pid) = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'code:reason_required' using errcode = 'P0001'; end if;
  _to := case when _accept then 'risk_accepted'::public.promotion_review_status else coalesce(p.risk_from_status, 'rejected') end;
  d := public.write_decision(p, case when _accept then 'risk_accept' else 'risk_decline' end, 'risk_acceptor', _to, '{}', null, null, _reason);
  update public.promotions set review_status = _to, risk_from_status = case when _accept then risk_from_status else null end, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, case when _accept then 'risk_accepted' else 'risk_declined' end, 'reviewing_risk', _to::text,
    jsonb_build_object('decision_id', d.id));
  perform public.notify_user(public.promotion_uploader(_pid), 'risk_decided', p.current_version_id,
    jsonb_build_object('promotion_id', _pid, 'title', p.title, 'accepted', _accept));
  return d.id;
end $$;

revoke all on function public.set_risk_acceptor(uuid, uuid, boolean), public.request_risk_acceptance(uuid, uuid, text),
  public.decide_risk(uuid, boolean, text) from public, anon;
grant execute on function public.set_risk_acceptor(uuid, uuid, boolean), public.request_risk_acceptance(uuid, uuid, text),
  public.decide_risk(uuid, boolean, text) to authenticated;
