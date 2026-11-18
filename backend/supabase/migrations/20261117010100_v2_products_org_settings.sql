-- v2 Phase 1 — M2 `v2_products_org_settings`.
-- Products: an organisation's financial products with approved key facts (used for fact matching in
-- Phase 2). Org settings: one row per organisation (sector, brand aliases, review defaults, feature flags).
-- Additive only.

-- ---------------------------------------------------------------------------------------------
-- 1. Products
-- ---------------------------------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name_ar       text not null check (char_length(trim(name_ar)) between 1 and 120),
  name_en       text null check (char_length(name_en) <= 120),
  aliases       text[] not null default '{}',
  sector        text not null check (sector in ('banking', 'finance_company', 'payments', 'capital_market', 'insurance', 'other')),
  product_type  text not null check (product_type in (
    'personal_finance', 'real_estate_finance', 'auto_finance', 'credit_card', 'bnpl', 'sme_finance',
    'consumer_microfinance', 'finance_lease', 'current_account', 'savings_deposit', 'time_deposit', 'wallet',
    'prepaid_card', 'remittance', 'fx', 'public_fund', 'non_retail_fund', 'equities', 'derivatives',
    'sukuk_bonds', 'robo_advisory', 'insurance_motor', 'insurance_health', 'insurance_protection_savings',
    'insurance_other', 'other')),
  regulator     text not null check (regulator in ('SAMA', 'CMA', 'IA', 'other')),
  currency      text not null default 'SAR' check (currency ~ '^[A-Z]{3}$'),
  key_facts     jsonb not null default '{}'::jsonb check (jsonb_typeof(key_facts) = 'object'),
  status        text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  approved_by   uuid null references auth.users(id) on delete set null,
  approved_at   timestamptz null,
  version       integer not null default 1 check (version >= 1),
  supersedes_id uuid null references public.products(id) on delete set null,
  created_by    uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_org_idx on public.products (org_id, status);

do $$ begin
  alter table public.promotions
    add constraint promotions_product_fk foreign key (product_id) references public.products(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.products enable row level security;
grant select on public.products to authenticated;
grant all on public.products to service_role;
-- Status and approval fields change only through approve_product / archive_product.
grant insert (id, org_id, name_ar, name_en, aliases, sector, product_type, regulator, currency, key_facts, version, supersedes_id)
  on public.products to authenticated;
grant update (name_ar, name_en, aliases, sector, product_type, regulator, currency, key_facts)
  on public.products to authenticated;

drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated
  with check (
    public.is_org_member(org_id, array['owner', 'admin']::public.org_role[])
    and (products.supersedes_id is null or exists (
      select 1 from public.products p where p.id = products.supersedes_id and p.org_id = products.org_id))
  );
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]) and status = 'draft')
  with check (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]));

-- Approved products are read-only, even for the service role: edit = new row with supersedes_id.
create or replace function public.products_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'approved' and (
      new.name_ar is distinct from old.name_ar or new.name_en is distinct from old.name_en
      or new.aliases is distinct from old.aliases or new.sector is distinct from old.sector
      or new.product_type is distinct from old.product_type or new.regulator is distinct from old.regulator
      or new.currency is distinct from old.currency or new.key_facts is distinct from old.key_facts
      or new.org_id is distinct from old.org_id) then
      raise exception 'code:product_locked' using errcode = 'P0001';
    end if;
    if old.status = 'archived' and new.status <> 'archived' then
      raise exception 'code:product_locked' using errcode = 'P0001';
    end if;
    new.updated_at := now();
  else
    new.status := coalesce(new.status, 'draft');
  end if;
  return new;
end $$;
drop trigger if exists products_guard on public.products;
create trigger products_guard before insert or update on public.products
  for each row execute function public.products_guard();

/** Approves a draft product (org owner/admin). Archives the version it supersedes. */
create or replace function public.approve_product(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare _p public.products;
begin
  select * into _p from public.products where id = _id for update;
  if _p.id is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not public.is_org_member(_p.org_id, array['owner', 'admin']::public.org_role[]) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  if _p.status <> 'draft' then raise exception 'code:product_not_draft' using errcode = 'P0001'; end if;
  update public.products set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = _id;
  if _p.supersedes_id is not null then
    update public.products set status = 'archived' where id = _p.supersedes_id and status = 'approved';
  end if;
end $$;

/** Archives a product (org owner/admin). Promotions keep pointing at it (pinned history). */
create or replace function public.archive_product(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare _org uuid;
begin
  select org_id into _org from public.products where id = _id;
  if _org is null then raise exception 'code:not_found' using errcode = 'P0001'; end if;
  if not public.is_org_member(_org, array['owner', 'admin']::public.org_role[]) then
    raise exception 'code:forbidden' using errcode = '42501';
  end if;
  update public.products set status = 'archived' where id = _id;
end $$;
revoke all on function public.approve_product(uuid), public.archive_product(uuid) from public, anon;
grant execute on function public.approve_product(uuid), public.archive_product(uuid) to authenticated;

-- A promotion may only use a product of its own organisation; its sector snapshot follows the product.
create or replace function public.promotions_product_matches()
returns trigger language plpgsql security definer set search_path = '' as $$
declare _p public.products;
begin
  if new.product_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.product_id is not distinct from old.product_id then return new; end if;
  select * into _p from public.products where id = new.product_id;
  if _p.id is null or _p.org_id is distinct from new.org_id then
    raise exception 'code:product_mismatch' using errcode = 'P0001';
  end if;
  if _p.status = 'archived' then raise exception 'code:product_archived' using errcode = 'P0001'; end if;
  new.sector := _p.sector;
  return new;
end $$;
drop trigger if exists promotions_product_matches on public.promotions;
create trigger promotions_product_matches before insert or update of product_id on public.promotions
  for each row execute function public.promotions_product_matches();

-- ---------------------------------------------------------------------------------------------
-- 2. Org settings (one row per organisation)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.org_settings (
  org_id                      uuid primary key references public.organizations(id) on delete cascade,
  sector                      text null check (sector in ('banking', 'finance_company', 'payments', 'capital_market', 'insurance', 'other')),
  brand_aliases               text[] not null default '{}',
  review_sla_business_days    integer not null default 3 check (review_sla_business_days between 1 and 30),
  weekend_days                integer[] not null default '{5,6}',
  require_uploader_responses  boolean not null default true,
  require_reviewer_responses  boolean not null default true,
  media_retention             jsonb not null default '{"unsubmitted_hours":24,"submitted":"retain","approved":"retain"}',
  hide_comments_from_external boolean not null default false,
  features                    jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  updated_by                  uuid null references auth.users(id) on delete set null,
  updated_at                  timestamptz not null default now()
);
alter table public.org_settings enable row level security;
grant select on public.org_settings to authenticated;
grant all on public.org_settings to service_role;
grant update (sector, brand_aliases, review_sla_business_days, weekend_days, require_uploader_responses,
              require_reviewer_responses, hide_comments_from_external, features)
  on public.org_settings to authenticated;

drop policy if exists org_settings_select on public.org_settings;
create policy org_settings_select on public.org_settings for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists org_settings_update on public.org_settings;
create policy org_settings_update on public.org_settings for update to authenticated
  using (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]))
  with check (public.is_org_member(org_id, array['owner', 'admin']::public.org_role[]));

create or replace function public.org_settings_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
drop trigger if exists org_settings_touch on public.org_settings;
create trigger org_settings_touch before update on public.org_settings
  for each row execute function public.org_settings_touch();

insert into public.org_settings (org_id) select id from public.organizations on conflict (org_id) do nothing;

create or replace function public.organizations_default_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.org_settings (org_id) values (new.id) on conflict (org_id) do nothing;
  return new;
end $$;
drop trigger if exists organizations_default_settings on public.organizations;
create trigger organizations_default_settings after insert on public.organizations
  for each row execute function public.organizations_default_settings();
