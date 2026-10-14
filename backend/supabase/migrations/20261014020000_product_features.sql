-- Phase 5: plans & quotas, archive batches, organizations, sharing & approval, rulebook versions,
-- verifiable logs, notifications, re-run. Additive: nothing dropped except one replaced unique
-- constraint (rules.code → (rulebook_version_id, code)) and replaced policies.

create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- 1. Plans & quotas (limits enforced in the database, not the UI)
-- ============================================================================
create table if not exists public.plans (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  monthly_checks int not null,
  max_clip_seconds int not null default 90,
  max_batch int not null,
  orgs_allowed boolean not null default false,
  sort int not null default 0
);
insert into public.plans (id, name_ar, name_en, monthly_checks, max_clip_seconds, max_batch, orgs_allowed, sort) values
  ('free', 'مجاني', 'Free', 10, 90, 5, false, 1),
  ('creator', 'صانع محتوى', 'Creator', 100, 90, 20, false, 2),
  ('agency', 'وكالة', 'Agency', 1000, 90, 20, true, 3)
on conflict (id) do nothing;
grant select on public.plans to anon, authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;
drop policy if exists "read plans" on public.plans;
create policy "read plans" on public.plans for select to anon, authenticated using (true);

alter table public.profiles
  add column if not exists plan_id text not null default 'free' references public.plans(id),
  add column if not exists preferred_lang text check (preferred_lang in ('ar', 'en')),
  add column if not exists notify_email boolean not null default true;

-- Users may edit their profile, never their plan.
revoke update on public.profiles from authenticated;
grant update (display_name, mawthooq_license_no, platforms, preferred_lang, notify_email) on public.profiles to authenticated;
revoke insert on public.profiles from authenticated;
grant insert (id, display_name, mawthooq_license_no, platforms, preferred_lang, notify_email) on public.profiles to authenticated;

create or replace function public.my_usage()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plan', p.id, 'plan_name_ar', p.name_ar, 'plan_name_en', p.name_en,
    'monthly_checks', p.monthly_checks, 'max_batch', p.max_batch, 'orgs_allowed', p.orgs_allowed,
    'used', (select count(*) from public.submissions s where s.user_id = auth.uid() and s.created_at >= date_trunc('month', now())),
    'period_start', date_trunc('month', now()),
    'period_end', date_trunc('month', now()) + interval '1 month'
  )
  from public.profiles pr join public.plans p on p.id = pr.plan_id
  where pr.id = auth.uid()
$$;
grant execute on function public.my_usage() to authenticated;

-- ============================================================================
-- 2. Organizations (agency workspace)
-- ============================================================================
do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'reviewer', 'creator');
exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_role not null check (role <> 'owner'),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  brand text,
  starts_on date,
  ends_on date,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.org_role_of(_org uuid, _uid uuid default auth.uid())
returns public.org_role language sql stable security definer set search_path = public as $$
  select role from public.org_members where org_id = _org and user_id = _uid
$$;
create or replace function public.is_org_member(_org uuid, _roles public.org_role[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org and user_id = auth.uid() and (_roles is null or role = any(_roles))
  )
$$;

grant select on public.organizations, public.org_members, public.org_invites, public.campaigns to authenticated;
grant insert, update, delete on public.campaigns to authenticated;
grant all on public.organizations, public.org_members, public.org_invites, public.campaigns to service_role;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invites enable row level security;
alter table public.campaigns enable row level security;

drop policy if exists "members read org" on public.organizations;
create policy "members read org" on public.organizations for select to authenticated using (public.is_org_member(id));
drop policy if exists "members read members" on public.org_members;
create policy "members read members" on public.org_members for select to authenticated using (public.is_org_member(org_id));
drop policy if exists "managers read invites" on public.org_invites;
create policy "managers read invites" on public.org_invites for select to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]));
drop policy if exists "members read campaigns" on public.campaigns;
create policy "members read campaigns" on public.campaigns for select to authenticated using (public.is_org_member(org_id));
drop policy if exists "managers write campaigns" on public.campaigns;
create policy "managers write campaigns" on public.campaigns for all to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]))
  with check (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]) and created_by = auth.uid());

create or replace function public.create_organization(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _allowed boolean;
begin
  select p.orgs_allowed into _allowed from public.profiles pr join public.plans p on p.id = pr.plan_id where pr.id = auth.uid();
  if not coalesce(_allowed, false) then raise exception 'plan_no_orgs' using errcode = 'P0001'; end if;
  insert into public.organizations (name, created_by) values (trim(_name), auth.uid()) returning id into _id;
  insert into public.org_members (org_id, user_id, role, display_name, email)
  select _id, auth.uid(), 'owner', pr.display_name, u.email from public.profiles pr join auth.users u on u.id = pr.id where pr.id = auth.uid();
  return _id;
end $$;

create or replace function public.create_org_invite(_org uuid, _email text, _role public.org_role)
returns text language plpgsql security definer set search_path = public as $$
declare _token text;
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  if _role = 'owner' then raise exception 'invalid_role' using errcode = 'P0001'; end if;
  insert into public.org_invites (org_id, email, role, invited_by) values (_org, lower(trim(_email)), _role, auth.uid()) returning token into _token;
  return _token;
end $$;

create or replace function public.accept_org_invite(_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _inv public.org_invites; _email text;
begin
  select email into _email from auth.users where id = auth.uid();
  select * into _inv from public.org_invites where token = _token and accepted_at is null and revoked_at is null and expires_at > now();
  if _inv.id is null then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
  if lower(_inv.email) <> lower(_email) then raise exception 'invite_email_mismatch' using errcode = 'P0001'; end if;
  insert into public.org_members (org_id, user_id, role, display_name, email)
  select _inv.org_id, auth.uid(), _inv.role, pr.display_name, _email from public.profiles pr where pr.id = auth.uid()
  on conflict (org_id, user_id) do update set role = excluded.role;
  update public.org_invites set accepted_at = now(), accepted_by = auth.uid() where id = _inv.id;
  return _inv.org_id;
end $$;

create or replace function public.revoke_org_invite(_invite uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.org_invites set revoked_at = now()
  where id = _invite and public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]);
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create or replace function public.set_org_member_role(_org uuid, _user uuid, _role public.org_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  if _role = 'owner' and public.org_role_of(_org) <> 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.org_role_of(_org, _user) = 'owner' and (select count(*) from public.org_members where org_id = _org and role = 'owner') = 1 and _role <> 'owner' then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  update public.org_members set role = _role where org_id = _org and user_id = _user;
end $$;

create or replace function public.remove_org_member(_org uuid, _user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _user <> auth.uid() and not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.org_role_of(_org, _user) = 'owner' and (select count(*) from public.org_members where org_id = _org and role = 'owner') = 1 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  delete from public.org_members where org_id = _org and user_id = _user;
end $$;

revoke all on function public.create_organization(text), public.create_org_invite(uuid, text, public.org_role),
  public.accept_org_invite(text), public.revoke_org_invite(uuid), public.set_org_member_role(uuid, uuid, public.org_role),
  public.remove_org_member(uuid, uuid) from public, anon;
grant execute on function public.create_organization(text), public.create_org_invite(uuid, text, public.org_role),
  public.accept_org_invite(text), public.revoke_org_invite(uuid), public.set_org_member_role(uuid, uuid, public.org_role),
  public.remove_org_member(uuid, uuid) to authenticated;

-- ============================================================================
-- 3. Archive batches + submission scoping (org, campaign, batch)
-- ============================================================================
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.batches to authenticated;
grant all on public.batches to service_role;
alter table public.batches enable row level security;
drop policy if exists "own batches" on public.batches;
create policy "own batches" on public.batches for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.submissions
  add column if not exists org_id uuid references public.organizations(id) on delete set null,
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists batch_id uuid references public.batches(id) on delete set null;
create index if not exists submissions_org_idx on public.submissions (org_id, created_at desc);
create index if not exists submissions_campaign_idx on public.submissions (campaign_id);
create index if not exists submissions_batch_idx on public.submissions (batch_id);

-- Readers: owner, demo, or org owner/admin/reviewer.
create or replace function public.can_read_submission(_sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.submissions s
    where s.id = _sid and (
      s.is_demo or s.user_id = auth.uid()
      or (s.org_id is not null and public.is_org_member(s.org_id, array['owner', 'admin', 'reviewer']::public.org_role[]))
    )
  )
$$;
drop policy if exists "org read submissions" on public.submissions;
create policy "org read submissions" on public.submissions for select to authenticated
  using (org_id is not null and public.is_org_member(org_id, array['owner', 'admin', 'reviewer']::public.org_role[]));

drop policy if exists "org media read" on storage.objects;
create policy "org media read" on storage.objects for select to authenticated using (
  bucket_id = 'media' and exists (
    select 1 from public.submissions s
    where s.id::text = (storage.foldername(name))[2] and s.org_id is not null
      and public.is_org_member(s.org_id, array['owner', 'admin', 'reviewer']::public.org_role[])
  )
);

-- Initial state + quota + scoping checks on insert (cannot be bypassed from the client).
create or replace function public.submissions_force_initial_state()
returns trigger language plpgsql security definer set search_path = public as $$
declare _plan public.plans; _used int; _batch_count int;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return new; end if;
  new.status := 'queued'; new.progress := 0; new.current_step := 'transcribe'; new.overall_status := null;
  new.analyzed_at := null; new.error_message := null; new.media_deleted_at := null; new.attempts := 0;
  new.is_demo := false; new.user_id := auth.uid();

  select p.* into _plan from public.profiles pr join public.plans p on p.id = pr.plan_id where pr.id = auth.uid();
  select count(*) into _used from public.submissions where user_id = auth.uid() and created_at >= date_trunc('month', now());
  if _plan.id is not null and _used >= _plan.monthly_checks then
    raise exception 'quota_exceeded' using errcode = 'P0001', hint = format('%s/%s', _used, _plan.monthly_checks);
  end if;
  if _plan.id is not null and coalesce(new.duration_seconds, 0) > _plan.max_clip_seconds + 0.5 then
    raise exception 'clip_too_long' using errcode = 'P0001';
  end if;
  if new.batch_id is not null then
    if not exists (select 1 from public.batches where id = new.batch_id and user_id = auth.uid()) then raise exception 'forbidden' using errcode = '42501'; end if;
    select count(*) into _batch_count from public.submissions where batch_id = new.batch_id;
    if _batch_count >= coalesce(_plan.max_batch, 20) then raise exception 'batch_full' using errcode = 'P0001'; end if;
  end if;
  if new.org_id is not null and not public.is_org_member(new.org_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if new.campaign_id is not null and not exists (select 1 from public.campaigns c where c.id = new.campaign_id and c.org_id = new.org_id) then
    raise exception 'campaign_mismatch' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ============================================================================
-- 4. Rulebook versions: draft → legal_review → published (→ archived)
-- ============================================================================
alter table public.rulebook_versions
  add column if not exists status text not null default 'draft' check (status in ('draft', 'legal_review', 'published', 'archived')),
  add column if not exists effective_from date,
  add column if not exists changelog text,
  add column if not exists published_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null;
update public.rulebook_versions set status = 'published', published_at = coalesce(published_at, created_at), effective_from = coalesce(effective_from, created_at::date)
where is_active;

alter table public.rules drop constraint if exists rules_code_key;
create unique index if not exists rules_version_code_key on public.rules (rulebook_version_id, code);

drop policy if exists "public read rulebook_versions" on public.rulebook_versions;
create policy "public read rulebook_versions" on public.rulebook_versions for select to anon, authenticated
  using (status in ('published', 'archived') or public.has_role(auth.uid(), 'admin'));
drop policy if exists "admin write rulebook_versions" on public.rulebook_versions;
create policy "admin write rulebook_versions" on public.rulebook_versions for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
grant insert, update on public.rulebook_versions to authenticated;

drop policy if exists "public read rules" on public.rules;
create policy "public read rules" on public.rules for select to anon, authenticated using (
  exists (select 1 from public.rulebook_versions v where v.id = rulebook_version_id and v.status in ('published', 'archived'))
  or public.has_role(auth.uid(), 'admin')
);
drop policy if exists "admin write rules" on public.rules;
create policy "admin write rules" on public.rules for all to authenticated
  using (public.has_role(auth.uid(), 'admin')
         and exists (select 1 from public.rulebook_versions v where v.id = rulebook_version_id and v.status in ('draft', 'legal_review')))
  with check (public.has_role(auth.uid(), 'admin')
         and exists (select 1 from public.rulebook_versions v where v.id = rulebook_version_id and v.status in ('draft', 'legal_review')));
grant insert, update, delete on public.rules to authenticated;

create or replace function public.create_rulebook_draft(_label text, _notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _new uuid; _src uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into _src from public.rulebook_versions where is_active limit 1;
  insert into public.rulebook_versions (version_label, notes, status, created_by) values (_label, _notes, 'draft', auth.uid()) returning id into _new;
  insert into public.rules (code, rulebook_version_id, category, title_ar, title_en, description_ar, description_en, source_name, source_name_en,
    source_url, source_date, check_type, default_severity, llm_instructions, applies_to_categories, is_active, legal_status, source_verified)
  select code, _new, category, title_ar, title_en, description_ar, description_en, source_name, source_name_en,
    source_url, source_date, check_type, default_severity, llm_instructions, applies_to_categories, is_active, legal_status, source_verified
  from public.rules where rulebook_version_id = _src;
  return _new;
end $$;

create or replace function public.set_rulebook_status(_version uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if _status not in ('draft', 'legal_review', 'published') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if _status = 'published' then
    update public.rulebook_versions set status = 'archived', is_active = false where is_active and id <> _version;
    update public.rulebook_versions set status = 'published', is_active = true, published_at = now(), effective_from = coalesce(effective_from, current_date) where id = _version;
  else
    update public.rulebook_versions set status = _status where id = _version and status in ('draft', 'legal_review');
  end if;
end $$;
revoke all on function public.create_rulebook_draft(text, text), public.set_rulebook_status(uuid, text) from public, anon;
grant execute on function public.create_rulebook_draft(text, text), public.set_rulebook_status(uuid, text) to authenticated;

-- Re-run a finished check on the latest published rulebook (keeps previous runs).
create or replace function public.rerun_submission(_sid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.submissions set status = 'queued', progress = 0, error_message = null, overall_status = null
  where id = _sid and user_id = auth.uid() and not is_demo and status in ('done', 'failed');
  if not found then raise exception 'cannot rerun submission %', _sid using errcode = '42501'; end if;
end $$;
revoke all on function public.rerun_submission(uuid) from public, anon;
grant execute on function public.rerun_submission(uuid) to authenticated;

-- ============================================================================
-- 5. Verifiable compliance logs: sealed report hash + public verification
-- ============================================================================
alter table public.compliance_logs add column if not exists report_hash text;

create or replace function public.compute_report_hash(_sid uuid)
returns text language sql stable security definer set search_path = public, extensions as $$
  with run as (
    select id, coalesce(rulebook_version, '') as rv from public.analysis_runs
    where submission_id = _sid order by started_at desc limit 1
  )
  select encode(extensions.digest(
    concat_ws('|',
      _sid::text,
      (select coalesce(sha256, '') from public.submissions where id = _sid),
      (select coalesce(overall_status::text, '') from public.submissions where id = _sid),
      (select rv from run),
      coalesce((select string_agg(concat_ws(':', f.rule_code, f.severity, coalesce(f.t_start::text, '-'), coalesce(f.evidence_text, '')), ';'
                         order by f.rule_code, f.t_start nulls last, f.evidence_text)
                from public.findings f where f.run_id = (select id from run)), '')
    ), 'sha256'), 'hex')
$$;
revoke all on function public.compute_report_hash(uuid) from public, anon, authenticated;
grant execute on function public.compute_report_hash(uuid) to service_role;

create or replace function public.seal_compliance_log(_sid uuid)
returns void language sql security definer set search_path = public as $$
  update public.compliance_logs set report_hash = public.compute_report_hash(_sid), generated_at = now() where submission_id = _sid
$$;
revoke all on function public.seal_compliance_log(uuid) from public, anon, authenticated;
grant execute on function public.seal_compliance_log(uuid) to service_role;

-- Public: minimal, non-identifying facts. No title, caption, transcript or user.
create or replace function public.verify_compliance_log(_sid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when s.id is null or l.submission_id is null then jsonb_build_object('found', false)
  else jsonb_build_object(
    'found', true,
    'status', s.status,
    'overall_status', s.overall_status,
    'analyzed_at', s.analyzed_at,
    'platform', s.platform,
    'kind', s.kind,
    'is_demo', s.is_demo,
    'content_hash', l.content_hash,
    'report_hash', l.report_hash,
    'sealed_at', l.generated_at,
    'unchanged', l.report_hash is not null and l.report_hash = public.compute_report_hash(s.id),
    'rulebook_version', (select rulebook_version from public.analysis_runs r where r.submission_id = s.id order by started_at desc limit 1),
    'violations', (select count(*) from public.findings f join public.analysis_runs r on r.id = f.run_id
                   where f.submission_id = s.id and r.id = (select id from public.analysis_runs where submission_id = s.id order by started_at desc limit 1) and f.severity = 'violation'),
    'warnings', (select count(*) from public.findings f join public.analysis_runs r on r.id = f.run_id
                   where f.submission_id = s.id and r.id = (select id from public.analysis_runs where submission_id = s.id order by started_at desc limit 1) and f.severity = 'warning')
  ) end
  from (select _sid as id) q
  left join public.submissions s on s.id = q.id
  left join public.compliance_logs l on l.submission_id = s.id
$$;
grant execute on function public.verify_compliance_log(uuid) to anon, authenticated;

-- Seal existing logs (demo data) so they verify.
update public.compliance_logs set report_hash = public.compute_report_hash(submission_id) where report_hash is null;

-- ============================================================================
-- 6. Brand sharing & approval
-- ============================================================================
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create table if not exists public.share_reviews (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.share_links(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  decision text not null check (decision in ('approved', 'changes_requested', 'comment')),
  comment text check (length(comment) <= 2000),
  reviewer_name text not null check (length(trim(reviewer_name)) between 1 and 80),
  created_at timestamptz not null default now()
);
grant select on public.share_links, public.share_reviews to authenticated;
grant all on public.share_links, public.share_reviews to service_role;
alter table public.share_links enable row level security;
alter table public.share_reviews enable row level security;
drop policy if exists "owner read share_links" on public.share_links;
create policy "owner read share_links" on public.share_links for select to authenticated using (public.can_read_submission(submission_id));
drop policy if exists "owner read share_reviews" on public.share_reviews;
create policy "owner read share_reviews" on public.share_reviews for select to authenticated using (public.can_read_submission(submission_id));

create or replace function public.create_share_link(_sid uuid, _days int default 7)
returns text language plpgsql security definer set search_path = public as $$
declare _token text;
begin
  if not exists (select 1 from public.submissions where id = _sid and status = 'done' and (user_id = auth.uid()
      or (org_id is not null and public.is_org_member(org_id, array['owner', 'admin']::public.org_role[])))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.share_links (submission_id, created_by, expires_at)
  values (_sid, auth.uid(), now() + make_interval(days => greatest(1, least(coalesce(_days, 7), 30))))
  returning token into _token;
  return _token;
end $$;

create or replace function public.revoke_share_link(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.share_links set revoked_at = now() where id = _id and created_by = auth.uid();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

-- Read-only report for a valid link (anon). Never exposes the user, media or transcript.
create or replace function public.get_shared_report(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  with l as (
    select * from public.share_links where token = _token and revoked_at is null and expires_at > now()
  ), s as (
    select * from public.submissions where id = (select submission_id from l)
  ), run as (
    select * from public.analysis_runs where submission_id = (select id from s) order by started_at desc limit 1
  )
  select case when not exists (select 1 from l) then jsonb_build_object('valid', false) else jsonb_build_object(
    'valid', true,
    'expires_at', (select expires_at from l),
    'submission', (select jsonb_build_object('id', id, 'title', title, 'kind', kind, 'platform', platform, 'caption', caption,
                   'overall_status', overall_status, 'analyzed_at', analyzed_at, 'duration_seconds', duration_seconds) from s),
    'rulebook_version', (select rulebook_version from run),
    'findings', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'rule_code', f.rule_code, 'severity', f.severity, 't_start', f.t_start,
                  'evidence_type', f.evidence_type, 'evidence_text', f.evidence_text, 'explanation_ar', f.explanation_ar,
                  'explanation_en', f.explanation_en, 'fix_ar', f.fix_ar, 'fix_en', f.fix_en) order by f.t_start nulls last)
                  from public.findings f where f.run_id = (select id from run)), '[]'::jsonb),
    'rules', coalesce((select jsonb_agg(jsonb_build_object('code', r.code, 'title_ar', r.title_ar, 'title_en', r.title_en,
                  'source_name', r.source_name, 'source_name_en', r.source_name_en, 'source_url', r.source_url))
                  from public.rules r where r.rulebook_version_id = (select rulebook_version_id from run)), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('decision', decision, 'comment', comment, 'reviewer_name', reviewer_name,
                  'created_at', created_at) order by created_at) from public.share_reviews where share_link_id = (select id from l)), '[]'::jsonb)
  ) end
$$;

create or replace function public.submit_share_review(_token text, _decision text, _comment text, _name text)
returns void language plpgsql security definer set search_path = public as $$
declare _l public.share_links;
begin
  select * into _l from public.share_links where token = _token and revoked_at is null and expires_at > now();
  if _l.id is null then raise exception 'link_invalid' using errcode = 'P0001'; end if;
  if (select count(*) from public.share_reviews where share_link_id = _l.id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.share_reviews (share_link_id, submission_id, decision, comment, reviewer_name)
  values (_l.id, _l.submission_id, _decision, nullif(trim(_comment), ''), trim(_name));
  insert into public.notifications (user_id, kind, submission_id, payload)
  select user_id, 'share_review', _l.submission_id, jsonb_build_object('decision', _decision, 'reviewer', trim(_name))
  from public.submissions where id = _l.submission_id and user_id is not null;
end $$;

-- ============================================================================
-- 7. Notifications (in-app; email delivery handled by the notify provider)
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('check_done', 'check_failed', 'share_review', 'org_invite')),
  submission_id uuid references public.submissions(id) on delete cascade,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on function public.create_share_link(uuid, int), public.revoke_share_link(uuid) from public, anon;
grant execute on function public.create_share_link(uuid, int), public.revoke_share_link(uuid) to authenticated;
grant execute on function public.get_shared_report(text), public.submit_share_review(text, text, text, text) to anon, authenticated;
