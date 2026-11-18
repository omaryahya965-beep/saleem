-- Rollback of 20261118060700_v2_internal_rules.sql.
drop function if exists public.archive_internal_rule(uuid);
drop function if exists public.approve_internal_rule(uuid);
drop function if exists public.save_internal_rule(uuid, uuid, text, text, text, text);
drop function if exists public.save_brand_guideline(uuid, text, text, text);
drop function if exists public.can_manage_internal_rules(uuid);
drop table if exists public.internal_rules;
drop table if exists public.brand_guidelines;
