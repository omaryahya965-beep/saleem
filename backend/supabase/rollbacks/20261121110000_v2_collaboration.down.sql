-- Rollback of 20261121110000_v2_collaboration.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
alter table public.promotions drop constraint if exists "promotions_creator_license_status_check";
alter table public.promotions drop constraint if exists "promotions_creator_license_note_check";
drop function if exists public.promotion_reader(uuid,uuid);
drop function if exists public.add_comment(uuid,uuid,text,jsonb,uuid,text,uuid[],text[]);
drop function if exists public.comment_participants(uuid);
drop function if exists public.comment_authors(uuid);
drop function if exists public.verify_creator_license(uuid,text,text);
CREATE OR REPLACE FUNCTION public.add_comment(_pid uuid, _sid uuid, _body text, _anchor jsonb DEFAULT NULL::jsonb, _parent uuid DEFAULT NULL::uuid, _kind text DEFAULT 'general'::text, _mentions uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.promotions; _role public.org_role; _id uuid; _mentions_ok uuid[];
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) or p.is_demo then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.submissions s where s.id = _sid and s.promotion_id = _pid) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if _sid <> p.current_version_id then raise exception 'code:old_version_read_only' using errcode = 'P0001'; end if;
  if coalesce(trim(_body), '') = '' then raise exception 'code:body_required' using errcode = 'P0001'; end if;
  if _kind not in ('general', 'change_request') then raise exception 'code:invalid_kind' using errcode = 'P0001'; end if;
  _role := case when p.org_id is null then null else public.org_role_of(p.org_id, auth.uid()) end;
  if _role = 'viewer' then raise exception 'code:read_only_role' using errcode = '42501'; end if;
  if _kind = 'change_request' and (_role is null or _role not in ('owner', 'admin', 'reviewer', 'compliance_lead')) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  if not public.valid_anchor(_anchor) then raise exception 'code:invalid_anchor' using errcode = 'P0001'; end if;
  if _parent is not null and not exists (select 1 from public.comments c where c.id = _parent and c.submission_id = _sid and c.parent_id is null) then
    raise exception 'code:invalid_parent' using errcode = 'P0001';
  end if;
  -- Only members of the promotion's organisation can be mentioned.
  _mentions_ok := array(select distinct m from unnest(coalesce(_mentions, '{}')) m
                        where p.org_id is not null and exists (select 1 from public.org_members om where om.org_id = p.org_id and om.user_id = m));
  insert into public.comments (promotion_id, submission_id, parent_id, author_id, body, anchor, mentions, kind)
  values (_pid, _sid, _parent, auth.uid(), trim(_body), _anchor, _mentions_ok, case when _parent is null then _kind else 'general' end)
  returning id into _id;
  insert into public.notifications (user_id, kind, submission_id, payload)
  select m, 'comment_mention', _sid, jsonb_build_object('promotion_id', _pid, 'title', p.title, 'comment_id', _id)
  from unnest(_mentions_ok) m where m <> auth.uid();
  return _id;
end $function$;
revoke all on function public.add_comment(uuid,uuid,text,jsonb,uuid,text,uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.add_comment(uuid,uuid,text,jsonb,uuid,text,uuid[]) to authenticated;
grant execute on function public.add_comment(uuid,uuid,text,jsonb,uuid,text,uuid[]) to service_role;
alter table public.comments drop constraint if exists "comments_kind_check";
alter table public.comments add constraint "comments_kind_check" CHECK ((kind = ANY (ARRAY['general'::text, 'change_request'::text, 'decision_note'::text, 'system'::text]))) not valid;
alter table public.notifications drop constraint if exists "notifications_kind_check";
alter table public.notifications add constraint "notifications_kind_check" CHECK ((kind = ANY (ARRAY['check_done'::text, 'check_failed'::text, 'share_review'::text, 'org_invite'::text, 'review_submitted'::text, 'review_assigned'::text, 'review_decided'::text, 'review_escalated'::text, 'review_legal_response'::text, 'comment_mention'::text, 'claim_review_due'::text, 'claim_expired'::text, 'review_step_open'::text, 'review_flow_replaced'::text, 'risk_requested'::text, 'risk_decided'::text, 'partner_access_requested'::text, 'rereview_due'::text, 'withdrawal_due'::text, 'conditions_submitted'::text, 'condition_returned'::text, 'partner_access_decided'::text]))) not valid;
alter table public.promotions drop constraint if exists "promotions_distribution_check";
alter table public.promotions add constraint "promotions_distribution_check" CHECK ((distribution = ANY (ARRAY['owned'::text, 'paid_media'::text, 'influencer'::text]))) not valid;
alter table public.promotions drop column if exists "creator_license_checked_by";
alter table public.promotions drop column if exists "creator_license_checked_at";
alter table public.promotions drop column if exists "creator_license_status";
alter table public.comments drop column if exists "attachment_links";
alter table public.promotions drop column if exists "creator_license_note";
commit;
