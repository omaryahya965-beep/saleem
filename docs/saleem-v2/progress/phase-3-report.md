# Phase 3 report — Human review and approval
Date: 2026-11-18 · Branch: v2/full-run · Commits: 049d2f6..(tag v2-phase-3)

## Outcome
Organisation promotions now go through a strict, database-enforced review: the uploader responds to findings and
submits; a reviewer (never the uploader of the version) opens the review, responds to findings and decides —
approve, approve with a condition, request changes or reject — or escalates to a legal member, whose answer
returns the promotion to review. Every decision is an immutable, hash-chained row that can be verified; every
step is an append-only event shown in the History tab and the org audit log (CSV export). Reviewers have a queue
with SLA overdue badges; approvals print an internal approval certificate (Article 15, not a SAMA approval) with
the compliance log. Submitted and approved versions keep their media. No code path approves without a human.

## Acceptance criteria
| Criterion | Status | Evidence |
|---|---|---|
| State machine matches master §4.1, enforced in the DB | met (P1 transitions; withdraw is Phase 6) | `p3_review.test.sql`: submit → open → request changes → resubmit with note → escalate → legal response → approve; invalid status/role/guard errors |
| No approval without a human reviewer; SoD enforced | met | `separation_of_duties` on open/assign/decide/respond; client `update review_status` → permission denied; `review.test.tsx` |
| Decisions immutable, hash-chained, tamper detected | met | update/delete → `code:immutable_record`; tampered row → `verify_decision_chain.valid = false` |
| Approved and submitted org versions keep media | met | retention fixtures in `p3_review.test.sql` |
| Queue, decision dialog, escalation, history, audit, notifications in AR/EN | met (component-tested; e2e of the review path **not run**) | `review.test.tsx`, i18n parity |
| Gate, report, PROGRESS | met | below |

## Changes
- Migrations (+ rollbacks): `20261117030000_v2_legal_role.sql`, `20261117030100_v2_review.sql`,
  `20261117030200_v2_finding_responses.sql`.
- Edge Functions: `analyze` writes `analysis_done/failed`; `cleanup-media` uses `media_retention_candidates`;
  new `review-notify`; `_shared/notify.ts` review emails; CI deno-checks all functions.
- Frontend: `features/review/*` (actions, dialogs, responses panel, history, queue, audit, certificate),
  `/queue`, `/audit`, promotion page header + History tab, notifications, members help.

## Tests
- Added: pgTAP `p3_review` (workflow, SoD, guards, immutability, tamper, privileges, retention); Vitest `review`
  (8). Gate: lint ✓ · typecheck ✓ · unit ✓ (70 + 126) · deno check ✓ (5) · db reset **not run** (PGlite ✓) ·
  isolation **not run** · build ✓ · e2e ✓ 24/24 existing specs · e2e for the review path **not run** (D113 follow-up).

## Not done / deviations
- No Playwright journey for submit → decide → certificate (covered by the SQL workflow test and component tests).
- Org-specific rejection reasons have no editor yet (P3 per spec; platform defaults seeded).
- D104–D112.

## How to verify manually
1. As a creator in a bank org: new promotion → «الملاحظات» panel → «موافق، سأعدّل» → «إرسال للمراجعة».
2. As a reviewer: «طابور المراجعة» → open → «بدء المراجعة» → respond «غير صحيحة» with a comment → «القرار» → «طلب تعديلات» with a reason.
3. As the creator: «رفع إصدار جديد» → submit; as the reviewer: «تصعيد للقانوني» to the legal member.
4. As legal: «رد على التصعيد»; as the reviewer: «اعتماد».
5. «السجل» → «تحقق من سلامة السجل» → valid; open the compliance log → «شهادة الاعتماد الداخلي».
6. As the owner: «سجل التدقيق» → export CSV.
