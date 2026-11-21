-- SALEEM AI Studio — استوديو سَليم الذكي (D207). Drafts of AI-assisted advertisements and per-capability AI usage.
-- A draft is private to its creator until accepted; accepting creates a normal promotion + version through the
-- existing paths (RLS «promotions_insert», createSubmission), so analysis, review and approval are unchanged and a
-- generated ad is never approved automatically. Media are rendered in the browser and uploaded only on acceptance.

create table if not exists public.studio_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mode text not null default 'create' check (mode in ('create', 'replacement')),
  source_promotion_id uuid references public.promotions(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  brief jsonb not null default '{}'::jsonb,
  script jsonb,
  review jsonb,
  status text not null default 'brief'
    check (status in ('brief', 'generating', 'script_ready', 'reviewed', 'rendered', 'accepted', 'discarded', 'failed')),
  script_provider text check (script_provider in ('gemini', 'template', 'manual')),
  voice_provider text,
  render_provider text,
  error_code text,
  attempts integer not null default 0 check (attempts >= 0),
  result_promotion_id uuid references public.promotions(id) on delete set null,
  result_submission_id uuid references public.submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_brief_object check (jsonb_typeof(brief) = 'object'),
  constraint studio_brief_size check (pg_column_size(brief) < 64000),
  constraint studio_script_size check (script is null or pg_column_size(script) < 128000)
);
create index if not exists studio_drafts_owner on public.studio_drafts (created_by, updated_at desc);
alter table public.studio_drafts enable row level security;

-- Who may create advertisements in an organisation (same roles as «promotions_insert»).
create or replace function public.can_use_studio(_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (_org is null or public.is_org_member(_org, array['owner', 'admin', 'creator']::public.org_role[]))
$$;
grant execute on function public.can_use_studio(uuid) to authenticated;

drop policy if exists studio_drafts_select on public.studio_drafts;
create policy studio_drafts_select on public.studio_drafts for select to authenticated
  using (created_by = auth.uid());
drop policy if exists studio_drafts_insert on public.studio_drafts;
create policy studio_drafts_insert on public.studio_drafts for insert to authenticated
  with check (created_by = auth.uid() and status = 'brief' and public.can_use_studio(org_id)
    and (source_promotion_id is null or exists (select 1 from public.promotions p where p.id = source_promotion_id and p.owner_id = auth.uid())));
-- The creator edits the brief and the script of an open draft; status changes that matter go through RPCs or the
-- service role (generation), and accepted / discarded drafts are frozen.
drop policy if exists studio_drafts_update on public.studio_drafts;
create policy studio_drafts_update on public.studio_drafts for update to authenticated
  using (created_by = auth.uid() and status not in ('accepted', 'discarded', 'generating'))
  with check (created_by = auth.uid() and status in ('brief', 'script_ready', 'reviewed', 'rendered', 'failed') and public.can_use_studio(org_id));
revoke delete on public.studio_drafts from authenticated;

create or replace function public.studio_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  -- Client edits can never mark a draft accepted or attach someone else's promotion. current_user (not the «role»
  -- setting) is checked: inside SECURITY DEFINER RPCs such as accept_studio_draft it is the function owner.
  if current_user = 'authenticated' then
    new.result_promotion_id := old.result_promotion_id;
    new.result_submission_id := old.result_submission_id;
    new.attempts := old.attempts;
    new.created_by := old.created_by;
    new.org_id := old.org_id;
    new.mode := old.mode;
    new.source_promotion_id := old.source_promotion_id;
  end if;
  return new;
end $$;
drop trigger if exists studio_touch on public.studio_drafts;
create trigger studio_touch before update on public.studio_drafts for each row execute function public.studio_touch();

-- Acceptance: link the promotion and version the creator just made through the normal paths.
create or replace function public.accept_studio_draft(_id uuid, _promotion uuid, _submission uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.studio_drafts; p public.promotions; s public.submissions;
begin
  select * into d from public.studio_drafts where id = _id for update;
  if d.id is null or d.created_by <> auth.uid() then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if d.status = 'accepted' and d.result_submission_id = _submission then return; end if; -- idempotent
  if d.status <> 'rendered' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  select * into p from public.promotions where id = _promotion;
  select * into s from public.submissions where id = _submission;
  if p.id is null or s.id is null or s.promotion_id <> p.id or s.user_id <> auth.uid() or s.kind <> 'video' then
    raise exception 'code:invalid_result' using errcode = 'P0001';
  end if;
  if d.mode = 'replacement' and p.id <> d.source_promotion_id then raise exception 'code:invalid_result' using errcode = 'P0001'; end if;
  if p.owner_id <> auth.uid() and d.mode = 'create' then raise exception 'code:invalid_result' using errcode = 'P0001'; end if;
  update public.studio_drafts set status = 'accepted', result_promotion_id = p.id, result_submission_id = s.id, updated_at = now() where id = _id;
  perform public.log_review_event(p.id, s.id, 'studio_accepted', p.review_status::text, p.review_status::text,
    jsonb_build_object('draft_id', d.id, 'mode', d.mode, 'script_provider', d.script_provider, 'voice_provider', d.voice_provider,
      'render_provider', d.render_provider));
end $$;
revoke all on function public.accept_studio_draft(uuid, uuid, uuid) from public, anon;
grant execute on function public.accept_studio_draft(uuid, uuid, uuid) to authenticated;

create or replace function public.discard_studio_draft(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.studio_drafts set status = 'discarded', updated_at = now()
  where id = _id and created_by = auth.uid() and status not in ('accepted', 'generating');
  if not found then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.discard_studio_draft(uuid) from public, anon;
grant execute on function public.discard_studio_draft(uuid) to authenticated;

-- Per-capability AI usage and organisation quotas. Rows are written by Edge Functions (service role) only.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  capability text not null check (capability in ('analysis', 'script', 'correction', 'voice', 'image', 'video')),
  provider text not null,
  model text,
  units numeric not null default 1,
  est_cost_usd numeric,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_org_month on public.ai_usage (org_id, capability, created_at);
create index if not exists ai_usage_user_month on public.ai_usage (user_id, capability, created_at);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (user_id = auth.uid() or (org_id is not null and public.is_org_member(org_id, array['owner', 'admin']::public.org_role[])));
revoke insert, update, delete on public.ai_usage from authenticated, anon;

-- Monthly allowance for one capability. Defaults are conservative; owners/admins set features.ai_limits.<capability>.
-- Image and video generation default to 0 (no provider is configured). Personal accounts use the defaults per user.
create or replace function public.ai_allowance(_org uuid, _capability text, _user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare _limit integer; _used integer; _u uuid := coalesce(_user, auth.uid()); _f jsonb;
begin
  if _capability not in ('analysis', 'script', 'correction', 'voice', 'image', 'video') then
    raise exception 'code:invalid_capability' using errcode = 'P0001';
  end if;
  select features into _f from public.org_settings where org_id = _org;
  _limit := coalesce((_f->'ai_limits'->>_capability)::integer,
    case _capability when 'script' then 60 when 'correction' then 30 when 'voice' then 60 when 'analysis' then 200 else 0 end);
  select count(*) into _used from public.ai_usage
  where capability = _capability and created_at >= date_trunc('month', now())
    and (case when _org is null then org_id is null and user_id = _u else org_id = _org end);
  return jsonb_build_object('ok', _used < _limit, 'used', _used, 'limit', _limit, 'capability', _capability);
end $$;
revoke all on function public.ai_allowance(uuid, text, uuid) from public, anon;
grant execute on function public.ai_allowance(uuid, text, uuid) to authenticated, service_role;

create or replace function public.set_ai_limit(_org uuid, _capability text, _limit integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _capability not in ('analysis', 'script', 'correction', 'voice', 'image', 'video') or _limit < 0 or _limit > 100000 then
    raise exception 'code:invalid_limit' using errcode = 'P0001';
  end if;
  insert into public.org_settings (org_id, features) values (_org, jsonb_build_object('ai_limits', jsonb_build_object(_capability, _limit)))
  on conflict (org_id) do update set features = coalesce(public.org_settings.features, '{}'::jsonb)
    || jsonb_build_object('ai_limits', coalesce(public.org_settings.features->'ai_limits', '{}'::jsonb) || jsonb_build_object(_capability, _limit));
end $$;
revoke all on function public.set_ai_limit(uuid, text, integer) from public, anon;
grant execute on function public.set_ai_limit(uuid, text, integer) to authenticated;
