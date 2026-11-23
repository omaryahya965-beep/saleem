-- 20261124100000_v2_drop_unused_functions: drops SQL functions nothing uses (checked against the frontend, Edge Functions, scripts, backend
-- tests, pgTAP tests, docs runbooks and every function body, policy, trigger, view, default and cron job).
-- No table, row or policy changes. Rollback: rollbacks/20261124100000_v2_drop_unused_functions.down.sql recreates them exactly.
-- admin_dedupe_stats: v1 admin statistic (Oct 2026), no caller in the app, functions, scripts or tests
drop function if exists public.admin_dedupe_stats(_days integer);
-- admin_finding_feedback: v1 admin feedback listing, no caller
drop function if exists public.admin_finding_feedback(_limit integer);
-- log_duplicate_reuse: v1 duplicate-upload logging, no caller
drop function if exists public.log_duplicate_reuse(_previous uuid);
-- delete_submission_media: v1 media deletion RPC, no caller; SECURITY DEFINER and executable by anon
drop function if exists public.delete_submission_media(_sid uuid);
-- edit_comment: comment editing RPC, no UI or caller (comments are resolved/deleted, not edited)
drop function if exists public.edit_comment(_id uuid, _body text);
-- claim_extend_scope: claim scope extension RPC, no UI or caller
drop function if exists public.claim_extend_scope(_claim uuid, _pid uuid);
