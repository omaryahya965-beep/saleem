-- Rollback of 20261118060400_v2_upload_types.sql.
drop function if exists public.submit_variations(uuid, text);
drop function if exists public.create_variation(uuid, text);
alter table public.frames drop column if exists asset_id;
drop table if exists public.submission_assets;
drop index if exists public.promotions_variation_group_idx;
alter table public.promotions drop column if exists variation_group_id, drop column if exists upload_type;
