-- V2 completion — history actors, workspace overview, roles summary, feature catalogue (D192–D195).

-- Names and CURRENT roles of the people behind review events and decisions of one advertisement, for its readers.
-- Externals receive roles only. Actors that were never recorded stay absent (no fabrication).
create or replace function public.history_actors(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _external boolean;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) then return '{}'::jsonb; end if;
  _external := p.org_id is not null and public.org_role_of(p.org_id, auth.uid()) in ('external_uploader', 'external_reviewer');
  return coalesce((select jsonb_object_agg(a.actor, jsonb_build_object(
      'name', case when _external and a.actor <> auth.uid() then null else coalesce(m.display_name, m.email) end,
      'role', m.role)) from (
        select actor_id as actor from public.review_events where promotion_id = _pid and actor_id is not null
        union select actor_id from public.review_decisions where promotion_id = _pid
        union select user_id from public.submissions where promotion_id = _pid
        union select actor_id from public.finding_responses r join public.submissions s on s.id = r.submission_id where s.promotion_id = _pid
      ) a left join public.org_members m on m.org_id = p.org_id and m.user_id = a.actor), '{}'::jsonb);
end $$;
revoke all on function public.history_actors(uuid) from public, anon;
grant execute on function public.history_actors(uuid) to authenticated;

-- Workspace overview for managers: counts by state, unassigned, overdue, reviewer workload, partner submissions,
-- campaign progress and recent decisions. Owner / admin / compliance lead / viewer only (org_can view_analytics is
-- not required: these are operational counts of advertisements the caller can already read).
create or replace function public.workspace_overview(_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare _role public.org_role;
begin
  _role := public.org_role_of(_org, auth.uid());
  if _role is null or _role not in ('owner', 'admin', 'compliance_lead', 'viewer') then raise exception 'code:forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'by_status', coalesce((select jsonb_object_agg(review_status, n) from (
        select review_status, count(*) n from public.promotions where org_id = _org group by 1) x), '{}'::jsonb),
    'unassigned', (select count(*) from public.promotions where org_id = _org and review_status in ('pending_review', 'in_review') and assigned_reviewer_id is null),
    'overdue', (select count(*) from public.promotions where org_id = _org and review_status in ('pending_review', 'in_review', 'escalated')
                and deadline_at is not null and deadline_at < now()),
    'advertisements', (select count(*) from public.promotions where org_id = _org),
    'versions', (select count(*) from public.submissions s join public.promotions p on p.id = s.promotion_id where p.org_id = _org),
    'analysis_runs', (select count(*) from public.analysis_runs r join public.submissions s on s.id = r.submission_id
                      join public.promotions p on p.id = s.promotion_id where p.org_id = _org),
    'partner_submissions', (select count(*) from public.promotions where org_id = _org and partner_link_id is not null),
    'workload', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', coalesce(m.display_name, m.email), 'role', m.role,
        'open', (select count(*) from public.promotions x where x.org_id = _org and x.assigned_reviewer_id = m.user_id
                 and x.review_status in ('pending_review', 'in_review', 'escalated', 'conditionally_approved'))) order by m.role)
      from public.org_members m where m.org_id = _org and m.role in ('owner', 'admin', 'reviewer', 'compliance_lead')), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'brand', c.brand, 'starts_on', c.starts_on, 'ends_on', c.ends_on,
        'ads', (select count(*) from public.promotions x where x.campaign_id = c.id),
        'approved', (select count(*) from public.promotions x where x.campaign_id = c.id and x.review_status = 'approved'),
        'in_review', (select count(*) from public.promotions x where x.campaign_id = c.id and x.review_status in ('pending_review', 'in_review', 'escalated')),
        'products', coalesce((select jsonb_agg(distinct pr.name_ar) from public.promotions x join public.products pr on pr.id = x.product_id
                              where x.campaign_id = c.id), '[]'::jsonb)) order by c.created_at desc)
      from public.campaigns c where c.org_id = _org), '[]'::jsonb),
    'recent_decisions', coalesce((select jsonb_agg(row_to_json(d)) from (
        select d.promotion_id, p.title, d.decision, d.created_at from public.review_decisions d join public.promotions p on p.id = d.promotion_id
        where p.org_id = _org order by d.created_at desc limit 8) d), '[]'::jsonb)
  );
end $$;
revoke all on function public.workspace_overview(uuid) from public, anon;
grant execute on function public.workspace_overview(uuid) to authenticated;

-- Members per role, for the roles page (members of the organisation only; counts, no personal data).
create or replace function public.role_member_counts(_org uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.org_role_of(_org, auth.uid()) is null or public.org_role_of(_org, auth.uid()) in ('external_uploader', 'external_reviewer')
    then '{}'::jsonb
    else coalesce((select jsonb_object_agg(role, n) from (select role, count(*) n from public.org_members where org_id = _org group by 1) x), '{}'::jsonb) end
$$;
revoke all on function public.role_member_counts(uuid) from public, anon;
grant execute on function public.role_member_counts(uuid) to authenticated;

-- SALEEM Fix configuration from the Features page: monthly limit (owner/admin), stored with the other features.
create or replace function public.set_fix_monthly_limit(_org uuid, _limit int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _limit is null or _limit < 0 or _limit > 1000 then raise exception 'code:invalid_limit' using errcode = 'P0001'; end if;
  update public.org_settings set features = jsonb_set(coalesce(features, '{}'::jsonb), '{saleem_fix_monthly_limit}', to_jsonb(_limit)), updated_at = now(),
    updated_by = auth.uid() where org_id = _org;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'saleem_fix.limit', 'org_settings', _org::text, jsonb_build_object('limit', _limit));
end $$;
revoke all on function public.set_fix_monthly_limit(uuid, int) from public, anon;
grant execute on function public.set_fix_monthly_limit(uuid, int) to authenticated;
