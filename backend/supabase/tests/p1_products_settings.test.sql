-- Phase 1 — M2 products and org settings: RLS, approval, read-only approved rows, org match.
-- Run: npx supabase test db --workdir backend
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values
  ('11000000-0000-0000-0000-000000000001', 'own@test.local'),
  ('11000000-0000-0000-0000-000000000002', 'adm@test.local'),
  ('11000000-0000-0000-0000-000000000003', 'cre@test.local'),
  ('11000000-0000-0000-0000-000000000004', 'out@test.local');
insert into public.organizations (id, name, created_by) values
  ('21000000-0000-0000-0000-000000000001', 'Bank A', '11000000-0000-0000-0000-000000000001'),
  ('21000000-0000-0000-0000-000000000002', 'Bank B', '11000000-0000-0000-0000-000000000004');
insert into public.org_members (org_id, user_id, role) values
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'owner'),
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'admin'),
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'creator'),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000004', 'owner');

-- Default settings row exists for every organisation (trigger on organizations).
do $$ begin
  if (select count(*) from public.org_settings where org_id in ('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002')) <> 2 then
    raise exception 'default org_settings rows missing'; end if;
end $$;

-- Admin creates a product.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.products (id, org_id, name_ar, sector, product_type, regulator, key_facts)
values ('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'تمويل شخصي المثال', 'banking',
        'personal_finance', 'SAMA', '{"apr":{"value":4.5,"type":"fixed"},"term_months":{"min":6,"max":60}}');
-- Admin cannot self-set the status on insert or update.
do $$ begin
  begin
    insert into public.products (org_id, name_ar, sector, product_type, regulator, status)
    values ('21000000-0000-0000-0000-000000000001', 'x', 'banking', 'other', 'SAMA', 'approved');
    raise exception 'status insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.products set status = 'approved' where id = '51000000-0000-0000-0000-000000000001';
    raise exception 'status update allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- Creator reads but cannot write or approve.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
do $$ begin
  if not exists (select 1 from public.products where id = '51000000-0000-0000-0000-000000000001') then raise exception 'creator cannot read product'; end if;
  begin
    insert into public.products (org_id, name_ar, sector, product_type, regulator)
    values ('21000000-0000-0000-0000-000000000001', 'x', 'banking', 'other', 'SAMA');
    raise exception 'creator created product';
  exception when insufficient_privilege then null; end;
  begin
    perform public.approve_product('51000000-0000-0000-0000-000000000001');
    raise exception 'creator approved product';
  exception when others then if sqlerrm not like '%code:forbidden%' then raise; end if; end;
  -- settings: creator reads, cannot update
  if not exists (select 1 from public.org_settings where org_id = '21000000-0000-0000-0000-000000000001') then raise exception 'creator cannot read settings'; end if;
  update public.org_settings set sector = 'banking' where org_id = '21000000-0000-0000-0000-000000000001';
  if (select sector from public.org_settings where org_id = '21000000-0000-0000-0000-000000000001') is not null then raise exception 'creator updated settings'; end if;
end $$;

-- Outsider (other org) sees nothing of Bank A.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000004', true);
do $$ begin
  if exists (select 1 from public.products where org_id = '21000000-0000-0000-0000-000000000001') then raise exception 'outsider reads products'; end if;
  if exists (select 1 from public.org_settings where org_id = '21000000-0000-0000-0000-000000000001') then raise exception 'outsider reads settings'; end if;
end $$;

-- Owner approves; approved product is read-only; a new version supersedes it.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select public.approve_product('51000000-0000-0000-0000-000000000001');
do $$ begin
  if (select status from public.products where id = '51000000-0000-0000-0000-000000000001') <> 'approved' then raise exception 'not approved'; end if;
  if (select approved_by from public.products where id = '51000000-0000-0000-0000-000000000001') <> '11000000-0000-0000-0000-000000000001' then raise exception 'approved_by missing'; end if;
  update public.products set key_facts = '{}' where id = '51000000-0000-0000-0000-000000000001';
  if (select key_facts->'apr'->>'value' from public.products where id = '51000000-0000-0000-0000-000000000001') <> '4.5' then
    raise exception 'approved product was edited'; end if;
end $$;
update public.org_settings set sector = 'banking', brand_aliases = '{"بنك أ"}' where org_id = '21000000-0000-0000-0000-000000000001';
insert into public.products (id, org_id, name_ar, sector, product_type, regulator, key_facts, version, supersedes_id)
values ('51000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', 'تمويل شخصي المثال', 'banking',
        'personal_finance', 'SAMA', '{"apr":{"value":4.2,"type":"fixed"}}', 2, '51000000-0000-0000-0000-000000000001');
select public.approve_product('51000000-0000-0000-0000-000000000002');
do $$ begin
  if (select status from public.products where id = '51000000-0000-0000-0000-000000000001') <> 'archived' then raise exception 'superseded not archived'; end if;
  if (select sector from public.org_settings where org_id = '21000000-0000-0000-0000-000000000001') <> 'banking' then raise exception 'owner could not update settings'; end if;
  if (select updated_by from public.org_settings where org_id = '21000000-0000-0000-0000-000000000001') <> '11000000-0000-0000-0000-000000000001' then raise exception 'updated_by not set'; end if;
end $$;

-- Promotions may only use a product of their own org; sector snapshot follows the product.
insert into public.promotions (id, owner_id, org_id, title, product_id)
values ('41000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'P', '51000000-0000-0000-0000-000000000002');
do $$ begin
  if (select sector from public.promotions where id = '41000000-0000-0000-0000-000000000001') <> 'banking' then raise exception 'sector snapshot missing'; end if;
  begin
    insert into public.promotions (owner_id, title, product_id) values ('11000000-0000-0000-0000-000000000001', 'Personal', '51000000-0000-0000-0000-000000000002');
    raise exception 'personal promotion used an org product';
  exception when others then if sqlerrm not like '%code:product_mismatch%' then raise; end if; end;
end $$;
reset role;

select pass('products and org settings');
select * from finish();
rollback;
