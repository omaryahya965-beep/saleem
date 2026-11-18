-- Rollback of 20261117030100_v2_review.sql. Data loss: review decisions, events, responses, reasons.
-- Approved records are lost: export review_decisions first (audit requirement, CMA Art. 33 / SAMA Art. 15).
drop trigger if exists submissions_v2_version_event on public.submissions;
drop function if exists public.submissions_v2_version_event();
drop function if exists public.media_retention_candidates(int);
drop function if exists public.archive_promotion(uuid, text);
drop function if exists public.respond_escalation(uuid, text);
drop function if exists public.escalate_promotion(uuid, uuid, text);
drop function if exists public.decide_promotion(uuid, text, uuid[], text, text, text);
drop function if exists public.write_decision(public.promotions, text, text, public.promotion_review_status, uuid[], text, text, text);
drop function if exists public.assign_reviewer(uuid, uuid);
drop function if exists public.open_review(uuid);
drop function if exists public.submit_promotion(uuid, text, boolean);
drop function if exists public.can_decide(uuid);
drop function if exists public.can_submit(uuid, text, boolean);
drop function if exists public.verify_decision_chain(uuid);
drop function if exists public.notify_user(uuid, text, uuid, jsonb);
drop function if exists public.notify_org(uuid, public.org_role[], text, uuid, jsonb);
drop function if exists public.log_review_event(uuid, uuid, text, text, text, jsonb);
drop function if exists public.findings_snapshot(uuid);
drop function if exists public.latest_run_id(uuid);
drop function if exists public.promotion_uploader(uuid);
drop function if exists public.decision_payload(public.review_decisions);
drop function if exists public.decision_hash(text, jsonb);
drop table if exists public.finding_responses;
drop table if exists public.review_events;
drop table if exists public.review_decisions;
drop function if exists public.forbid_mutation();
drop table if exists public.rejection_reasons;
alter table public.promotions drop column if exists escalated_to;
delete from public.notifications where kind like 'review_%' or kind = 'comment_mention';
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('check_done', 'check_failed', 'share_review', 'org_invite'));
alter table public.notifications drop column if exists emailed_at;
-- Re-apply can_read_submission / can_read_promotion / "org read submissions" from 20261014020000 and 20261117010000.
