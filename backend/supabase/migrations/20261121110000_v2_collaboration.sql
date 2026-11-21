-- V2 completion — collaboration and Mawthooq manual verification (D189–D190).
--
-- Comments: categories (general, question, change request, reviewer feedback, legal opinion, evidence), https
-- attachment links, eligible-only mentions, reply notifications, duplicate-submit protection, and author names/roles
-- through a definer function (externals see roles only). Fixes a leak: mentions used to accept ANY organisation member,
-- so a legal advisor outside the case or an external account received a notification carrying the advertisement title.
-- A mention never grants access: only people who can already read the advertisement can be mentioned.
--
-- Mawthooq: no official automated licence lookup is used (the public site is behind anti-bot challenges and must not
-- be bypassed). A decider records a manual check of the creator licence (verified / invalid / not applicable) with a
-- note; it is an audit event, never an approval. Distribution gains «agency» (an agency producing for the brand's own
-- channels — not creator advertising, so MAW-03/04 do not apply automatically).

-- Who can read an advertisement, for an arbitrary user (mirrors can_read_promotion + legal_case).
create or replace function public.promotion_reader(_pid uuid, _user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.promotions p
    where p.id = _pid and _user is not null and (
      p.owner_id = _user
      or (p.org_id is not null and exists (select 1 from public.org_members m where m.org_id = p.org_id and m.user_id = _user
            and m.role in ('owner', 'admin', 'reviewer', 'compliance_lead', 'viewer')))
      or (p.org_id is not null and exists (select 1 from public.org_members m where m.org_id = p.org_id and m.user_id = _user and m.role = 'legal')
          and (p.escalated_to = _user or exists (select 1 from public.review_decisions d where d.promotion_id = p.id and d.actor_id = _user)))))
$$;
revoke all on function public.promotion_reader(uuid, uuid) from public, anon, authenticated;

-- Mention targets: readers of the advertisement who may see its comments; never offered to external callers.
create or replace function public.comment_participants(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _me public.org_role; _hide boolean;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or p.org_id is null or not public.can_read_promotion(_pid) then return '[]'::jsonb; end if;
  _me := public.org_role_of(p.org_id, auth.uid());
  if _me is null or _me in ('external_uploader', 'external_reviewer') then return '[]'::jsonb; end if;
  _hide := coalesce((select hide_comments_from_external from public.org_settings where org_id = p.org_id), false);
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', coalesce(m.display_name, m.email), 'email', m.email, 'role', m.role)
                                    order by m.role, coalesce(m.display_name, m.email))
    from public.org_members m
    where m.org_id = p.org_id and m.user_id <> auth.uid() and public.promotion_reader(_pid, m.user_id)
      and (m.role not in ('external_uploader', 'external_reviewer') or not _hide)), '[]'::jsonb);
end $$;

-- Names and roles of the people who wrote the comments the caller can read (externals: role only).
create or replace function public.comment_authors(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _me public.org_role; _external boolean;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) then return '{}'::jsonb; end if;
  _me := case when p.org_id is null then null else public.org_role_of(p.org_id, auth.uid()) end;
  _external := _me in ('external_uploader', 'external_reviewer');
  return coalesce((select jsonb_object_agg(a.author_id, jsonb_build_object(
      'name', case when _external and a.author_id <> auth.uid() then null else coalesce(m.display_name, m.email) end,
      'role', coalesce(m.role::text, case when a.author_id = p.owner_id then 'owner_of_ad' end)))
    from (select distinct author_id from public.comments where promotion_id = _pid) a
    left join public.org_members m on m.org_id = p.org_id and m.user_id = a.author_id), '{}'::jsonb);
end $$;
revoke all on function public.comment_participants(uuid), public.comment_authors(uuid) from public, anon;
grant execute on function public.comment_participants(uuid), public.comment_authors(uuid) to authenticated;

alter table public.comments drop constraint if exists comments_kind_check;
alter table public.comments add constraint comments_kind_check check (kind in (
  'general', 'change_request', 'decision_note', 'system', 'question', 'reviewer_feedback', 'legal_opinion', 'evidence'));
alter table public.comments add column if not exists attachment_links text[] not null default '{}';

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired', 'review_step_open', 'review_flow_replaced', 'risk_requested', 'risk_decided',
  'partner_access_requested', 'rereview_due', 'withdrawal_due',
  'conditions_submitted', 'condition_returned', 'partner_access_decided', 'comment_reply', 'correction_ready'));

drop function if exists public.add_comment(uuid, uuid, text, jsonb, uuid, text, uuid[]);
create or replace function public.add_comment(_pid uuid, _sid uuid, _body text, _anchor jsonb default null, _parent uuid default null,
  _kind text default 'general', _mentions uuid[] default '{}', _links text[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role; _id uuid; _mentions_ok uuid[]; _parent_author uuid; _dup uuid;
  _decider boolean;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) or p.is_demo then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.submissions s where s.id = _sid and s.promotion_id = _pid) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if _sid <> p.current_version_id then raise exception 'code:old_version_read_only' using errcode = 'P0001'; end if;
  if coalesce(trim(_body), '') = '' then raise exception 'code:body_required' using errcode = 'P0001'; end if;
  if _kind not in ('general', 'question', 'change_request', 'reviewer_feedback', 'legal_opinion', 'evidence') then
    raise exception 'code:invalid_kind' using errcode = 'P0001';
  end if;
  _role := case when p.org_id is null then null else public.org_role_of(p.org_id, auth.uid()) end;
  if _role = 'viewer' then raise exception 'code:read_only_role' using errcode = '42501'; end if;
  _decider := coalesce(_role in ('owner', 'admin', 'reviewer', 'compliance_lead'), false) and public.promotion_uploader(_pid) is distinct from auth.uid();
  if _kind in ('change_request', 'reviewer_feedback') and not _decider then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _kind = 'legal_opinion' and not (_role = 'legal' and public.legal_case(_pid)) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not public.valid_anchor(_anchor) then raise exception 'code:invalid_anchor' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(coalesce(_links, '{}')) l where l !~* '^https://') or cardinality(coalesce(_links, '{}')) > 10 then
    raise exception 'code:invalid_link' using errcode = 'P0001';
  end if;
  if _parent is not null then
    select author_id into _parent_author from public.comments c where c.id = _parent and c.submission_id = _sid and c.parent_id is null and c.deleted_at is null;
    if _parent_author is null then raise exception 'code:invalid_parent' using errcode = 'P0001'; end if;
  end if;
  -- Double submit: the same author posting the same text in the same place within 30 s gets the existing comment.
  select id into _dup from public.comments c where c.author_id = auth.uid() and c.submission_id = _sid and c.parent_id is not distinct from _parent
    and c.body = trim(_body) and c.created_at > now() - interval '30 seconds' and c.deleted_at is null limit 1;
  if _dup is not null then return _dup; end if;
  -- Mentions: only people who can already read this advertisement (a mention never grants access).
  _mentions_ok := array(select distinct m from unnest(coalesce(_mentions, '{}')) m
                        where p.org_id is not null and m <> auth.uid() and public.promotion_reader(_pid, m)
                          and not (public.org_role_of(p.org_id, m) in ('external_uploader', 'external_reviewer')
                                   and coalesce((select hide_comments_from_external from public.org_settings where org_id = p.org_id), false)));
  insert into public.comments (promotion_id, submission_id, parent_id, author_id, body, anchor, mentions, kind, attachment_links)
  values (_pid, _sid, _parent, auth.uid(), trim(_body), _anchor, _mentions_ok, case when _parent is null then _kind else 'general' end,
          coalesce(_links, '{}'))
  returning id into _id;
  insert into public.notifications (user_id, kind, submission_id, payload)
  select m, 'comment_mention', _sid, jsonb_build_object('promotion_id', _pid, 'title', p.title, 'comment_id', _id,
    'version_no', (select version_no from public.submissions where id = _sid))
  from unnest(_mentions_ok) m;
  if _parent_author is not null and _parent_author <> auth.uid() and not (_parent_author = any(_mentions_ok))
     and public.promotion_reader(_pid, _parent_author) then
    perform public.notify_user(_parent_author, 'comment_reply', _sid, jsonb_build_object('promotion_id', _pid, 'title', p.title, 'comment_id', _id,
      'version_no', (select version_no from public.submissions where id = _sid)));
  end if;
  return _id;
end $$;
revoke all on function public.add_comment(uuid, uuid, text, jsonb, uuid, text, uuid[], text[]) from public, anon;
grant execute on function public.add_comment(uuid, uuid, text, jsonb, uuid, text, uuid[], text[]) to authenticated;

-- ---- Mawthooq manual verification -------------------------------------------------------------------------
alter table public.promotions drop constraint if exists promotions_distribution_check;
alter table public.promotions add constraint promotions_distribution_check check (distribution in ('owned', 'paid_media', 'influencer', 'agency'));
alter table public.promotions
  add column if not exists creator_license_status text not null default 'unverified'
    check (creator_license_status in ('unverified', 'verified', 'invalid', 'not_applicable')),
  add column if not exists creator_license_checked_by uuid null,
  add column if not exists creator_license_checked_at timestamptz null,
  add column if not exists creator_license_note text null check (char_length(creator_license_note) <= 2000);

create or replace function public.verify_creator_license(_pid uuid, _status text, _note text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null or not public.can_read_promotion(_pid) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if not coalesce(_role in ('owner', 'admin', 'reviewer', 'compliance_lead'), false) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _role = 'reviewer' and p.assigned_reviewer_id is distinct from auth.uid() then raise exception 'code:not_assigned' using errcode = '42501'; end if;
  if public.promotion_uploader(_pid) = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  if _status not in ('verified', 'invalid', 'not_applicable', 'unverified') then raise exception 'code:invalid_action' using errcode = 'P0001'; end if;
  if coalesce(trim(_note), '') = '' then raise exception 'code:note_required' using errcode = 'P0001'; end if;
  if _status = 'verified' and coalesce(trim(p.creator_license_no), '') = '' then raise exception 'code:license_missing' using errcode = 'P0001'; end if;
  if p.creator_license_status = _status and p.creator_license_note is not distinct from trim(_note) then return; end if;
  update public.promotions set creator_license_status = _status, creator_license_checked_by = auth.uid(), creator_license_checked_at = now(),
    creator_license_note = trim(_note), updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'license_checked', p.review_status::text, p.review_status::text,
    jsonb_build_object('status', _status, 'note', trim(_note), 'license_no', p.creator_license_no, 'method', 'manual'));
end $$;
revoke all on function public.verify_creator_license(uuid, text, text) from public, anon;
grant execute on function public.verify_creator_license(uuid, text, text) to authenticated;
