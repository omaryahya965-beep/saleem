-- SALEEM Database Schema
-- Migration: 20261013000000_saleem_schema.sql

-- ============================================================================
-- 1. Custom Types & Enumerations
-- ============================================================================
create type public.app_role as enum ('admin', 'user');
create type public.rule_category as enum ('mawthooq', 'content', 'ai', 'commerce');
create type public.check_type as enum ('audio', 'visual', 'text', 'metadata', 'hybrid');
create type public.severity as enum ('violation', 'warning');
create type public.submission_kind as enum ('video', 'image', 'text');
create type public.submission_status as enum ('queued', 'extracting', 'transcribing', 'analyzing', 'done', 'failed');
create type public.overall_status as enum ('ready', 'needs_fixes', 'review');
create type public.evidence_type as enum ('transcript', 'frame', 'caption', 'metadata');
create type public.finding_source as enum ('deterministic', 'llm');
create type public.platform as enum ('snapchat', 'tiktok', 'instagram', 'x', 'youtube');
create type public.product_category as enum ('food', 'health', 'beauty', 'finance', 'real_estate', 'other');
create type public.pipeline_step as enum ('transcribe', 'deterministic', 'llm', 'merge', 'done');

-- ============================================================================
-- 2. User Profiles & Roles
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  mawthooq_license_no text,
  platforms public.platform[] not null default '{}',
  created_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- New user trigger: profile creation and initial role assignment
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  
  insert into public.user_roles (user_id, role)
  values (new.id, 'user');
  
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 3. Rulebook Management
-- ============================================================================
create table public.rulebook_versions (
  id uuid primary key default gen_random_uuid(),
  version_label text not null unique,
  notes text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

grant select on public.rulebook_versions to anon, authenticated;
grant all on public.rulebook_versions to service_role;
alter table public.rulebook_versions enable row level security;

create policy "public read rulebook_versions" on public.rulebook_versions
  for select to anon, authenticated using (true);

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rulebook_version_id uuid not null references public.rulebook_versions(id) on delete cascade,
  category public.rule_category not null,
  title_ar text not null,
  title_en text not null,
  description_ar text not null,
  description_en text not null,
  source_name text not null,
  source_url text not null,
  source_date text,
  check_type public.check_type not null,
  default_severity public.severity not null,
  llm_instructions text not null,
  applies_to_categories public.product_category[] not null default '{}',
  is_active boolean not null default true
);

grant select on public.rules to anon, authenticated;
grant all on public.rules to service_role;
alter table public.rules enable row level security;

create policy "public read rules" on public.rules
  for select to anon, authenticated using (true);

-- ============================================================================
-- 4. AI & Pipeline Configuration
-- ============================================================================
create table public.ai_settings (
  id int primary key default 1 check (id = 1),
  llm_model text not null default 'claude-3-5-sonnet-20241022',
  asr_model text not null default 'whisper-1',
  frames_to_llm int not null default 24,
  prompt_version text not null default 'v1',
  updated_at timestamptz not null default now()
);

grant select on public.ai_settings to authenticated;
grant update on public.ai_settings to authenticated;
grant all on public.ai_settings to service_role;
alter table public.ai_settings enable row level security;

create policy "read settings" on public.ai_settings
  for select to authenticated using (true);
create policy "admin update settings" on public.ai_settings
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));

insert into public.ai_settings (id) values (1) on conflict (id) do nothing;

-- ============================================================================
-- 5. Submissions
-- ============================================================================
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  kind public.submission_kind not null,
  file_path text,
  audio_path text,
  text_content text,
  caption text not null default '',
  platform public.platform not null,
  product_category public.product_category not null,
  is_paid_ad boolean not null default false,
  has_written_contract boolean not null default false,
  ai_used boolean not null default false,
  mawthooq_license_no text,
  parent_id uuid references public.submissions(id) on delete set null,
  sha256 text,
  duration_seconds numeric,
  status public.submission_status not null default 'queued',
  progress int not null default 0,
  current_step public.pipeline_step not null default 'transcribe',
  overall_status public.overall_status,
  error_message text,
  thumbnail_path text,
  title text,
  created_at timestamptz not null default now(),
  analyzed_at timestamptz,
  media_deleted_at timestamptz
);

grant select on public.submissions to anon;
grant select, insert, update, delete on public.submissions to authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;

create policy "demo read submissions" on public.submissions
  for select to anon, authenticated using (is_demo);
create policy "own read submissions" on public.submissions
  for select to authenticated using (user_id = auth.uid());
create policy "own insert submissions" on public.submissions
  for insert to authenticated with check (user_id = auth.uid() and not is_demo);
create policy "own update submissions" on public.submissions
  for update to authenticated using (user_id = auth.uid() and not is_demo);
create policy "own delete submissions" on public.submissions
  for delete to authenticated using (user_id = auth.uid() and not is_demo);

create or replace function public.can_read_submission(_sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.submissions s
    where s.id = _sid and (s.is_demo or s.user_id = auth.uid())
  )
$$;

create or replace function public.owns_submission(_sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.submissions s
    where s.id = _sid and s.user_id = auth.uid() and not s.is_demo
  )
$$;

-- ============================================================================
-- 6. Transcripts, Frames, Analysis Runs & Findings
-- ============================================================================
create table public.transcripts (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  full_text text not null default '',
  segments jsonb not null default '[]',
  language text default 'ar',
  provider text
);

grant select on public.transcripts to anon;
grant select, insert, update, delete on public.transcripts to authenticated;
grant all on public.transcripts to service_role;
alter table public.transcripts enable row level security;

create policy "read transcripts" on public.transcripts
  for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write transcripts" on public.transcripts
  for all to authenticated
  using (public.owns_submission(submission_id))
  with check (public.owns_submission(submission_id));

create table public.frames (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  t_seconds numeric not null,
  image_path text,
  ocr_text text
);

grant select on public.frames to anon;
grant select, insert, update, delete on public.frames to authenticated;
grant all on public.frames to service_role;
alter table public.frames enable row level security;

create policy "read frames" on public.frames
  for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write frames" on public.frames
  for all to authenticated
  using (public.owns_submission(submission_id))
  with check (public.owns_submission(submission_id));

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  rulebook_version_id uuid references public.rulebook_versions(id) on delete set null,
  rulebook_version text,
  llm_model text,
  asr_model text,
  prompt_version text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  step_outputs jsonb not null default '{}',
  raw_llm_output jsonb,
  token_usage jsonb
);

grant select on public.analysis_runs to anon;
grant select, insert, update, delete on public.analysis_runs to authenticated;
grant all on public.analysis_runs to service_role;
alter table public.analysis_runs enable row level security;

create policy "read analysis_runs" on public.analysis_runs
  for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write analysis_runs" on public.analysis_runs
  for all to authenticated
  using (public.owns_submission(submission_id))
  with check (public.owns_submission(submission_id));

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  rule_code text not null,
  severity public.severity not null,
  t_start numeric,
  t_end numeric,
  evidence_type public.evidence_type not null,
  evidence_text text,
  evidence_frame_id uuid references public.frames(id) on delete set null,
  explanation_ar text,
  explanation_en text,
  fix_ar text,
  fix_en text,
  confidence numeric not null default 0.5,
  source public.finding_source not null
);

grant select on public.findings to anon;
grant select, insert, update, delete on public.findings to authenticated;
grant all on public.findings to service_role;
alter table public.findings enable row level security;

create policy "read findings" on public.findings
  for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write findings" on public.findings
  for all to authenticated
  using (public.owns_submission(submission_id))
  with check (public.owns_submission(submission_id));

create table public.compliance_logs (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  content_hash text not null,
  generated_at timestamptz not null default now()
);

grant select on public.compliance_logs to anon;
grant select, insert, update, delete on public.compliance_logs to authenticated;
grant all on public.compliance_logs to service_role;
alter table public.compliance_logs enable row level security;

create policy "read compliance_logs" on public.compliance_logs
  for select to anon, authenticated using (public.can_read_submission(submission_id));
create policy "write compliance_logs" on public.compliance_logs
  for all to authenticated
  using (public.owns_submission(submission_id))
  with check (public.owns_submission(submission_id));

create table public.eval_cases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  submission_id uuid references public.submissions(id) on delete set null,
  expected jsonb not null default '[]',
  created_by uuid not null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.eval_cases to authenticated;
grant all on public.eval_cases to service_role;
alter table public.eval_cases enable row level security;

create policy "admin all eval_cases" on public.eval_cases
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 7. Storage Bucket & Policies
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800, array['video/*', 'image/*', 'audio/*'])
on conflict (id) do nothing;

create policy "own media read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own media write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 8. Media Cleanup Function
-- ============================================================================
create or replace function public.delete_submission_media(_sid uuid)
returns void language plpgsql security definer set search_path = public as $$
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
$$;
