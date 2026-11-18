-- Rollback of 20261117010100_v2_products_org_settings.sql. Data loss: products and org settings.
drop trigger if exists organizations_default_settings on public.organizations;
drop function if exists public.organizations_default_settings();
drop trigger if exists promotions_product_matches on public.promotions;
drop function if exists public.promotions_product_matches();
alter table public.promotions drop constraint if exists promotions_product_fk;
drop function if exists public.approve_product(uuid);
drop function if exists public.archive_product(uuid);
drop table if exists public.org_settings;
drop function if exists public.org_settings_touch();
drop table if exists public.products;
drop function if exists public.products_guard();
