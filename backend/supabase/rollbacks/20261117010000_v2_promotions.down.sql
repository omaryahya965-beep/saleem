-- Rollback of 20261117010000_v2_promotions.sql. Removes promotions and the version columns.
-- Data loss: promotion context (product, channels, notes, deadlines) entered after the migration.
-- Submissions, findings and re-check links (parent_id) are untouched.
drop trigger if exists submissions_v2_attach_promotion on public.submissions;
drop trigger if exists submissions_v2_set_current on public.submissions;
drop trigger if exists promotions_touch on public.promotions;
drop function if exists public.submissions_v2_attach_promotion();
drop function if exists public.submissions_v2_set_current();
drop function if exists public.promotions_touch();
drop function if exists public.v2_backfill_promotions();
drop function if exists public.can_read_promotion(uuid);
grant update (promotion_id, version_no) on public.submissions to authenticated;  -- harmless; columns dropped next
drop index if exists public.submissions_promotion_version_uq;
drop index if exists public.submissions_promotion_idx;
alter table public.submissions drop column if exists promotion_id, drop column if exists version_no;
drop table if exists public.promotions;
drop function if exists public.promotion_is_open(public.promotion_review_status);
drop type if exists public.promotion_review_status;
drop type if exists public.communication_type;
