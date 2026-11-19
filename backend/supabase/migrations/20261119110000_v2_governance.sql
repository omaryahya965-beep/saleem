-- Governance decisions (2026-11-19, D169). Tested by backend/tests/rbac.test.ts on a fresh organisation.
-- 1. Claims: a marketer (or any writer) proposes; only a different owner/admin/lead/reviewer approves (review_claim,
--    unchanged). Editing or submitting someone else's claim needs owner/admin/compliance_lead. The author may withdraw
--    (archive) their own claim before approval. archive_claim was NULL-unsafe for non-members (fixed).
-- 2. Reviewers never assign: assign_reviewer is owner/admin/compliance_lead only; open_review no longer makes the
--    opener the assignee unless they may assign; a reviewer may open and decide only cases assigned to them.
-- 3. Legal is case-scoped: a legal advisor reads a promotion only while it is escalated to them or after they
--    answered it (legal_case), plus that case's versions, media, linked claims (and their evidence files), product
--    and the disclaimers that apply to it — never the organisation's libraries or other advertisements.

create or replace function public.legal_case(_pid uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.promotions p
    where p.id = _pid and p.org_id is not null
      and public.is_org_member(p.org_id, array['legal']::public.org_role[])
      and (p.escalated_to = auth.uid()
           or exists (select 1 from public.review_decisions d where d.promotion_id = p.id and d.actor_id = auth.uid()))
  )
$fn$;

create or replace function public.legal_can_read_claim(_cid uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.promotion_claims pc where pc.claim_id = _cid and public.legal_case(pc.promotion_id))
$fn$;

create or replace function public.legal_can_read_product(_prid uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.promotions p where p.product_id = _prid and public.legal_case(p.id))
$fn$;

-- Disclaimers have no link table: the ones that apply to a case are the organisation's disclaimers whose scope
-- (product type, channels, communication type; empty = any) matches the case.
create or replace function public.legal_can_read_disclaimer(_did uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.disclaimers d
    join public.promotions p on p.org_id = d.org_id
    left join public.products pr on pr.id = p.product_id
    where d.id = _did and public.legal_case(p.id)
      and (cardinality(d.product_types) = 0 or pr.product_type = any (d.product_types))
      and (cardinality(d.channels) = 0 or d.channels && p.channels)
      and (cardinality(d.communication_types) = 0 or p.communication_type::text = any (d.communication_types))
  )
$fn$;

revoke all on function public.legal_case(uuid), public.legal_can_read_claim(uuid), public.legal_can_read_product(uuid),
  public.legal_can_read_disclaimer(uuid) from public, anon;
grant execute on function public.legal_case(uuid), public.legal_can_read_claim(uuid), public.legal_can_read_product(uuid),
  public.legal_can_read_disclaimer(uuid) to authenticated;

-- can_read_promotion
CREATE OR REPLACE FUNCTION public.can_read_promotion(_pid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $fn$
  select exists (
    select 1 from public.promotions p
    where p.id = _pid
      and (p.is_demo
           or p.owner_id = auth.uid()
           or (p.org_id is not null
               and public.is_org_member(p.org_id, array['owner', 'admin', 'reviewer', 'compliance_lead', 'viewer']::public.org_role[]))
               or public.legal_case(p.id))
  )
$fn$;

-- can_read_submission
CREATE OR REPLACE FUNCTION public.can_read_submission(_sid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  select exists (
    select 1 from public.submissions s
    where s.id = _sid and (
      s.is_demo or s.user_id = auth.uid()
      or (s.org_id is not null and public.is_org_member(s.org_id, array['owner', 'admin', 'reviewer', 'compliance_lead', 'viewer']::public.org_role[]))
      or (s.promotion_id is not null and public.legal_case(s.promotion_id))
    )
  )
$fn$;

-- assign_reviewer
CREATE OR REPLACE FUNCTION public.assign_reviewer(_pid uuid, _user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare p public.promotions; _role public.org_role; _target public.org_role;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  _target := public.org_role_of(p.org_id, _user);
  if not coalesce(_role in ('owner', 'admin', 'compliance_lead'), false) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _target is null or _target not in ('owner', 'admin', 'reviewer', 'compliance_lead') then raise exception 'code:not_a_reviewer' using errcode = 'P0001'; end if;
  if public.promotion_uploader(_pid) = _user then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  if p.review_status not in ('pending_review', 'in_review') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  update public.promotions set assigned_reviewer_id = _user, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'assigned', p.review_status::text, p.review_status::text, jsonb_build_object('assignee', _user));
  perform public.notify_user(_user, 'review_assigned', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title));
end $fn$;

-- open_review
CREATE OR REPLACE FUNCTION public.open_review(_pid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare p public.promotions; _role public.org_role;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null or p.org_id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if _role is null or _role not in ('owner', 'admin', 'reviewer', 'compliance_lead') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if p.review_status <> 'pending_review' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if public.promotion_uploader(_pid) = auth.uid() then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  -- A reviewer opens only a case assigned to them; only managers may take an unassigned case (D169).
  if _role = 'reviewer' and p.assigned_reviewer_id is distinct from auth.uid() then raise exception 'code:not_assigned' using errcode = '42501'; end if;
  update public.promotions set review_status = 'in_review', assigned_reviewer_id = coalesce(assigned_reviewer_id, auth.uid()), updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'opened', 'pending_review', 'in_review', '{}'::jsonb);
end $fn$;

-- can_decide
CREATE OR REPLACE FUNCTION public.can_decide(_pid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare p public.promotions; _reasons text[] := '{}'; _role public.org_role; _settings public.org_settings; _open int;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('not_found')); end if;
  _role := public.org_role_of(p.org_id, auth.uid());
  if _role is null or _role not in ('owner', 'admin', 'reviewer', 'compliance_lead') then _reasons := array_append(_reasons, ('forbidden')::text); end if;
  if p.review_status <> 'in_review' then _reasons := array_append(_reasons, ('invalid_status')::text); end if;
  if public.promotion_uploader(_pid) = auth.uid() then _reasons := array_append(_reasons, ('separation_of_duties')::text); end if;
  if _role = 'reviewer' and p.assigned_reviewer_id is distinct from auth.uid() then _reasons := array_append(_reasons, ('not_assigned')::text); end if;
  if public.flow_is_live(_pid) then _reasons := array_append(_reasons, ('multi_level_flow')::text); end if;
  select * into _settings from public.org_settings where org_id = p.org_id;
  if coalesce(_settings.require_reviewer_responses, true) then
    select count(*) into _open from public.findings f
    where f.run_id = public.latest_run_id(p.current_version_id) and f.status <> 'resolved'
      and not exists (select 1 from public.finding_responses r where r.finding_id = f.id and r.actor_role = 'reviewer');
    if _open > 0 then _reasons := array_append(_reasons, (('missing_reviewer_responses:' || _open))::text); end if;
  end if;
  return jsonb_build_object('ok', cardinality(_reasons) = 0, 'reasons', to_jsonb(_reasons));
end $fn$;

-- save_claim
CREATE OR REPLACE FUNCTION public.save_claim(_id uuid, _org uuid, _name text, _text_ar text, _text_en text, _product_ids uuid[], _channels text[], _communication_types text[], _substantiation jsonb, _next_review date, _expires date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare c public.claims; _new uuid;
begin
  if coalesce(public.lib_role(_org)::text, '') not in ('owner', 'admin', 'compliance_lead', 'reviewer', 'creator') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _id is null then
    insert into public.claims (org_id, name, text_ar, text_en, product_ids, channels, communication_types, substantiation, next_review_at, expires_at)
    values (_org, trim(_name), trim(_text_ar), nullif(trim(coalesce(_text_en, '')), ''), coalesce(_product_ids, '{}'), coalesce(_channels, '{}'),
            coalesce(_communication_types, '{}'), coalesce(_substantiation, '[]'), _next_review, _expires)
    returning id into _new;
    return _new;
  end if;
  select * into c from public.claims where id = _id and org_id = _org for update;
  if c.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if c.status not in ('draft', 'changes_requested', 'rejected') then raise exception 'code:claim_locked' using errcode = 'P0001'; end if;
  if c.created_by is distinct from auth.uid() and public.lib_role(_org)::text not in ('owner', 'admin', 'compliance_lead') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  update public.claims set name = trim(_name), text_ar = trim(_text_ar), text_en = nullif(trim(coalesce(_text_en, '')), ''),
    product_ids = coalesce(_product_ids, '{}'), channels = coalesce(_channels, '{}'), communication_types = coalesce(_communication_types, '{}'),
    substantiation = coalesce(_substantiation, '[]'), next_review_at = _next_review, expires_at = _expires, status = 'draft'
  where id = _id;
  return _id;
end $fn$;

-- submit_claim
CREATE OR REPLACE FUNCTION public.submit_claim(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare c public.claims;
begin
  select * into c from public.claims where id = _id for update;
  if c.id is null or public.lib_role(c.org_id) is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if public.lib_role(c.org_id)::text not in ('owner', 'admin', 'compliance_lead', 'reviewer', 'creator') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if c.created_by is distinct from auth.uid() and public.lib_role(c.org_id)::text not in ('owner', 'admin', 'compliance_lead') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if c.status not in ('draft', 'changes_requested', 'rejected') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if jsonb_array_length(c.substantiation) = 0 then raise exception 'code:substantiation_required' using errcode = 'P0001'; end if;
  update public.claims set status = 'pending_review' where id = _id;
  perform public.notify_org(c.org_id, array['owner', 'admin', 'reviewer', 'compliance_lead']::public.org_role[], 'review_submitted', null,
    jsonb_build_object('claim_id', _id, 'title', c.name));
end $fn$;

-- archive_claim
CREATE OR REPLACE FUNCTION public.archive_claim(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare c public.claims;
begin
  select * into c from public.claims where id = _id;
  if c.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  -- Owner/admin archive any claim; the author may withdraw their own proposal before it is approved (D169).
  if not (coalesce(public.lib_role(c.org_id)::text, '') in ('owner', 'admin')
          or (c.created_by = auth.uid() and public.lib_role(c.org_id) is not null and c.status in ('draft', 'pending_review', 'changes_requested', 'rejected'))) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  update public.claims set status = 'archived' where id = _id;
end $fn$;

-- org_role_can
CREATE OR REPLACE FUNCTION public.org_role_can(_role org_role, _action text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $fn$
  select case _action
    when 'view_promotions' then case when _role::text in ('creator', 'external_uploader', 'external_reviewer') then 'cond' else 'yes' end
    when 'create_promotion' then case when _role::text in ('owner', 'admin', 'creator') then 'yes' when _role::text = 'external_uploader' then 'cond' else 'no' end
    when 'submit_for_review' then case when _role::text in ('owner', 'admin', 'creator') then 'yes'
                                       when _role::text in ('compliance_lead', 'reviewer', 'legal', 'external_uploader') then 'cond' else 'no' end
    when 'request_changes_comment' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer') then 'yes' else 'no' end
    when 'comment' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer', 'legal') then 'yes'
                             when _role::text = 'viewer' then 'no' else 'cond' end
    when 'decide_review' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer') then 'cond' else 'no' end
    when 'assign_reviewer' then case when _role::text in ('owner', 'admin', 'compliance_lead') then 'yes' else 'no' end
    when 'escalate_legal' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer') then 'cond' else 'no' end
    when 'legal_opinion' then case when _role::text = 'legal' then 'yes' else 'no' end
    when 'accept_risk' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'reviewer', 'legal') then 'cond' else 'no' end
    when 'manage_members' then case when _role::text = 'owner' then 'yes' when _role::text = 'admin' then 'cond' else 'no' end
    when 'manage_rule_packs' then case when _role::text in ('owner', 'admin', 'compliance_lead') then 'yes' else 'no' end
    when 'manage_company_rules' then case when _role::text in ('owner', 'admin', 'compliance_lead') then 'yes' else 'no' end
    when 'approve_company_rules' then case when _role::text in ('owner', 'admin', 'compliance_lead') then 'cond' else 'no' end
    when 'manage_products' then case when _role::text in ('owner', 'admin') then 'yes' else 'no' end
    when 'manage_settings' then case when _role::text in ('owner', 'admin') then 'yes' else 'no' end
    when 'view_analytics' then case when _role::text in ('owner', 'admin', 'compliance_lead', 'viewer') then 'yes' else 'no' end
    else 'no'
  end
$fn$;

-- Read policies: legal reads case-linked records only.
drop policy if exists "org read submissions" on public.submissions;
create policy "org read submissions" on public.submissions for select to authenticated
  using (org_id is not null and public.is_org_member(org_id, array['owner', 'admin', 'reviewer', 'compliance_lead', 'viewer']::public.org_role[]));
drop policy if exists "legal read case submissions" on public.submissions;
create policy "legal read case submissions" on public.submissions for select to authenticated
  using (promotion_id is not null and public.legal_case(promotion_id));

drop policy if exists claims_read on public.claims;
create policy claims_read on public.claims for select to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin', 'compliance_lead', 'reviewer', 'creator', 'viewer']::public.org_role[]) or public.legal_can_read_claim(id));

drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin', 'compliance_lead', 'reviewer', 'creator', 'viewer']::public.org_role[]) or public.legal_can_read_product(id));

drop policy if exists disclaimers_read on public.disclaimers;
create policy disclaimers_read on public.disclaimers for select to authenticated
  using (org_id is null or public.is_org_member(org_id, array['owner', 'admin', 'compliance_lead', 'reviewer', 'creator', 'viewer']::public.org_role[]) or public.legal_can_read_disclaimer(id));

drop policy if exists "org media read" on storage.objects;
create policy "org media read" on storage.objects for select to authenticated
  using (bucket_id = 'media' and exists (
    select 1 from public.submissions s
    where s.id::text = (storage.foldername(objects.name))[2]
      and ((s.org_id is not null and public.is_org_member(s.org_id, array['owner', 'admin', 'reviewer', 'compliance_lead', 'viewer']::public.org_role[]))
           or (s.promotion_id is not null and public.legal_case(s.promotion_id)))));

-- Claim evidence files: members except legal; legal only files cited by a claim linked to their case.
drop policy if exists "evidence read" on storage.objects;
create policy "evidence read" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and (
    public.is_org_member(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'compliance_lead', 'reviewer', 'creator', 'viewer']::public.org_role[])
    or exists (select 1 from public.claims c
               where c.org_id::text = (storage.foldername(objects.name))[1]
                 and public.legal_can_read_claim(c.id)
                 and position(objects.name in c.substantiation::text) > 0)));
