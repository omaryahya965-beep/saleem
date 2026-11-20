-- SALEEM Fix — الإصلاح الذكي (D178). AI-assisted correction of an advertisement's text (caption + script) with a
-- reviewed correction plan. Media editing and replacement-video generation go through a provider abstraction that
-- is NOT configured in this release (the UI shows «يتطلب إعداداً»); nothing here claims a generated video.
--
-- Rules: feature flag `saleem_fix` (off by default) · only the uploader side (owner/admin/creator, the ad's owner or
-- a partner on its own ad) · open review states only · one active job per advertisement · idempotency key ·
-- monthly organisation quota separate from analysis usage · no automatic retries of chargeable calls · accepting
-- creates a NEW version under the same advertisement (never replaces the original, never inherits an approval)
-- and that version must be analysed before it can be submitted (can_submit already requires a finished analysis).

create table if not exists public.correction_jobs (
  id                    uuid primary key default gen_random_uuid(),
  promotion_id          uuid not null references public.promotions(id) on delete restrict,
  org_id                uuid null references public.organizations(id) on delete set null,
  source_submission_id  uuid not null references public.submissions(id) on delete restrict,
  created_by            uuid not null default auth.uid(),
  method                text not null check (method in ('text_correction', 'media_edit', 'replacement')),
  status                text not null default 'draft' check (status in (
                          'draft', 'generating', 'ready', 'accepting', 'accepted', 'cancelled', 'failed')),
  selected_finding_ids  uuid[] not null default '{}',
  preferences           jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  instructions          text null check (char_length(instructions) <= 3000),
  plan                  jsonb null,
  proposal              jsonb null,
  edited_proposal       jsonb null,
  provider              text null,
  model                 text null,
  estimated_cost_usd    numeric null,
  usage                 jsonb null,
  error_code            text null,
  attempts              integer not null default 0,
  idempotency_key       text not null check (char_length(idempotency_key) between 8 and 100),
  result_submission_id  uuid null references public.submissions(id) on delete set null,
  accepted_by           uuid null,
  accepted_at           timestamptz null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (promotion_id, idempotency_key)
);
create index if not exists correction_jobs_promotion_idx on public.correction_jobs (promotion_id, created_at desc);
create index if not exists correction_jobs_org_month_idx on public.correction_jobs (org_id, created_at);
alter table public.correction_jobs enable row level security;
drop policy if exists correction_jobs_read on public.correction_jobs;
create policy correction_jobs_read on public.correction_jobs for select to authenticated
  using (public.can_read_promotion(promotion_id) and (
    created_by = auth.uid() or coalesce(public.org_role_of(org_id, auth.uid()) in ('owner', 'admin', 'compliance_lead', 'reviewer', 'creator', 'viewer'), false)));
grant select on public.correction_jobs to authenticated;
-- Writes: RPCs below, and the `fix` Edge Function (service role) for plan / proposal / usage.

alter table public.submissions add column if not exists correction_job_id uuid null references public.correction_jobs(id) on delete set null;

-- Who may correct this advertisement (mirrors the uploader side of respond_finding).
create or replace function public.can_fix_promotion(_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.promotions; _role public.org_role; _reasons text[] := '{}'; s public.submissions; _used int; _limit int;
begin
  select * into p from public.promotions where id = _pid;
  if p.id is null or not public.can_read_promotion(_pid) then return jsonb_build_object('ok', false, 'reasons', jsonb_build_array('not_found')); end if;
  _role := case when p.org_id is null then null else public.org_role_of(p.org_id, auth.uid()) end;
  if p.org_id is not null and not public.org_feature(p.org_id, 'saleem_fix') then _reasons := array_append(_reasons, 'feature_off'::text); end if;
  if p.is_demo then _reasons := array_append(_reasons, 'forbidden'::text); end if;
  if not coalesce(p.owner_id = auth.uid() or public.promotion_uploader(_pid) = auth.uid() or _role in ('owner', 'admin', 'creator'), false)
     or _role in ('viewer', 'legal', 'external_reviewer', 'reviewer') then
    _reasons := array_append(_reasons, 'forbidden'::text);
  end if;
  if p.review_status not in ('draft', 'changes_requested', 'rejected', 'conditionally_approved') then _reasons := array_append(_reasons, 'invalid_status'::text); end if;
  select * into s from public.submissions where id = p.current_version_id;
  if s.id is null or s.status <> 'done' then _reasons := array_append(_reasons, 'analysis_not_done'::text); end if;
  _limit := coalesce(nullif((select s2.features->>'saleem_fix_monthly_limit' from public.org_settings s2 where s2.org_id = p.org_id), '')::int, 30);
  select count(*) into _used from public.correction_jobs j
  where j.org_id is not distinct from p.org_id and j.created_at >= date_trunc('month', now())
    and j.status in ('generating', 'ready', 'accepting', 'accepted') and (p.org_id is not null or j.created_by = auth.uid());
  if _used >= _limit then _reasons := array_append(_reasons, 'quota_exhausted'::text); end if;
  return jsonb_build_object('ok', cardinality(_reasons) = 0, 'reasons', to_jsonb(_reasons), 'used', _used, 'limit', _limit,
    'remaining', greatest(_limit - _used, 0));
end $$;

create or replace function public.create_correction_job(_pid uuid, _method text, _findings uuid[], _preferences jsonb,
  _instructions text, _key text)
returns uuid language plpgsql security definer set search_path = '' as $$
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
end $$;

create or replace function public.cancel_correction_job(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare j public.correction_jobs;
begin
  select * into j from public.correction_jobs where id = _id for update;
  if j.id is null or j.created_by <> auth.uid() then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if j.status in ('accepted', 'cancelled') then return; end if;
  update public.correction_jobs set status = 'cancelled', updated_at = now() where id = _id;
end $$;

-- Accepting is two steps so a double click can never create two versions:
-- begin (ready → accepting, atomic) · the client creates the text version · finish (accepting → accepted, linked).
create or replace function public.begin_accept_correction(_id uuid, _edited jsonb)
returns void language plpgsql security definer set search_path = '' as $$
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
end $$;

create or replace function public.finish_accept_correction(_id uuid, _sid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare j public.correction_jobs; s public.submissions;
begin
  select * into j from public.correction_jobs where id = _id for update;
  if j.id is null or j.created_by <> auth.uid() then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if j.status = 'accepted' and j.result_submission_id = _sid then return; end if;
  if j.status <> 'accepting' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  select * into s from public.submissions where id = _sid;
  if s.id is null or s.promotion_id <> j.promotion_id or s.user_id <> auth.uid() or s.created_at < j.created_at then
    raise exception 'code:invalid_version' using errcode = 'P0001';
  end if;
  update public.submissions set correction_job_id = _id where id = _sid;
  update public.correction_jobs set status = 'accepted', result_submission_id = _sid, accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
  where id = _id;
  perform public.log_review_event(j.promotion_id, _sid, 'correction_accepted', null, null,
    jsonb_build_object('job_id', _id, 'source_submission_id', j.source_submission_id, 'provider', j.provider, 'model', j.model));
end $$;

-- Back to «ready» when the version could not be created (network error); nothing was linked.
create or replace function public.abort_accept_correction(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.correction_jobs set status = 'ready', updated_at = now()
  where id = _id and created_by = auth.uid() and status = 'accepting' and result_submission_id is null;
end $$;

revoke all on function public.can_fix_promotion(uuid), public.create_correction_job(uuid, text, uuid[], jsonb, text, text),
  public.cancel_correction_job(uuid), public.begin_accept_correction(uuid, jsonb), public.finish_accept_correction(uuid, uuid),
  public.abort_accept_correction(uuid) from public, anon;
grant execute on function public.can_fix_promotion(uuid), public.create_correction_job(uuid, text, uuid[], jsonb, text, text),
  public.cancel_correction_job(uuid), public.begin_accept_correction(uuid, jsonb), public.finish_accept_correction(uuid, uuid),
  public.abort_accept_correction(uuid) to authenticated;
