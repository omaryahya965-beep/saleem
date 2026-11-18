-- v2 Phase 6.7: brand-guideline (internal policy) rules behind org_settings.features.internal_rules (default off).
-- Admins add brand guidelines; SALEEM drafts rules from them (the model when configured, otherwise a marked
-- directive-sentence draft); an owner/admin must edit and approve each draft before it runs. Active rules run
-- in analysis as codes INT-* and are labelled «سياسة داخلية», never as regulation.

create table if not exists public.brand_guidelines (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 200),
  text_ar     text not null check (char_length(text_ar) between 1 and 50000),
  file_path   text null,
  created_by  uuid null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.internal_rules (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  code            text not null check (code ~ '^INT-[A-Z0-9-]{2,24}$'),
  title_ar        text not null check (char_length(trim(title_ar)) between 1 and 200),
  instruction_ar  text not null check (char_length(trim(instruction_ar)) between 1 and 2000),
  severity        text not null default 'warning' check (severity in ('warning', 'violation')),
  status          text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  source          text not null check (source in ('model_draft', 'heuristic_draft', 'manual')),
  guideline_id    uuid null references public.brand_guidelines(id) on delete set null,
  edited_by       uuid null,
  edited_at       timestamptz null,
  approved_by     uuid null,
  approved_at     timestamptz null,
  created_at      timestamptz not null default now(),
  unique (org_id, code)
);

alter table public.brand_guidelines enable row level security;
alter table public.internal_rules enable row level security;
drop policy if exists brand_guidelines_read on public.brand_guidelines;
create policy brand_guidelines_read on public.brand_guidelines for select to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]));
drop policy if exists internal_rules_read on public.internal_rules;
create policy internal_rules_read on public.internal_rules for select to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin', 'reviewer', 'creator', 'legal']::public.org_role[]));
grant select on public.brand_guidelines, public.internal_rules to authenticated;
grant all on public.brand_guidelines, public.internal_rules to service_role;

create or replace function public.can_manage_internal_rules(_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.org_feature(_org, 'internal_rules') and public.is_org_member(_org, array['owner', 'admin']::public.org_role[])
$$;

create or replace function public.save_brand_guideline(_org uuid, _title text, _text text, _file text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _id uuid;
begin
  if not public.can_manage_internal_rules(_org) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if coalesce(trim(_text), '') = '' then raise exception 'code:text_required' using errcode = 'P0001'; end if;
  insert into public.brand_guidelines (org_id, title, text_ar, file_path, created_by)
  values (_org, coalesce(nullif(trim(_title), ''), 'دليل الهوية'), _text, _file, auth.uid()) returning id into _id;
  return _id;
end $$;

/** Create (manual) or edit a rule. Editing an active rule returns it to draft (it must be approved again). */
create or replace function public.save_internal_rule(_org uuid, _id uuid, _code text, _title text, _instruction text, _severity text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _rid uuid := _id;
begin
  if not public.can_manage_internal_rules(_org) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if coalesce(trim(_instruction), '') = '' or coalesce(trim(_title), '') = '' then raise exception 'code:text_required' using errcode = 'P0001'; end if;
  if upper(trim(_code)) !~ '^INT-[A-Z0-9-]{2,24}$' then raise exception 'code:invalid_code' using errcode = 'P0001'; end if;
  if _rid is null then
    insert into public.internal_rules (org_id, code, title_ar, instruction_ar, severity, source, edited_by, edited_at)
    values (_org, upper(trim(_code)), trim(_title), trim(_instruction), coalesce(_severity, 'warning'), 'manual', auth.uid(), now()) returning id into _rid;
  else
    update public.internal_rules set code = upper(trim(_code)), title_ar = trim(_title), instruction_ar = trim(_instruction),
      severity = coalesce(_severity, severity), status = case when status = 'archived' then 'archived' else 'draft' end,
      edited_by = auth.uid(), edited_at = now(), approved_by = null, approved_at = null
    where id = _rid and org_id = _org;
    if not found then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  end if;
  return _rid;
end $$;

/** Approve a draft: drafted rules must have been edited by a person first. */
create or replace function public.approve_internal_rule(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.internal_rules;
begin
  select * into r from public.internal_rules where id = _id for update;
  if r.id is null or not public.can_manage_internal_rules(r.org_id) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  if r.status <> 'draft' then raise exception 'code:invalid_status' using errcode = 'P0001'; end if;
  if r.edited_by is null then raise exception 'code:edit_required' using errcode = 'P0001'; end if;
  update public.internal_rules set status = 'active', approved_by = auth.uid(), approved_at = now() where id = _id;
  insert into public.audit_events (actor, action, target_table, target_id, meta)
  values (auth.uid(), 'internal_rule.approve', 'internal_rules', _id::text, jsonb_build_object('org_id', r.org_id, 'code', r.code));
end $$;

create or replace function public.archive_internal_rule(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.internal_rules;
begin
  select * into r from public.internal_rules where id = _id;
  if r.id is null or not public.can_manage_internal_rules(r.org_id) then raise exception 'code:forbidden' using errcode = '42501'; end if;
  update public.internal_rules set status = 'archived' where id = _id;
end $$;

revoke all on function public.can_manage_internal_rules(uuid), public.save_brand_guideline(uuid, text, text, text),
  public.save_internal_rule(uuid, uuid, text, text, text, text), public.approve_internal_rule(uuid), public.archive_internal_rule(uuid) from public, anon;
grant execute on function public.can_manage_internal_rules(uuid), public.save_brand_guideline(uuid, text, text, text),
  public.save_internal_rule(uuid, uuid, text, text, text, text), public.approve_internal_rule(uuid), public.archive_internal_rule(uuid) to authenticated;
