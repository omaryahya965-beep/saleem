# Phase 3 — Human review and approval (P1)

**Goal:** a promotion moves from draft to an approved, sealed decision through a strict state machine,
with structured responses to AI findings, a review queue, escalation to legal, separation of duties,
notifications, an audit trail, and media retention that keeps the approved record.

**User problem:** SAMA Article 15 requires written compliance approval before publication. Today SALEEM
has no internal approval at all, and media disappears after 24 hours.

**Preconditions:** Phase 2 accepted. Read `00_MASTER_PROMPT.md` §4.1–4.3, `03_DATA_MODEL.md` M5–M6,
`05_UX_SPEC.md` §2, §3 (queue), §6.4–6.6.

## 3.1 Discovery

- `audit_events` shape (decision from Phase 0: extend it or create `review_events`).
- `notifications` table, `_shared/notify.ts` (Resend), notification UI and preferences.
- `cleanup-media` function and its cron query; `share_links`/`share_reviews` flow and UI.
- `org_members` role type; members management UI (`features/org`).

## 3.2 Tasks

1. **Migration M5** + rollback: `legal` role; `rejection_reasons` (+ platform defaults from
   `05_UX_SPEC.md` §6.6); `review_decisions` (immutable); events (`review_events` or extended
   `audit_events`, immutable); `decision_hash`, `verify_decision_chain`; review fields in `org_settings`
   if missing; RPCs `can_submit`, `submit_promotion`, `open_review`, `assign_reviewer`, `can_decide`,
   `decide_promotion`, `escalate_promotion`, `respond_escalation`, `archive_promotion` exactly per
   `00_MASTER_PROMPT.md` §4.1. Grant `execute` to `authenticated` only for these RPCs.
2. **Migration M6** + rollback: `finding_feedback` columns + status sync trigger; comment required for
   `dispute`, `not_required`, `dismiss`.
3. **Analysis events**: the `analyze` function writes `analysis_done` / `analysis_failed` events (service
   role) so the timeline and metrics are complete.
4. **Retention**: `cleanup-media` deletes only (a) personal-creator media older than 24 h and (b) org
   versions that were never submitted and are older than `media_retention.unsubmitted_hours`. Never
   delete media of a version that was submitted, decided or approved, nor the `evidence` bucket. Tests
   with fixtures for each case.
5. **Responses UI**: buttons per role on finding cards; dialogs for comment-required actions; response
   history; optimistic update only after RPC success.
6. **Submit flow**: «إرسال للمراجعة» with `can_submit` preflight; unmet conditions listed («3 ملاحظات
   بلا رد», «التحليل لم يكتمل»); success → status badge updates, event, notifications to reviewers in scope.
7. **Review queue** `/queue` per `05_UX_SPEC.md` §3; `open_review` on open; assignment UI for admins.
8. **Decision dialog**: decision choice; reasons multi-select (required for reject and request changes;
   «أخرى» needs text); condition text (required for conditional approval); comment; summary of open
   findings and responses; confirm. Separation-of-duties message when blocked.
9. **Escalation**: choose a legal member + question; legal sees it in their queue; response returns it to
   `in_review`; both stored as decision rows (`escalate`, `legal_response`).
10. **Approval certificate**: extend the printable compliance log (or add a sibling page) for approved
    promotions: promotion, approved version (sha256), decision, reviewer name and role, Hijri +
    Gregorian timestamp, decision hash, the advisory line, and «اعتماد داخلي وفق المادة 15 من ضوابط
    الإعلان — لا يمثل موافقة من البنك المركزي». Public `/verify` stays unchanged (no personal data).
11. **History tab** and org **Audit log** page (filters, CSV export for admins).
12. **Notifications** (in-app + email via existing `notify.ts`, respecting user preferences): submitted
    (reviewers in scope), assigned, decided (uploader and collaborators), escalated (legal), legal response
    (reviewer). Arabic templates first.
13. **Members UI**: assign `legal`; explain roles in Arabic.
14. **Legacy share reviews**: show brand approvals/rejections from `share_reviews` in the history as
    «ملاحظات العميل الخارجي» — they never change `review_status`.

## 3.3 Tests

- Transition matrix: every allowed transition succeeds for the right role; every other (role × status ×
  action) combination fails with the expected `code:*`.
- Separation of duties: the uploader of the current version cannot `open_review` or `decide`.
- Guards: submit blocked without responses (when required) and when analysis is not done; decisions
  blocked without reasons/condition/reviewer responses.
- Immutability: update/delete on `review_decisions` and events fail; tampering with a decision row (as
  superuser in the test) makes `verify_decision_chain` return `valid = false`.
- Direct client update of `promotions.review_status` fails (privileges).
- Retention fixtures (personal 24 h, org unsubmitted, org submitted, org approved).
- E2E (ar + en): creator creates → responds → submits; reviewer opens → requests changes; creator uploads
  V2 → submits; reviewer approves; certificate shows the decision. Escalation path. Cases 12 and 14.

## 3.4 Acceptance criteria

- [ ] The state machine matches `00_MASTER_PROMPT.md` §4.1 exactly, enforced in the database.
- [ ] No approval path exists without a human reviewer action; SoD enforced.
- [ ] Decisions are immutable and hash-chained; verification detects tampering.
- [ ] Approved and submitted org versions keep their media.
- [ ] Queue, decision dialog, escalation, history, audit log and notifications work in Arabic and English.
- [ ] Gate checks pass; report written; PROGRESS updated.

## 3.5 Out of scope

Multi-level approval, risk acceptance, external reviewers (Phase 6); comments (Phase 4).
