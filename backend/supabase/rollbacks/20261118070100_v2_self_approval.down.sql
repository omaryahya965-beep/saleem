-- Rollback of 20261118070100_v2_self_approval.sql.
drop function if exists public.self_approve(uuid, text);
drop function if exists public.can_self_approve(uuid);
drop function if exists public.save_self_approval_rule(uuid, uuid, text, text[], text[], text[], public.org_role[], uuid[], text, boolean);
alter table public.org_settings drop column if exists self_approval_blocked_packs;
drop table if exists public.self_approval_rules;
