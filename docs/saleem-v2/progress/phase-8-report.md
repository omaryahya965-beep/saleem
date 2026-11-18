# Phase 8 report — Docker gate, Saudi rules v0.1, roles, company rules

Date: 2026-11-18 · Branch: `v2/full-run`. The Phase 8 slice commits are kept as they are (not squashed). Nothing has
been deployed or pushed.

## Outcome by step

| Step | Status | What was built | Not done or not verified |
|---|---|---|---|
| 1 Cleanup | done | 282 old files deleted; links fixed | — |
| 2 One commit per phase | done | Phases 0–7 rebuilt with trees equal to their tags; tags moved; backup `v2/full-run-backup` | Phase 8 squash on hold: the user asked for no squash without authorisation |
| 3 Docker + «الميزات» | done | `supabase start`, `db reset`, pgTAP, isolation and e2e against the real database; «الميزات» page | — |
| 4 Saudi rules v0.1 | done (see below) | 187 rules and 19 sources from the CSVs; scope; check_mode semantics; evidence policy; «الحزم المطبّقة ولماذا»; mapping report | SAMA/CMA mapping **awaits the user's approval**; legal review of all drafts |
| 5 Roles | done | Compliance lead and viewer; one matrix (TS → SQL → generated tests); roles page; role home; `ROLES_AND_FLOW.md` | Live role counts are taken at deploy |
| 6 Company rules | done | Versions, approval by another person, «جرّب القاعدة», `?t=` seek links | «جرّب القاعدة» with a live model: **NOT VERIFIED** |
| 7 Real demo | blocked | — | `demo/media/real-ad.mp4` is missing (the user will provide it) |
| 8 Full gate | done locally | See Tests | e2e flakes under load: environment (D149) |
| 9 Deploy | not started | — | The user said not to deploy yet |
| 10 Reports | done | This report, PROGRESS, DECISIONS (D138–D149), FINAL_REPORT §8 | — |

## Step 4 detail
- **Scope:**
  - BANK and CMA packs follow the organisation sector.
  - SALE, COMP and PD need a content signal (`discount_sale`, `contest_or_prize`, `direct_marketing`); MEDIA needs
    influencer distribution.
  - The other sector packs are opt-in per organisation.
  - Rules out of scope are listed with the reason (sector, product type, channel, audience, missing signal, pack
    disabled, draft excluded, possible duplicate, organisation override).
- **check_mode** (D142):

  | Mode | Behaviour |
  |---|---|
  | content | Checked from the ad; incomplete analysis → «تعذّر التحقق» |
  | document | «يحتاج مستنداً» only, never a violation from the ad, never sent to the model |
  | workflow | A reviewer checklist item, never a model guess |
  | hybrid | Capped at «خطر محتمل», with the evidence requested |

- **On each finding:** `evidence_policy_ar` (and for hybrid rules `evidence_request_ar`), `check_mode`, and
  `rule_version`. The draft label reads «قاعدة مسودة — قيد المراجعة القانونية».
- **In the report:** «الحزم المطبّقة ولماذا» (creator default, always on, chosen by the organisation, sector default),
  with how many rules were in scope; the reviewer checklist; and the not-applicable reasons.
- **SAMA/CMA mapping** (`docs/saleem-v2/legal/SAMA_CMA_MAPPING.md`):
  - 50 pairs: 33 Exact Match (citation), 16 Possible Match, 1 No Match (SAMA-ADV-16). 21 CSV rules have no old
    counterpart.
  - Effective dates and official article text are not in either dataset; the report says so.
  - No rule was superseded, merged, deleted or deactivated.
  - 44 new drafts are kept out of analyses until you decide.

## Tests (last full run, local Docker)

| Check | Result |
|---|---|
| `supabase db reset` | ✓ |
| pgTAP | ✓ 19 files (270 test points; `p8_roles_matrix` alone runs 252 assertions) |
| Backend vitest | ✓ 159 passed (incl. 10 Phase 8 engine tests and the two-user isolation test); 2 skipped (need `functions serve`) |
| Frontend vitest | ✓ 94 |
| Lint | ✓ 0 errors |
| Typecheck | ✓ |
| `deno check` | ✓ 10 functions |
| Build | ✓ |
| e2e (3 workers) | ✓ 135/135 over 3 repeats, incl. `public.spec` on the real database |
| Creator eval | = baseline 9/8/0 |
| Eval v2 | ✓ 24/24 (precision and recall 1.0) |

**Bugs found by the real database and fixed:**
- Column grants that restricted nothing (D139).
- The viewer could comment.
- An author could approve their own company rule.
- `/rules` showed each rule twice (two releases).

## NOT VERIFIED
- Any live model run: «جرّب القاعدة», a real analysis with the new packs, hybrid and content findings from a model.
- Edge functions under `supabase functions serve` (the 2 skipped isolation checks).
- Webhook, Slack and Teams delivery; the PDF browser path.
- The e2e flakes under parallel load are attributed to drive C being nearly full (D149). Confirm on a machine with
  free disk space.

## Blockers and decisions for the user
1. **Approve or annotate** `SAMA_CMA_MAPPING.md` (Verified Equivalent / not a match / needs research for each pair).
   No regulatory rule status changes before that.
2. **Demo video** `demo/media/real-ad.mp4` (step 7).
3. **Deploy approval** (step 9), after 1 and 2.
4. **Squash:** whether to squash the Phase 8 slice commits into one (needs your authorisation).
5. **Disk:** drive C has about 1 GB free, which makes the local gate unreliable.
