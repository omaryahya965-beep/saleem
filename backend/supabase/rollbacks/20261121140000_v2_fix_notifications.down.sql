-- Rollback of 20261121140000_v2_fix_notifications.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this
-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.
-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added
-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).
begin;
drop trigger if exists correction_job_notify on public.correction_jobs;
drop function if exists public.correction_job_notify();
commit;
