-- Rollback of 20261124100000_v2_drop_unused_functions: recreates the dropped functions with their original definitions and grants.
CREATE OR REPLACE FUNCTION public.admin_dedupe_stats(_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select jsonb_build_object(
    'reuses', count(*),
    'saved_cost_usd', coalesce(sum((meta->>'saved_cost_usd')::numeric), 0),
    'disputed_findings', (select count(*) from public.finding_feedback where created_at >= now() - make_interval(days => _days)))
    from public.audit_events where action = 'duplicate_reuse' and at >= now() - make_interval(days => _days));
end $function$;
revoke all on function public.admin_dedupe_stats(_days integer) from public;
grant execute on function public.admin_dedupe_stats(_days integer) to authenticated;
grant execute on function public.admin_dedupe_stats(_days integer) to service_role;

CREATE OR REPLACE FUNCTION public.admin_finding_feedback(_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x order by x.created_at desc) from (
      select fb.id, fb.created_at, fb.reason, f.rule_code, f.severity, f.t_start, f.evidence_type, f.evidence_text, f.source,
             s.id as submission_id, s.kind, s.caption, s.text_content, s.platform, s.product_category, s.is_paid_ad,
             s.has_written_contract, s.ai_used, s.mawthooq_license_no, s.duration_seconds, s.title,
             (select segments from public.transcripts t where t.submission_id = s.id) as segments,
             (select coalesce(jsonb_agg(jsonb_build_object('rule', f2.rule_code, 't', f2.t_start)), '[]')
                from public.findings f2 where f2.run_id = f.run_id and f2.id not in (select finding_id from public.finding_feedback)) as kept
      from public.finding_feedback fb
      join public.findings f on f.id = fb.finding_id
      join public.submissions s on s.id = fb.submission_id
      limit greatest(1, least(_limit, 1000))
    ) x
  ), '[]'::jsonb);
end $function$;
revoke all on function public.admin_finding_feedback(_limit integer) from public;
grant execute on function public.admin_finding_feedback(_limit integer) to authenticated;
grant execute on function public.admin_finding_feedback(_limit integer) to service_role;

CREATE OR REPLACE FUNCTION public.log_duplicate_reuse(_previous uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _cost numeric;
begin
  if not exists (select 1 from public.submissions where id = _previous and user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select cost_usd into _cost from public.analysis_runs where submission_id = _previous order by started_at desc limit 1;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'duplicate_reuse', 'submissions', _previous::text, jsonb_build_object('saved_cost_usd', coalesce(_cost, 0)));
end $function$;
revoke all on function public.log_duplicate_reuse(_previous uuid) from public;
grant execute on function public.log_duplicate_reuse(_previous uuid) to authenticated;
grant execute on function public.log_duplicate_reuse(_previous uuid) to service_role;

CREATE OR REPLACE FUNCTION public.delete_submission_media(_sid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.owns_submission(_sid) or public.has_role(auth.uid(), 'admin')) then
    raise exception 'Unauthorized to delete media for submission %', _sid;
  end if;

  update public.submissions
  set media_deleted_at = now(),
      file_path = null,
      audio_path = null,
      thumbnail_path = null
  where id = _sid;

  update public.frames
  set image_path = null
  where submission_id = _sid;
end;
$function$;
revoke all on function public.delete_submission_media(_sid uuid) from public;
grant execute on function public.delete_submission_media(_sid uuid) to anon;
grant execute on function public.delete_submission_media(_sid uuid) to authenticated;
grant execute on function public.delete_submission_media(_sid uuid) to public;
grant execute on function public.delete_submission_media(_sid uuid) to service_role;

CREATE OR REPLACE FUNCTION public.edit_comment(_id uuid, _body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.comments;
begin
  select * into c from public.comments where id = _id;
  if c.id is null or c.author_id <> auth.uid() or c.deleted_at is not null then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if c.created_at < now() - interval '15 minutes' then raise exception 'code:edit_window_closed' using errcode = 'P0001'; end if;
  if coalesce(trim(_body), '') = '' then raise exception 'code:body_required' using errcode = 'P0001'; end if;
  update public.comments set body = trim(_body), edited_at = now() where id = _id;
end $function$;
revoke all on function public.edit_comment(_id uuid, _body text) from public;
grant execute on function public.edit_comment(_id uuid, _body text) to authenticated;
grant execute on function public.edit_comment(_id uuid, _body text) to service_role;

CREATE OR REPLACE FUNCTION public.claim_extend_scope(_claim uuid, _pid uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.claims; p public.promotions; _new uuid;
begin
  select * into c from public.claims where id = _claim;
  select * into p from public.promotions where id = _pid;
  if c.id is null or p.id is null or c.org_id is distinct from p.org_id then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  _new := public.new_claim_version(_claim);
  update public.claims set
    product_ids = case when cardinality(product_ids) = 0 or p.product_id is null then product_ids else array(select distinct x from unnest(product_ids || p.product_id) x) end,
    channels = case when cardinality(channels) = 0 then channels else array(select distinct x from unnest(channels || p.channels) x) end,
    communication_types = case when cardinality(communication_types) = 0 then communication_types else array(select distinct x from unnest(communication_types || p.communication_type::text) x) end,
    status = 'pending_review'
  where id = _new;
  return _new;
end $function$;
revoke all on function public.claim_extend_scope(_claim uuid, _pid uuid) from public;
grant execute on function public.claim_extend_scope(_claim uuid, _pid uuid) to authenticated;
grant execute on function public.claim_extend_scope(_claim uuid, _pid uuid) to service_role;
