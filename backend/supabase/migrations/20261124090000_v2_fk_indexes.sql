-- Cleanup (Phase E): indexes for foreign keys on the application's hot paths. Additive only (no data change).
-- Each one backs a query the app runs on every report, dashboard or membership check:
--   latest analysis of a version (reports, dashboards, review)   analysis_runs (submission_id, started_at desc)
--   evidence frames of a version                                 frames (submission_id)
--   "my organisations" / membership by user                     org_members (user_id)   (PK is (org_id, user_id))
--   invitations of an organisation                               org_invites (org_id)
--   review timeline / responses / decisions of a version         review_events, finding_responses, review_decisions (submission_id)
--   share links of a version                                     share_links (submission_id)
--   advertisements by campaign / product (list filters)          promotions (campaign_id), promotions (product_id)
-- Rollback: rollbacks/20261124090000_v2_fk_indexes.down.sql
create index if not exists analysis_runs_submission_idx on public.analysis_runs (submission_id, started_at desc);
create index if not exists frames_submission_idx on public.frames (submission_id);
create index if not exists org_members_user_idx on public.org_members (user_id);
create index if not exists org_invites_org_idx on public.org_invites (org_id);
create index if not exists review_events_submission_idx on public.review_events (submission_id);
create index if not exists finding_responses_submission_idx on public.finding_responses (submission_id);
create index if not exists review_decisions_submission_idx on public.review_decisions (submission_id);
create index if not exists share_links_submission_idx on public.share_links (submission_id);
create index if not exists promotions_campaign_idx on public.promotions (campaign_id) where campaign_id is not null;
create index if not exists promotions_product_idx on public.promotions (product_id) where product_id is not null;
