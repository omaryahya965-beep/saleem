-- Phase 4: real pipeline support, report integrity and media lifecycle.
-- Additive only: no tables dropped, no user data deleted.

-- ============================================================================
-- 1. No automatic admin on first sign-up (admins are granted explicitly)
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;

-- ============================================================================
-- 2. Rulebook: legal status + source verification flags
-- ============================================================================
alter table public.rules
  add column if not exists legal_status text not null default 'illustrative_pending_review'
    check (legal_status in ('illustrative_pending_review', 'legally_reviewed')),
  add column if not exists source_verified boolean not null default false,
  add column if not exists source_name_en text;

update public.rules set legal_status = 'illustrative_pending_review', source_verified = false;
update public.rules set source_name_en = case
  when source_name like '%موثوق%' then 'Mawthooq platform terms'
  when source_name like '%الهيئة العامة لتنظيم الإعلام%' then 'Content rules – General Authority for Media Regulation'
  when source_name like '%سدايا%' then 'AI principles in media – Ministry of Media & SDAIA'
  when source_name like '%وزارة التجارة%' then 'Social media advertising rules – Ministry of Commerce'
  else source_name end
where source_name_en is null;

-- Only the 12 approved rules stay active; anything else is deactivated (not deleted).
update public.rules set is_active = false
where code not in ('MAW-01','MAW-02','MAW-03','MAW-04','CNT-01','CNT-02','CNT-03','CNT-04','CNT-05','CNT-06','AI-01','COM-01');

-- ============================================================================
-- 3. Run metadata: provider, models, durations, tokens, cost, status
-- ============================================================================
alter table public.analysis_runs
  add column if not exists status text not null default 'running' check (status in ('running', 'done', 'failed')),
  add column if not exists error text,
  add column if not exists llm_provider text,
  add column if not exists asr_provider text,
  add column if not exists durations_ms jsonb not null default '{}',
  add column if not exists cost_usd numeric(10, 5),
  add column if not exists frames_count int,
  add column if not exists on_screen_text jsonb not null default '[]';

alter table public.submissions
  add column if not exists attempts int not null default 0,
  add column if not exists heartbeat_at timestamptz;

update public.ai_settings
set llm_model = 'gpt-6.1-sol', asr_model = 'gpt-4o-transcribe-diarize', prompt_version = 'v2-2026-10', updated_at = now()
where id = 1;
alter table public.ai_settings alter column llm_model set default 'gpt-6.1-sol';
alter table public.ai_settings alter column asr_model set default 'gpt-4o-transcribe-diarize';

-- Demo rows were never produced by a model; label them honestly.
update public.analysis_runs
set llm_model = 'demo-fixture', asr_model = 'demo-fixture', llm_provider = 'demo', asr_provider = 'demo', status = 'done'
where submission_id in (select id from public.submissions where is_demo);

-- ============================================================================
-- 4. Report integrity: only the pipeline (service role) writes results
-- ============================================================================
drop policy if exists "write transcripts" on public.transcripts;
drop policy if exists "write frames" on public.frames;
drop policy if exists "write analysis_runs" on public.analysis_runs;
drop policy if exists "write findings" on public.findings;
drop policy if exists "write compliance_logs" on public.compliance_logs;
revoke insert, update, delete on public.transcripts, public.frames, public.analysis_runs, public.findings, public.compliance_logs from authenticated;

-- Owners may only rename a submission; status changes go through RPCs below.
revoke update on public.submissions from authenticated;
grant update (title) on public.submissions to authenticated;

-- New submissions always start queued, whatever the client sends.
create or replace function public.submissions_force_initial_state()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    new.status := 'queued';
    new.progress := 0;
    new.current_step := 'transcribe';
    new.overall_status := null;
    new.analyzed_at := null;
    new.error_message := null;
    new.media_deleted_at := null;
    new.attempts := 0;
    new.is_demo := false;
    new.user_id := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists submissions_initial_state on public.submissions;
create trigger submissions_initial_state
  before insert on public.submissions
  for each row execute function public.submissions_force_initial_state();

create or replace function public.cancel_submission(_sid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.submissions
  set status = 'failed', error_message = 'cancelled_by_user'
  where id = _sid and user_id = auth.uid() and not is_demo and status not in ('done', 'failed');
  if not found then raise exception 'cannot cancel submission %', _sid using errcode = '42501'; end if;
end $$;

create or replace function public.retry_submission(_sid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.submissions
  set status = 'queued', error_message = null
  where id = _sid and user_id = auth.uid() and not is_demo and status = 'failed' and media_deleted_at is null;
  if not found then raise exception 'cannot retry submission %', _sid using errcode = '42501'; end if;
end $$;

revoke all on function public.cancel_submission(uuid), public.retry_submission(uuid) from public, anon;
grant execute on function public.cancel_submission(uuid), public.retry_submission(uuid) to authenticated;

-- ============================================================================
-- 5. Storage: 25 MB uploads (video, images, audio track, frames)
-- ============================================================================
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'audio/x-wav', 'audio/webm']
where id = 'media';

-- ============================================================================
-- 6. Scheduled media cleanup (hourly) via pg_cron + pg_net.
--    The shared secret is generated inside the database and never leaves it:
--    the function verifies the header by calling verify_cron_secret().
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cleanup_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cleanup_cron_secret');
  end if;
end $$;

create or replace function public.verify_cron_secret(_secret text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'cleanup_cron_secret' and decrypted_secret = _secret)
$$;
revoke all on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'saleem-cleanup-media';
select cron.schedule(
  'saleem-cleanup-media',
  '17 * * * *',
  $cron$
  select net.http_post(
    url := 'https://oxspzxtxvtwswdjqfful.supabase.co/functions/v1/cleanup-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

-- ============================================================================
-- 7. Evaluation results (admin only)
-- ============================================================================
create table if not exists public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  label text not null,
  llm_model text,
  asr_model text,
  prompt_version text,
  rulebook_version text,
  mode text not null default 'text' check (mode in ('text', 'media')),
  summary jsonb not null default '{}',
  per_rule jsonb not null default '{}',
  cases jsonb not null default '[]'
);
grant select on public.eval_runs to authenticated;
grant all on public.eval_runs to service_role;
alter table public.eval_runs enable row level security;
drop policy if exists "admin read eval_runs" on public.eval_runs;
create policy "admin read eval_runs" on public.eval_runs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Helpful indexes for the dashboard and cleanup scans.
create index if not exists submissions_user_created_idx on public.submissions (user_id, created_at desc);
create index if not exists submissions_cleanup_idx on public.submissions (analyzed_at) where media_deleted_at is null;
create index if not exists findings_run_idx on public.findings (run_id);
