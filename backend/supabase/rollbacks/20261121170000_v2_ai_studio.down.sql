-- Rollback of 20261121170000_v2_ai_studio.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
drop table if exists public.studio_drafts;
drop table if exists public.ai_usage;
drop function if exists public.set_ai_limit(uuid,text,integer);
drop function if exists public.can_use_studio(uuid);
drop function if exists public.studio_touch();
drop function if exists public.ai_allowance(uuid,text,uuid);
drop function if exists public.accept_studio_draft(uuid,uuid,uuid);
drop function if exists public.discard_studio_draft(uuid);
commit;
