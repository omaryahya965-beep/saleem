-- Rollback of 20261121150000_v2_rule_categories.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
alter table public.internal_rules drop constraint if exists "internal_rules_category_check";
drop trigger if exists internal_rule_category_default on public.internal_rules;
drop trigger if exists internal_rule_version_category on public.internal_rule_versions;
drop function if exists public.guess_rule_category(text,text);
drop function if exists public.internal_rule_version_category();
drop function if exists public.internal_rule_category_default();
drop function if exists public.save_internal_rule_v2(uuid,uuid,text,text,text,text,text);
alter table public.internal_rule_versions drop column if exists "category";
alter table public.internal_rules drop column if exists "category";
commit;
