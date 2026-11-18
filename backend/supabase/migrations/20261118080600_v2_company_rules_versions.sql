-- v2 Phase 8 (step 6): company rules («قواعد الشركة») are versioned.
-- internal_rules.version starts at 1 and goes up when an approved rule is edited (it returns to draft). Each
-- approval writes an immutable snapshot to internal_rule_versions: who wrote it, who approved it, when.

alter table public.internal_rules add column if not exists version integer not null default 1 check (version >= 1);

create table if not exists public.internal_rule_versions (
  id             uuid primary key default gen_random_uuid(),
  rule_id        uuid not null references public.internal_rules(id) on delete cascade,
  org_id         uuid not null references public.organizations(id) on delete cascade,
  version        integer not null,
  code           text not null,
  title_ar       text not null,
  instruction_ar text not null,
  severity       text not null,
  edited_by      uuid null,
  edited_at      timestamptz null,
  approved_by    uuid not null,
  approved_at    timestamptz not null,
  unique (rule_id, version)
);
alter table public.internal_rule_versions enable row level security;
drop policy if exists internal_rule_versions_read on public.internal_rule_versions;
create policy internal_rule_versions_read on public.internal_rule_versions for select to authenticated
  using (public.is_org_member(org_id));
revoke all on public.internal_rule_versions from anon, authenticated;
grant select on public.internal_rule_versions to authenticated;
grant all on public.internal_rule_versions to service_role;

create or replace function public.internal_rules_versioning()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Editing an approved rule starts the next version.
  if tg_op = 'UPDATE' and old.status = 'active' and new.status = 'draft' then
    new.version := old.version + 1;
  end if;
  return new;
end $$;

create or replace function public.internal_rules_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' and new.approved_by is not null then
    insert into public.internal_rule_versions (rule_id, org_id, version, code, title_ar, instruction_ar, severity,
                                               edited_by, edited_at, approved_by, approved_at)
    values (new.id, new.org_id, new.version, new.code, new.title_ar, new.instruction_ar, new.severity,
            new.edited_by, new.edited_at, new.approved_by, coalesce(new.approved_at, now()))
    on conflict (rule_id, version) do nothing;
  end if;
  return null;
end $$;

drop trigger if exists internal_rules_versioning on public.internal_rules;
create trigger internal_rules_versioning before update on public.internal_rules
  for each row execute function public.internal_rules_versioning();
drop trigger if exists internal_rules_snapshot on public.internal_rules;
create trigger internal_rules_snapshot after update on public.internal_rules
  for each row execute function public.internal_rules_snapshot();
