-- v2 Phase 6.6: analytics behind org_settings.features.analytics (default off). Computed only from review events
-- and sealed decisions; SLA in business days (org weekend_days, default Fri–Sat). Risk acceptance never counts as
-- approval. Durations are in hours. Filters: product_id, channel, communication_type, uploader, reviewer, tags.

/** Working days after `_from` up to and including `_to` (dates in Asia/Riyadh). */
create or replace function public.business_days_between(_from timestamptz, _to timestamptz, _weekend integer[] default '{5,6}')
returns integer language sql immutable set search_path = '' as $$
  select count(*)::int from generate_series((_from at time zone 'Asia/Riyadh')::date + 1, (_to at time zone 'Asia/Riyadh')::date, interval '1 day') d
  where not (extract(dow from d)::int = any(coalesce(_weekend, '{5,6}')))
$$;

create or replace function public.org_metrics(_org uuid, _from timestamptz, _to timestamptz, _filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  s public.org_settings; _sla int; _wk int[]; f jsonb := coalesce(_filters, '{}'::jsonb); out jsonb;
begin
  if not public.is_org_member(_org, array['owner', 'admin', 'reviewer']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
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
end $$;

revoke all on function public.org_metrics(uuid, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.org_metrics(uuid, timestamptz, timestamptz, jsonb), public.business_days_between(timestamptz, timestamptz, integer[]) to authenticated;
