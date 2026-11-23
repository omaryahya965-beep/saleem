-- Rollback of 20261124090000_v2_fk_indexes.sql: drops only the indexes it added (no data change).
drop index if exists public.analysis_runs_submission_idx;
drop index if exists public.frames_submission_idx;
drop index if exists public.org_members_user_idx;
drop index if exists public.org_invites_org_idx;
drop index if exists public.review_events_submission_idx;
drop index if exists public.finding_responses_submission_idx;
drop index if exists public.review_decisions_submission_idx;
drop index if exists public.share_links_submission_idx;
drop index if exists public.promotions_campaign_idx;
drop index if exists public.promotions_product_idx;
