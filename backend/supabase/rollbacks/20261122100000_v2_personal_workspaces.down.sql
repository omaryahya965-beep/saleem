-- Rollback of 20261122100000_v2_personal_workspaces.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
alter table public.promotions drop constraint if exists "promotions_selected_authorities_check";
drop table if exists public.personal_workspaces;
drop function if exists public.save_personal_preferences(text,text[]);
drop function if exists public.personal_ai_allowances();
drop function if exists public.valid_authorities(text[]);
drop function if exists public.ensure_personal_workspace(text);
drop function if exists public.recommend_authorities(text,text,text,text[],boolean,boolean);
drop function if exists public.authority_coverage();
CREATE OR REPLACE FUNCTION public.is_demo_sandbox_user(_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.org_members m join public.demo_sandbox_orgs d on d.org_id = m.org_id where m.user_id = _user)
$function$;
CREATE OR REPLACE FUNCTION public.demo_ai_runs_today()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (
    (select count(*) from public.analysis_runs r join public.submissions s on s.id = r.submission_id
       where r.started_at >= now() - interval '24 hours'
         and exists (select 1 from public.org_members m join public.demo_sandbox_orgs d on d.org_id = m.org_id where m.user_id = s.user_id))
    + (select count(*) from public.correction_jobs j
       where j.updated_at >= now() - interval '24 hours' and j.attempts > 0 and j.org_id in (select org_id from public.demo_sandbox_orgs))
  )::int
$function$;
CREATE OR REPLACE FUNCTION public.ai_allowance(_org uuid, _capability text, _user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.set_ai_limit(_org uuid, _capability text, _limit integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if _capability not in ('analysis', 'script', 'correction', 'voice', 'image', 'video') or _limit < 0 or _limit > 100000 then
    raise exception 'code:invalid_limit' using errcode = 'P0001';
  end if;
  insert into public.org_settings (org_id, features) values (_org, jsonb_build_object('ai_limits', jsonb_build_object(_capability, _limit)))
  on conflict (org_id) do update set features = coalesce(public.org_settings.features, '{}'::jsonb)
    || jsonb_build_object('ai_limits', coalesce(public.org_settings.features->'ai_limits', '{}'::jsonb) || jsonb_build_object(_capability, _limit));
end $function$;
alter table public.ai_usage drop constraint if exists "ai_usage_capability_check";
alter table public.ai_usage add constraint "ai_usage_capability_check" CHECK ((capability = ANY (ARRAY['analysis'::text, 'script'::text, 'correction'::text, 'voice'::text, 'image'::text, 'video'::text]))) not valid;
alter table public.promotions drop column if exists "selected_authorities";
commit;
