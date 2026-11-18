# Phase 3 plan — Human review and approval

## Discovery
- Events: Phase 0 decided a dedicated `review_events` table (D68).
- `finding_feedback` has `unique (finding_id, user_id)` and only insert/delete grants — it cannot hold a response
  history. Responses go to a new append-only `finding_responses` table written by an RPC; `finding_feedback`
  stays as is for the existing dispute UI (D104).
- `org_members.role` is enum `public.org_role` → `legal` added in its own migration.
- Notifications: `notifications(kind, payload, submission_id)`; UI switches on `check_done/check_failed/share_review`.
  Email goes through `_shared/notify.ts` (Resend) from Edge Functions only.
- `cleanup-media` cron selects submissions analysed > 24 h ago; it will call a SQL function that applies retention.
- Personal promotions have no reviewers → submission for review is for organisation promotions only (D105).

## Slices
1. Migrations: `legal` enum value; M5 `v2_review` (rejection reasons + defaults, `review_decisions` immutable +
   hash chain, `review_events` immutable, `promotions.escalated_to`, legal read access, RPCs per master §4.1,
   in-app notifications, `media_retention_candidates()`); M6 `v2_finding_responses` (append-only responses + status
   sync + comment rule). pgTAP: transition matrix, SoD, guards, immutability + tamper, privileges, retention.
2. `analyze` writes `analysis_done/failed` events; `cleanup-media` uses the retention function; new Edge Function
   `review-notify` emails pending review notifications (respecting `notify_email`).
3. Frontend data layer `lib/api/review.ts` (RPCs, queue, history, audit) + types + i18n.
4. Promotion page: primary action (submit / open / decide / escalate / respond / upload), preflight reasons,
   decision dialog, escalation dialogs; finding response buttons + history; History tab with chain verification.
5. `/queue`, `/audit` (filters + CSV), certificate section on the compliance log, members UI with `legal`,
   notification kinds.
6. E2E with mocked RPCs (submit → request changes → V2 → approve; escalation), gate, report.
