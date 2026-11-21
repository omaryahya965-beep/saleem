-- V2 completion — SALEEM Fix media editing (D198).
-- `media_edit` jobs are deterministic: the browser renders the corrected video from the ORIGINAL footage (mute
-- ranges, cover bands, disclosure overlay, subtitles, recorded/uploaded voiceover). No AI provider and no charge, so
-- the job is ready at once with the current caption and transcript as the editable proposal. The same quota,
-- permission, idempotency and two-step acceptance apply; acceptance creates a new VIDEO version that is analysed
-- afresh and never inherits an approval. `replacement` (AI video generation) still needs a configured provider.
create or replace function public.create_correction_job(_pid uuid, _method text, _findings uuid[], _preferences jsonb,
  _instructions text, _key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.promotions; _check jsonb; _id uuid; _active uuid; s public.submissions; _script text;
begin
  select * into p from public.promotions where id = _pid for update;
  if p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  select id into _id from public.correction_jobs where promotion_id = _pid and idempotency_key = _key;
  if _id is not null then return _id; end if;
  _check := public.can_fix_promotion(_pid);
  if not (_check->>'ok')::boolean then
    raise exception 'code:%', _check->'reasons'->>0 using errcode = 'P0001', detail = _check::text;
  end if;
  if _method not in ('text_correction', 'media_edit', 'replacement') then raise exception 'code:invalid_method' using errcode = 'P0001'; end if;
  if _method = 'replacement' then raise exception 'code:provider_not_configured' using errcode = 'P0001'; end if;
  select * into s from public.submissions where id = p.current_version_id;
  if _method = 'media_edit' and (s.kind <> 'video' or s.file_path is null or s.media_deleted_at is not null) then
    raise exception 'code:media_unavailable' using errcode = 'P0001';
  end if;
  select id into _active from public.correction_jobs where promotion_id = _pid and status in ('generating', 'accepting');
  if _active is not null then raise exception 'code:job_in_progress' using errcode = 'P0001', detail = _active::text; end if;
  if exists (select 1 from unnest(coalesce(_findings, '{}')) x where not exists (
      select 1 from public.findings f where f.id = x and f.submission_id = p.current_version_id and f.run_id = public.latest_run_id(p.current_version_id))) then
    raise exception 'code:invalid_findings' using errcode = 'P0001';
  end if;
  select full_text into _script from public.transcripts where submission_id = s.id;
  insert into public.correction_jobs (promotion_id, org_id, source_submission_id, method, status, selected_finding_ids, preferences, instructions,
    idempotency_key, provider, plan, proposal)
  values (_pid, p.org_id, p.current_version_id, _method, case when _method = 'media_edit' then 'ready' else 'draft' end,
          coalesce(_findings, '{}'), coalesce(_preferences, '{}'::jsonb), nullif(left(trim(coalesce(_instructions, '')), 3000), ''), _key,
          case when _method = 'media_edit' then 'browser' end,
          case when _method = 'media_edit' then '[]'::jsonb end,
          case when _method = 'media_edit' then jsonb_build_object('caption', coalesce(s.caption, p.caption, ''), 'script', coalesce(_script, ''),
            'disclosures', '[]'::jsonb, 'changes', '[]'::jsonb, 'limitations', '[]'::jsonb) end)
  returning id into _id;
  perform public.log_review_event(_pid, p.current_version_id, 'correction_started', p.review_status::text, p.review_status::text,
    jsonb_build_object('job_id', _id, 'method', _method, 'findings', cardinality(coalesce(_findings, '{}'))));
  return _id;
end $$;

-- Recovery: an acceptance interrupted (tab closed during the upload) is re-claimable after 10 minutes, so a job can
-- never stay stuck in «accepting». Nothing was linked in that case (finish_accept_correction links atomically).
create or replace function public.begin_accept_correction(_id uuid, _edited jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare j public.correction_jobs; p public.promotions;
begin
  select * into j from public.correction_jobs where id = _id for update;
  if j.id is null or j.created_by <> auth.uid() then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if not (j.status = 'ready' or (j.status = 'accepting' and j.result_submission_id is null and j.updated_at < now() - interval '10 minutes')) then
    raise exception 'code:invalid_status' using errcode = 'P0001';
  end if;
  select * into p from public.promotions where id = j.promotion_id;
  if p.current_version_id <> j.source_submission_id then raise exception 'code:source_outdated' using errcode = 'P0001'; end if;
  if p.review_status not in ('draft', 'changes_requested', 'rejected', 'conditionally_approved') then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(_edited, '{}'::jsonb)) <> 'object' or (coalesce(trim(coalesce(_edited->>'script', '') || coalesce(_edited->>'caption', '')), '') = ''
       and _edited->'media' is null) then
    raise exception 'code:proposal_empty' using errcode = 'P0001';
  end if;
  update public.correction_jobs set status = 'accepting', edited_proposal = _edited, updated_at = now() where id = _id;
end $$;
