# Phase 5 report — Claims, disclaimers, product facts, dashboard
Date: 2026-11-18 · Branch: v2/full-run · Commits: 83e62e9..caee6ba (tag v2-phase-5)

## Outcome
Organisations now keep an approved claims library: versions, a review step, substantiation files in a private bucket,
and review/expiry reminders. They also keep required disclaimers. Two platform templates are marked «صيغة مقترحة —
راجعها قانونياً» and are proposals only. Analysis compares ad text with approved claims in six classes, with Arabic
variants and numbers compared after normalisation. It checks that required disclaimers are present and applies org
overrides, which can only narrow a rule. A reviewer can resolve a SYS-CLAIMS finding without returning the ad: they
add the claim from the finding or extend its scope. One fix resolves every finding it covers. The dashboard shows
role-aware counts that link to filtered lists. The promotions list has saved views (personal or shared) and CSV
export.

## Acceptance criteria
| Criterion | Status | Evidence |
|---|---|---|
| Claims and disclaimers have versions, review and audit; substantiation private | met (PGlite) | `p5_libraries.test.sql`; `evidence` bucket policies |
| Six claim classes raised correctly; numbers compared after normalisation | met | `backend/tests/claims.test.ts` (case 4 via the library) |
| Reviewers resolve library gaps without sending the ad back | met (PGlite) | `claim_add_from_finding`, `claim_extend_scope`, `resolve_claim_findings`; `ResponsesPanel` button |
| Dashboard, saved views and exports work for each role | met (unit) | `libraries.test.ts` (`summarize`, `claimsDue`, `promotionRows`); e2e for these screens **not run** |
| Gate, report, PROGRESS | met | below |

## Tests
- Added: pgTAP `p5_libraries`; Vitest `claims` (backend) and `libraries` (frontend, 4). Updated: `p2_rules` (51 rules),
  `no-cron-dependency` (reminders job).
- Gate: lint ✓ (0 errors, 17 warnings that were already there) · typecheck ✓ · unit ✓ (81 + 135) · deno check ✓ ·
  build ✓ · db reset **not run** (no Docker; PGlite smoke ✓ for all migrations, seed and pgTAP files) · e2e ✓ 33 offline;
  the 12 `public.spec` cases need a live database (**not run**, as in earlier phases) · creator eval = Phase 0 baseline
  (9/8/0) · eval v2 ✓ 24/24.

## Not done / deviations
- No `pg_trgm`: matching runs in TypeScript inside `analyze`, so normalisation matches the rule engine (D119).
- Saved views are on the promotions list only. The queue and the claims list have no saved views yet (D121).
- The two disclaimer templates and every SAMA reference stay proposals or drafts until a legal review.
- D119–D122.

## How to verify manually
1. «مكتبة الادعاءات» → «ادعاء جديد» → upload a substantiation file → «إرسال للاعتماد» → a reviewer approves.
2. Upload an ad that rewords the claim → no SYS-CLAIMS finding. Change the number → «ادعاء مختلف عن المعتمد».
3. On an unknown claim, the reviewer clicks «إضافة هذا الادعاء إلى المكتبة» → the finding resolves.
4. «الإفصاحات المطلوبة» → adopt a template → an ad without it gets SYS-DISCLAIMERS.
5. Rulebook → «تضييق نطاق القواعد لمؤسستك» → exclude a channel with a reason → the rule shows «استبعدتها مؤسستك».
6. Promotions list → save a view, share it, export CSV; the dashboard counts open filtered lists.
