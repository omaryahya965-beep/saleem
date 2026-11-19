-- RBAC hardening (2026-11-19, D168). Found by backend/tests/rbac.test.ts on a fresh organisation:
-- 1. Claims library writes (save_claim, new_claim_version, submit_claim, claim_add_from_finding) accepted any member
--    except legal — including the read-only viewer and the external partner / reviewer. Writers are now
--    owner, admin, compliance_lead, reviewer, creator.
-- 2. NULL-unsafe role checks: for a caller with no membership the role is NULL, "not (NULL in (...))" is NULL and
--    IF NULL does not raise. assign_reviewer, respond_finding, link_claim now fail closed (coalesce).
-- 3. org_role_can follows the matrix (frontend/src/lib/permissions.ts): view_analytics no longer includes the
--    reviewer (org_metrics checks org_can); assign_reviewer is «cond» for the reviewer (self-assignment only,
--    which assign_reviewer already enforced).
-- Bodies are the current definitions with only the lines above changed. Reversible by re-applying the previous
-- definitions (migrations 20261117050000, 20261118060100, 20261118080400, 20261118080500).

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
  update public.claims set name = trim(_name), text_ar = trim(_text_ar), text_en = nullif(trim(coalesce(_text_en, '')), ''),
    product_ids = coalesce(_product_ids, '{}'), channels = coalesce(_channels, '{}'), communication_types = coalesce(_communication_types, '{}'),
    substantiation = coalesce(_substantiation, '[]'), next_review_at = _next_review, expires_at = _expires, status = 'draft'
  where id = _id;
  return _id;
end $fn$;

-- new_claim_version
CREATE OR REPLACE FUNCTION public.new_claim_version(_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare c public.claims; _new uuid;
begin
  select * into c from public.claims where id = _id;
  if c.id is null or coalesce(public.lib_role(c.org_id)::text, '') not in ('owner', 'admin', 'compliance_lead', 'reviewer', 'creator') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if c.status <> 'approved' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  insert into public.claims (org_id, claim_key, version, supersedes_id, name, text_ar, text_en, product_ids, channels, communication_types, substantiation, next_review_at, expires_at)
  values (c.org_id, c.claim_key, (select max(version) + 1 from public.claims where claim_key = c.claim_key), c.id, c.name, c.text_ar, c.text_en,
          c.product_ids, c.channels, c.communication_types, c.substantiation, c.next_review_at, c.expires_at)
  returning id into _new;
  return _new;
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
  if c.status not in ('draft', 'changes_requested', 'rejected') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if jsonb_array_length(c.substantiation) = 0 then raise exception 'code:substantiation_required' using errcode = 'P0001'; end if;
  update public.claims set status = 'pending_review' where id = _id;
  perform public.notify_org(c.org_id, array['owner', 'admin', 'reviewer', 'compliance_lead']::public.org_role[], 'review_submitted', null,
    jsonb_build_object('claim_id', _id, 'title', c.name));
end $fn$;

-- link_claim
CREATE OR REPLACE FUNCTION public.link_claim(_pid uuid, _claim uuid, _link boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare p public.promotions; c public.claims;
begin
  select * into p from public.promotions where id = _pid;
  select * into c from public.claims where id = _claim;
  if p.id is null or c.id is null or p.org_id is distinct from c.org_id or not public.can_read_promotion(_pid) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if coalesce(public.lib_role(p.org_id)::text, '') not in ('owner', 'admin', 'reviewer', 'compliance_lead', 'creator') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _link then
    insert into public.promotion_claims (promotion_id, claim_id, link_source, linked_by) values (_pid, _claim, 'manual', auth.uid())
    on conflict (promotion_id, claim_id) do nothing;
  else
    delete from public.promotion_claims where promotion_id = _pid and claim_id = _claim;
  end if;
end $fn$;

-- claim_add_from_finding
CREATE OR REPLACE FUNCTION public.claim_add_from_finding(_finding uuid, _name text, _text_ar text, _substantiation jsonb, _approve boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare f public.findings; p public.promotions; _role public.org_role; _id uuid; c public.claims;
begin
  select * into f from public.findings where id = _finding;
  if f.id is null or f.rule_code <> 'SYS-CLAIMS' or not public.can_read_submission(f.submission_id) then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select p2.* into p from public.promotions p2 join public.submissions s on s.promotion_id = p2.id where s.id = f.submission_id;
  _role := public.lib_role(p.org_id);
  if coalesce(_role::text, '') not in ('owner', 'admin', 'compliance_lead', 'reviewer', 'creator') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(_substantiation, '[]')) = 0 then raise exception 'code:substantiation_required' using errcode = 'P0001'; end if;
  insert into public.claims (org_id, name, text_ar, substantiation, status, source_finding_id, product_ids, communication_types)
  values (p.org_id, trim(_name), trim(_text_ar), _substantiation, 'pending_review', _finding,
          case when p.product_id is null then '{}' else array[p.product_id] end, array[p.communication_type::text])
  returning id into _id;
  insert into public.promotion_claims (promotion_id, claim_id, link_source, linked_by) values (p.id, _id, 'finding_fix', auth.uid())
  on conflict do nothing;
  if _approve then
    if _role not in ('owner', 'admin', 'reviewer', 'compliance_lead') then raise exception 'code:forbidden' using errcode = '42501'; end if;
    -- The reviewer adds and approves in one step; the claim records them as reviewer (they did not author the ad).
    update public.claims set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), created_by = null where id = _id returning * into c;
    perform public.resolve_claim_findings(c);
  end if;
  perform public.log_review_event(p.id, f.submission_id, 'claim_fix', null, null, jsonb_build_object('claim_id', _id, 'approved', _approve));
  return _id;
end $fn$;

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
  if not coalesce(_role in ('owner', 'admin', 'compliance_lead') or (_role = 'reviewer' and _user = auth.uid()), false) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _target is null or _target not in ('owner', 'admin', 'reviewer', 'compliance_lead') then raise exception 'code:not_a_reviewer' using errcode = 'P0001'; end if;
  if public.promotion_uploader(_pid) = _user then raise exception 'code:separation_of_duties' using errcode = '42501'; end if;
  if p.review_status not in ('pending_review', 'in_review') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  update public.promotions set assigned_reviewer_id = _user, updated_at = now() where id = _pid;
  perform public.log_review_event(_pid, p.current_version_id, 'assigned', p.review_status::text, p.review_status::text, jsonb_build_object('assignee', _user));
  perform public.notify_user(_user, 'review_assigned', p.current_version_id, jsonb_build_object('promotion_id', _pid, 'title', p.title));
end $fn$;

-- respond_finding
CREATE OR REPLACE FUNCTION public.respond_finding(_finding uuid, _action text, _comment text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
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
    if not coalesce(p.owner_id = auth.uid() or s.user_id = auth.uid() or _role in ('owner', 'admin', 'creator'), false) then
      raise exception 'code:forbidden' using errcode = '42501';
    end if;
    if p.review_status not in ('draft', 'changes_requested', 'rejected', 'conditionally_approved', 'pending_review') then
      raise exception 'code:invalid_status' using errcode = 'P0001';
    end if;
    _actor := 'uploader';
  elsif _action = any(_reviewer_actions) or _action = 'reply' then
    -- Reviewer side: org reviewers, never on a version they uploaded (separation of duties).
    if _role is null or _role not in ('owner', 'admin', 'reviewer', 'compliance_lead') then raise exception 'code:forbidden' using errcode = '42501'; end if;
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
    when 'assign_reviewer' then case when _role::text in ('owner', 'admin', 'compliance_lead') then 'yes' when _role::text = 'reviewer' then 'cond' else 'no' end
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

-- org_metrics: authorised by org_can(view_analytics) instead of its own role list (the matrix is the one source).
CREATE OR REPLACE FUNCTION public.org_metrics(_org uuid, _from timestamp with time zone, _to timestamp with time zone, _filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare
  s public.org_settings; _sla int; _wk int[]; f jsonb := coalesce(_filters, '{}'::jsonb); out jsonb;
begin
  if coalesce(public.org_can(_org, 'view_analytics'), 'no') = 'no' then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not public.org_feature(_org, 'analytics') then raise exception 'code:feature_off' using errcode = 'P0001'; end if;
  if _from is null or _to is null or _to < _from then raise exception 'code:invalid_date' using errcode = 'P0001'; end if;
  select * into s from public.org_settings where org_id = _org;
  _sla := coalesce(s.review_sla_business_days, 3);
  _wk := coalesce(s.weekend_days, '{5,6}');

  with p as (
    select pr.* from public.promotions pr
    where pr.org_id = _org and not pr.is_demo
      and (f->>'product_id' is null or pr.product_id = (f->>'product_id')::uuid)
      and (f->>'channel' is null or (f->>'channel') = any(pr.channels))
      and (f->>'communication_type' is null or pr.communication_type::text = f->>'communication_type')
      and (f->>'uploader' is null or pr.owner_id = (f->>'uploader')::uuid)
      and (f->>'reviewer' is null or pr.assigned_reviewer_id = (f->>'reviewer')::uuid)
      and (f->'tags' is null or pr.tags && array(select jsonb_array_elements_text(f->'tags')))
  ),
  sub as (select e.* from public.review_events e join p on p.id = e.promotion_id where e.event_type = 'submitted'),
  sub_r as (select * from sub where created_at >= _from and created_at < _to),
  dec as (select d.* from public.review_decisions d join p on p.id = d.promotion_id
          where d.decision in ('approve', 'conditional_approve', 'request_changes', 'reject')),
  dec_r as (select * from dec where created_at >= _from and created_at < _to),
  first_sub as (select promotion_id, min(created_at) at from sub group by promotion_id),
  first_dec as (select distinct on (promotion_id) promotion_id, decision, created_at from dec order by promotion_id, created_at, id),
  first_appr as (select promotion_id, min(created_at) at from dec where decision = 'approve' group by promotion_id),
  -- SLA: each decision against the latest submission before it.
  dec_sla as (
    select d.id, public.business_days_between(
      (select max(x.created_at) from sub x where x.promotion_id = d.promotion_id and x.created_at <= d.created_at), d.created_at, _wk) <= _sla ok
    from dec_r d),
  appr_time as (
    select extract(epoch from (a.at - fs.at)) / 3600.0 h from first_appr a join first_sub fs using (promotion_id)
    where a.at >= _from and a.at < _to),
  first_resp as (
    select extract(epoch from (r.at - fs.at)) / 3600.0 h from first_sub fs
    cross join lateral (
      select min(t) at from (
        select min(fr.created_at) t from public.finding_responses fr join public.submissions sb on sb.id = fr.submission_id
          where sb.promotion_id = fs.promotion_id and fr.actor_role = 'reviewer' and fr.created_at >= fs.at
        union all select min(c.created_at) from public.comments c join p on p.id = c.promotion_id
          where c.promotion_id = fs.promotion_id and c.author_id <> p.owner_id and c.created_at >= fs.at
        union all select min(d.created_at) from dec d where d.promotion_id = fs.promotion_id and d.created_at >= fs.at) z) r
    where fs.at >= _from and fs.at < _to and r.at is not null),
  iters as (
    select (select count(*) from sub x where x.promotion_id = a.promotion_id and x.created_at <= a.at) - 1 n
    from first_appr a where a.at >= _from and a.at < _to)
  select jsonb_build_object(
    'range', jsonb_build_object('from', _from, 'to', _to, 'sla_business_days', _sla),
    'promotions_submitted', (select count(distinct promotion_id) from sub_r),
    'versions_submitted', (select count(*) from sub_r),
    'avg_versions', (select case when count(distinct promotion_id) = 0 then 0 else greatest(1.0, round(count(*)::numeric / count(distinct promotion_id), 2)) end from sub_r),
    'early_requests', (select case when count(*) = 0 then 0 else round(count(*) filter (where p.deadline_at is not null
        and public.business_days_between(x.created_at, p.deadline_at, _wk) < _sla)::numeric / count(*), 4) end
      from sub_r x join p on p.id = x.promotion_id),
    'sla_compliance', (select case when count(*) = 0 then 0 else round(count(*) filter (where ok)::numeric / count(*), 4) end from dec_sla),
    'reviews_decided', (select count(*) from dec_r),
    'first_time_approval', (select case when count(*) = 0 then 0 else round(count(*) filter (where fd.decision = 'approve')::numeric / count(*), 4) end
      from first_dec fd join p on p.id = fd.promotion_id where p.created_at >= _from and p.created_at < _to),
    'approval_time_hours', (select jsonb_build_object('mean', round(avg(h)::numeric, 2), 'median', round((percentile_cont(0.5) within group (order by h))::numeric, 2), 'n', count(*)) from appr_time),
    'first_response_hours', (select jsonb_build_object('mean', round(avg(h)::numeric, 2), 'median', round((percentile_cont(0.5) within group (order by h))::numeric, 2), 'n', count(*)) from first_resp),
    'iterations', (select jsonb_build_object('mean', round(avg(n)::numeric, 2), 'median', round((percentile_cont(0.5) within group (order by n))::numeric, 2), 'n', count(*)) from iters),
    'reasons', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'label_ar', r.label_ar, 'label_en', r.label_en, 'count', c.n) order by c.n desc)
      from (select unnest(d.reason_ids) rid, count(*) n from dec_r d where d.decision in ('reject', 'request_changes') group by 1) c
      join public.rejection_reasons r on r.id = c.rid), '[]'::jsonb),
    'reasons_other', (select count(*) from dec_r where decision in ('reject', 'request_changes') and reason_other is not null),
    'workload', coalesce((select jsonb_agg(w order by w->>'user_id') from (
      select jsonb_build_object('user_id', u, 'name', (select coalesce(m.display_name, m.email) from public.org_members m where m.org_id = _org and m.user_id = u),
        'decisions', (select count(*) from dec_r d where d.actor_id = u),
        'open', (select count(*) from p where p.assigned_reviewer_id = u and p.review_status in ('pending_review', 'in_review'))) w
      from (select actor_id u from dec_r union select assigned_reviewer_id from p where assigned_reviewer_id is not null and review_status in ('pending_review', 'in_review')) us) ww), '[]'::jsonb),
    'volume', jsonb_build_object(
      'by_status', coalesce((select jsonb_object_agg(review_status, n) from (select review_status, count(*) n from p where created_at >= _from and created_at < _to group by 1) v), '{}'::jsonb),
      'by_channel', coalesce((select jsonb_object_agg(ch, n) from (select unnest(channels) ch, count(*) n from p where created_at >= _from and created_at < _to group by 1) v), '{}'::jsonb),
      'by_type', coalesce((select jsonb_object_agg(communication_type, n) from (select communication_type, count(*) n from p where created_at >= _from and created_at < _to group by 1) v), '{}'::jsonb),
      'by_product', coalesce((select jsonb_object_agg(coalesce(pr.name_ar, '—'), n) from (select product_id, count(*) n from p where created_at >= _from and created_at < _to group by 1) v
                               left join public.products pr on pr.id = v.product_id), '{}'::jsonb)),
    'risk_accepted', (select count(*) from public.review_decisions d join p on p.id = d.promotion_id where d.decision = 'risk_accept' and d.created_at >= _from and d.created_at < _to)
  ) into out;
  return out;
end $fn$;
