-- Rollback of 20261118060200_v2_risk_acceptance.sql. Rows decided as risk_accept / risk_decline must be removed
-- first (review_decisions is append-only: disable its trigger deliberately) or the narrowed check fails.
drop function if exists public.decide_risk(uuid, boolean, text);
drop function if exists public.request_risk_acceptance(uuid, uuid, text);
drop function if exists public.set_risk_acceptor(uuid, uuid, boolean);
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired', 'review_step_open', 'review_flow_replaced'));
alter table public.review_decisions drop constraint if exists review_decisions_decision_check;
alter table public.review_decisions add constraint review_decisions_decision_check check (decision in (
  'approve', 'conditional_approve', 'request_changes', 'reject', 'escalate', 'legal_response'));
alter table public.promotions drop column if exists risk_from_status, drop column if exists risk_acceptor_id;
alter table public.org_members drop column if exists can_accept_risk;
