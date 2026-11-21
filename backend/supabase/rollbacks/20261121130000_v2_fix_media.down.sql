-- Rollback of 20261121130000_v2_fix_media.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
CREATE OR REPLACE FUNCTION public.begin_accept_correction(_id uuid, _edited jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.correction_jobs; p public.promotions;
begin
  select * into j from public.correction_jobs where id = _id for update;
  if j.id is null or j.created_by <> auth.uid() then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if j.status <> 'ready' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  select * into p from public.promotions where id = j.promotion_id;
  if p.current_version_id <> j.source_submission_id then raise exception 'code:source_outdated' using errcode = 'P0001'; end if;
  if p.review_status not in ('draft', 'changes_requested', 'rejected', 'conditionally_approved') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(_edited, '{}'::jsonb)) <> 'object' or coalesce(trim(coalesce(_edited->>'script', '') || coalesce(_edited->>'caption', '')), '') = '' then
    raise exception 'code:proposal_empty' using errcode = 'P0001';
  end if;
  update public.correction_jobs set status = 'accepting', edited_proposal = _edited, updated_at = now() where id = _id;
end $function$;
CREATE OR REPLACE FUNCTION public.create_correction_job(_pid uuid, _method text, _findings uuid[], _preferences jsonb, _instructions text, _key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.promotions; _check jsonb; _id uuid; _active uuid;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  -- Same key → same job (double clicks, refreshes).
  select id into _id from public.correction_jobs where promotion_id = _pid and idempotency_key = _key;
  if _id is not null then return _id; end if;
  _check := public.can_fix_promotion(_pid);
  if not (_check->>'ok')::boolean then
    raise exception 'code:%', _check->'reasons'->>0 using errcode = 'P0001', detail = _check::text;
  end if;
  if _method not in ('text_correction', 'media_edit', 'replacement') then raise exception 'code:invalid_method' using errcode = 'P0001'; end if;
  -- Media editing and replacement generation need a configured provider (none in this release).
  if _method <> 'text_correction' then raise exception 'code:provider_not_configured' using errcode = 'P0001'; end if;
  select id into _active from public.correction_jobs where promotion_id = _pid and status in ('generating', 'accepting');
  if _active is not null then raise exception 'code:job_in_progress' using errcode = 'P0001', detail = _active::text; end if;
  if exists (select 1 from unnest(coalesce(_findings, '{}')) x where not exists (
      select 1 from public.findings f where f.id = x and f.submission_id = p.current_version_id and f.run_id = public.latest_run_id(p.current_version_id))) then
    raise exception 'code:invalid_findings' using errcode = 'P0001';
  end if;
  insert into public.correction_jobs (promotion_id, org_id, source_submission_id, method, selected_finding_ids, preferences, instructions, idempotency_key)
  values (_pid, p.org_id, p.current_version_id, _method, coalesce(_findings, '{}'), coalesce(_preferences, '{}'::jsonb),
          nullif(left(trim(coalesce(_instructions, '')), 3000), ''), _key)
  returning id into _id;
  perform public.log_review_event(_pid, p.current_version_id, 'correction_started', p.review_status::text, p.review_status::text,
    jsonb_build_object('job_id', _id, 'method', _method, 'findings', cardinality(coalesce(_findings, '{}'))));
  return _id;
end $function$;
commit;
