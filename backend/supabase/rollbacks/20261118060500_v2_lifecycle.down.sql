-- Rollback of 20261118060500_v2_lifecycle.sql. Promotions in due_for_rereview keep that (unused) enum value.
select cron.unschedule(jobid) from cron.job where jobname = 'saleem-lifecycle';
drop function if exists public.lifecycle_daily();
drop function if exists public.complete_rereview(uuid, boolean, date, text);
drop function if exists public.mark_withdrawn(uuid, text);
drop function if exists public.request_withdrawal(uuid, timestamptz, text);
drop function if exists public.record_lifecycle(uuid, text, timestamptz);
drop function if exists public.set_evergreen(uuid, boolean, date);
drop function if exists public.lifecycle_can_edit(public.promotions);
drop trigger if exists promotions_evergreen_guard on public.promotions;
drop function if exists public.promotions_evergreen_guard();
drop function if exists public.saudi_business_day_after(timestamptz, date[]);
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'check_done', 'check_failed', 'share_review', 'org_invite',
  'review_submitted', 'review_assigned', 'review_decided', 'review_escalated', 'review_legal_response', 'comment_mention',
  'claim_review_due', 'claim_expired', 'review_step_open', 'review_flow_replaced', 'risk_requested', 'risk_decided',
  'partner_access_requested'));
alter table public.org_settings drop column if exists business_holidays;
alter table public.promotions drop column if exists withdrawal_due_at, drop column if exists regulator_notice_at,
  drop column if exists withdrawal_reason, drop column if exists withdrawn_at, drop column if exists taken_down_at,
  drop column if exists published_at, drop column if exists next_review_at, drop column if exists evergreen;
