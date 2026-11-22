-- V2 — Personal accounts and regulatory authority selection (D211).
-- An individual (content creator, freelancer, ordinary user) works in a PERSONAL WORKSPACE: their own promotions
-- (org_id is null, owner_id = the user), which already existed as the «personal account» scope. This migration makes
-- the workspace explicit and separate from organisation membership: it is not an organisation and not a tenth role.
-- The nine organisation roles, org_members, org_can and every enterprise RPC are unchanged; personal promotions keep
-- being refused by the review/approval RPCs (code:not_found / personal_promotion), so a personal account has no human
-- approval workflow and can never produce an «approved» decision.

-- ---- Authorities ---------------------------------------------------------------------------------------------
create or replace function public.valid_authorities(_a text[])
returns boolean language sql immutable set search_path = '' as $$
  select _a is null or (_a <@ array['GMEDIA', 'MC', 'SDAIA', 'SFDA', 'SAMA', 'CMA', 'IA', 'MT', 'REGA', 'MOHU']::text[]
    and cardinality(_a) <= 10)
$$;

-- ---- Personal workspace ----------------------------------------------------------------------------------------
create table if not exists public.personal_workspaces (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  display_name        text null check (display_name is null or char_length(display_name) between 1 and 80),
  -- The shared public individual demo (sandbox); set only by the demo seed (service role).
  is_demo             boolean not null default false,
  -- Authorities the user usually advertises under (pre-selected on a new check; never a rule activation).
  default_authorities text[] not null default '{}' check (public.valid_authorities(default_authorities)),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.personal_workspaces enable row level security;
revoke all on public.personal_workspaces from anon, authenticated;
grant select on public.personal_workspaces to authenticated;
grant all on public.personal_workspaces to service_role;
drop policy if exists personal_workspaces_own on public.personal_workspaces;
create policy personal_workspaces_own on public.personal_workspaces for select to authenticated using (user_id = auth.uid());

-- Existing personal accounts keep working: every user without an organisation membership, and every user who owns
-- personal promotions or submissions, gets their workspace (demo sandbox members excluded).
insert into public.personal_workspaces (user_id)
select u.id from auth.users u
where (not exists (select 1 from public.org_members m where m.user_id = u.id)
       or exists (select 1 from public.promotions p where p.owner_id = u.id and p.org_id is null)
       or exists (select 1 from public.submissions s where s.user_id = u.id and s.org_id is null))
  and not exists (select 1 from public.org_members m join public.demo_sandbox_orgs d on d.org_id = m.org_id where m.user_id = u.id)
on conflict (user_id) do nothing;

-- Choosing «personal use» at sign-up or onboarding. Creates only the caller's own workspace: never an organisation,
-- a membership or a role. Enterprise demo personas stay confined to their sandbox organisation.
create or replace function public.ensure_personal_workspace(_display_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'code:unauthenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.org_members m join public.demo_sandbox_orgs d on d.org_id = m.org_id where m.user_id = auth.uid()) then
    raise exception 'code:demo_forbidden' using errcode = '42501';
  end if;
  insert into public.personal_workspaces (user_id, display_name)
  values (auth.uid(), nullif(trim(_display_name), ''))
  on conflict (user_id) do nothing;
end $$;
revoke all on function public.ensure_personal_workspace(text) from public, anon;
grant execute on function public.ensure_personal_workspace(text) to authenticated;

create or replace function public.save_personal_preferences(_display_name text, _authorities text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.valid_authorities(coalesce(_authorities, '{}')) then raise exception 'code:invalid_authorities' using errcode = 'P0001'; end if;
  update public.personal_workspaces
     set display_name = nullif(trim(_display_name), ''), default_authorities = coalesce(_authorities, '{}'), updated_at = now()
   where user_id = auth.uid();
  if not found then raise exception 'code:no_personal_workspace' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.save_personal_preferences(text, text[]) from public, anon;
grant execute on function public.save_personal_preferences(text, text[]) to authenticated;

-- The individual demo shares the demo AI allowance (D187) with the enterprise sandbox.
create or replace function public.is_demo_sandbox_user(_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.org_members m join public.demo_sandbox_orgs d on d.org_id = m.org_id where m.user_id = _user)
      or exists (select 1 from public.personal_workspaces w where w.user_id = _user and w.is_demo)
$$;
revoke all on function public.is_demo_sandbox_user(uuid) from public, anon, authenticated;
grant execute on function public.is_demo_sandbox_user(uuid) to service_role;

-- ---- Authority selection on personal promotions -------------------------------------------------------------------
-- null = automatic (SALEEM recommends from the content context). A manual list applies only to personal promotions:
-- organisations keep their rule-pack settings (org_rule_packs). Draft packs are never activated by a selection.
alter table public.promotions add column if not exists selected_authorities text[] null;
alter table public.promotions drop constraint if exists promotions_selected_authorities_check;
alter table public.promotions add constraint promotions_selected_authorities_check
  check (public.valid_authorities(selected_authorities) and (selected_authorities is null or org_id is null));
grant insert (selected_authorities), update (selected_authorities) on public.promotions to authenticated;

-- Deterministic recommendation from the advertisement's context (the same function serves the form and the
-- analysis coverage warning). It recommends authorities to CONSIDER; it never decides that a rule applies.
create or replace function public.recommend_authorities(
  _sector text, _category text, _communication_type text, _channels text[], _is_paid boolean, _ai_used boolean)
returns text[] language sql immutable set search_path = '' as $$
  select array(select distinct a from unnest(array[
    -- Social-media advertising and sponsored creator content (Mawthooq, content rules).
    case when coalesce(cardinality(_channels), 0) > 0 or _communication_type = 'creator_sponsored' or _is_paid then 'GMEDIA' end,
    -- Commercial advertising of goods and services (misleading claims, e-commerce).
    case when coalesce(_communication_type, 'general_commercial') in ('general_commercial', 'creator_sponsored')
           or _sector in ('ecommerce', 'retail') then 'MC' end,
    case when _ai_used then 'SDAIA' end,
    case when _sector in ('cosmetics', 'food_beverage', 'health_supplements') or _category in ('beauty', 'food', 'health') then 'SFDA' end,
    case when _sector in ('banking', 'finance_company', 'payments') or _category = 'finance' or _communication_type = 'financial_promotion' then 'SAMA' end,
    case when _sector = 'capital_market' then 'CMA' end,
    case when _sector = 'insurance' then 'IA' end,
    case when _sector = 'tourism' then 'MT' end,
    case when _category = 'real_estate' then 'REGA' end
  ]) as a where a is not null order by 1)
$$;
grant execute on function public.recommend_authorities(text, text, text, text[], boolean, boolean) to anon, authenticated, service_role;

-- What SALEEM can actually check per authority: packs, VERIFIED ACTIVE rules (applied) and draft rules (never
-- applied). Public, like the rulebook.
create or replace function public.authority_coverage()
returns table (authority text, packs jsonb, active_rules integer, draft_rules integer, in_force_sources integer)
language sql stable security definer set search_path = '' as $$
  with v as (select id from public.rulebook_versions where status = 'published' order by published_at desc nulls last limit 1)
  select p.authority,
         jsonb_agg(jsonb_build_object('code', p.code, 'name_ar', p.name_ar, 'name_en', p.name_en,
           'active', (select count(*) from public.rules r where r.pack = p.code and r.is_active and r.review_state = 'active'
                        and r.rulebook_version_id in (select id from v)),
           'draft', (select count(*) from public.rules r where r.pack = p.code and r.is_active and r.review_state in ('draft', 'legal_review')
                        and r.rulebook_version_id in (select id from v))) order by p.code),
         (select count(*) from public.rules r join public.rule_packs q on q.code = r.pack
           where q.authority = p.authority and r.is_active and r.review_state = 'active' and r.rulebook_version_id in (select id from v))::integer,
         (select count(*) from public.rules r join public.rule_packs q on q.code = r.pack
           where q.authority = p.authority and r.is_active and r.review_state in ('draft', 'legal_review') and r.rulebook_version_id in (select id from v))::integer,
         (select count(*) from public.regulatory_sources s where s.authority = p.authority and s.status = 'in_force')::integer
  from public.rule_packs p
  where p.authority not in ('INTERNAL', 'OTHER')
  group by p.authority
$$;
grant execute on function public.authority_coverage() to anon, authenticated, service_role;

-- ---- Personal AI allowance ----------------------------------------------------------------------------------------
-- Separate monthly limits for a personal workspace (org null), and Ask SALEEM as its own capability. Organisation
-- limits are unchanged. The demo cap (DEMO_AI_DAILY_LIMIT) applies on top for demo users.
alter table public.ai_usage drop constraint if exists ai_usage_capability_check;
alter table public.ai_usage add constraint ai_usage_capability_check
  check (capability in ('analysis', 'script', 'correction', 'voice', 'image', 'video', 'ask'));

create or replace function public.ai_allowance(_org uuid, _capability text, _user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare _limit integer; _used integer; _u uuid := coalesce(_user, auth.uid()); _f jsonb;
begin
  if _capability not in ('analysis', 'script', 'correction', 'voice', 'image', 'video', 'ask') then
    raise exception 'code:invalid_capability' using errcode = 'P0001';
  end if;
  if _org is null then
    -- Personal workspace: modest defaults; generated media has no configured provider.
    _limit := case _capability when 'analysis' then 30 when 'script' then 20 when 'correction' then 20
                               when 'voice' then 60 when 'ask' then 60 else 0 end;
  else
    select features into _f from public.org_settings where org_id = _org;
    _limit := coalesce((_f->'ai_limits'->>_capability)::integer,
      case _capability when 'script' then 60 when 'correction' then 30 when 'voice' then 60 when 'analysis' then 200
                       when 'ask' then 300 else 0 end);
  end if;
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
  if _capability not in ('analysis', 'script', 'correction', 'voice', 'image', 'video', 'ask') or _limit < 0 or _limit > 100000 then
    raise exception 'code:invalid_limit' using errcode = 'P0001';
  end if;
  insert into public.org_settings (org_id, features) values (_org, jsonb_build_object('ai_limits', jsonb_build_object(_capability, _limit)))
  on conflict (org_id) do update set features = coalesce(public.org_settings.features, '{}'::jsonb)
    || jsonb_build_object('ai_limits', coalesce(public.org_settings.features->'ai_limits', '{}'::jsonb) || jsonb_build_object(_capability, _limit));
end $$;
revoke all on function public.set_ai_limit(uuid, text, integer) from public, anon;
grant execute on function public.set_ai_limit(uuid, text, integer) to authenticated;

-- A personal user's whole usage for the dashboard (own rows only; ai_usage RLS already limits reads to them).
create or replace function public.personal_ai_allowances()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(c, public.ai_allowance(null, c, auth.uid()))
  from unnest(array['analysis', 'script', 'correction', 'ask']) as c
  where auth.uid() is not null
$$;
revoke all on function public.personal_ai_allowances() from public, anon;
grant execute on function public.personal_ai_allowances() to authenticated;

-- The shared demo AI cap counts every demo user, enterprise sandbox and individual demo alike: analyses, SALEEM Fix
-- generations, and Studio scripts and Ask SALEEM answers (ai_usage).
create or replace function public.demo_ai_runs_today()
returns integer language sql stable security definer set search_path = '' as $$
  select (
    (select count(*) from public.analysis_runs r join public.submissions s on s.id = r.submission_id
       where r.started_at >= now() - interval '24 hours' and public.is_demo_sandbox_user(s.user_id))
    + (select count(*) from public.correction_jobs j
       where j.updated_at >= now() - interval '24 hours' and j.attempts > 0
         and (j.org_id in (select org_id from public.demo_sandbox_orgs) or public.is_demo_sandbox_user(j.created_by)))
    + (select count(*) from public.ai_usage u
       where u.created_at >= now() - interval '24 hours' and u.capability in ('script', 'ask')
         and public.is_demo_sandbox_user(u.user_id))
  )::int
$$;
revoke all on function public.demo_ai_runs_today() from public, anon, authenticated;
grant execute on function public.demo_ai_runs_today() to service_role;
