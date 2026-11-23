# SALEEM deep cleanup report

Branch `chore/saleem-deep-cleanup`, created from `feature/saleem-v2-completion` at `9117b3f`/`ff30e2e`
(2026-11-24). Five phase commits plus this documentation commit, all local. Nothing was pushed, merged or deployed.

## A. Executive summary

I audited the whole repository: frontend, Edge Functions, shared backend modules, migrations and RLS, scripts,
docs, dependencies and build output. Dead code and files were removed only after a repo-wide reference check:
frontend, scripts, backend tests, CI and runbooks, plus dynamic imports and Edge Function entry points.

- **Duplicates:** real duplicated implementations were consolidated where they had the same meaning.
- **Bundle:** the first-load JavaScript dropped by 19% (gzip).
- **Database:** an additive index migration removes a sequential scan on the report path.
- **Security:** the audit found no authorization gap.
- **Behaviour:** the regulatory engine, RBAC, isolation, demo protections and every user journey checked below behave
  as before.

Duplication was already low: jscpd measured 0.43% of lines in 14 clones. Most of the gain came from deleting dead
material, not from refactoring.

## B. Repository before and after

| Measure | Before | After |
| --- | ---: | ---: |
| Tracked files | 745 | 696 |
| Frontend `src` lines (ts/tsx) | 55,083 | 54,752 |
| Script lines | 4,015 | 3,901 |
| Total diff vs. the feature branch | — | 92 files, +~470 / −5,876 lines |
| Unused dependencies | 1 (`vite-tsconfig-paths`) | 0 |
| Duplicated implementations consolidated | — | 4 groups (12 function client set-ups, 2 renderer helpers ×2, 1 reasons field ×2) |
| ESLint | 0 errors, 32 warnings | 0 errors, 31 warnings |
| First-load JS (static import graph of `index.html`) | 923,557 B / **291,142 B gzip** | 752,565 B / **235,302 B gzip** (−19%) |
| All JS | 3,263,479 B / 911,084 B gzip | 3,263,863 B / 911,914 B gzip (+1 lazy chunk) |

## C. Deleted files (and why they were safe)

| File(s) | Reason |
| --- | --- |
| `frontend/src/features/enterprise/FeatureFlagsCard.tsx`, `frontend/src/features/review/ResponsesPanel.tsx` | Not imported anywhere (static or dynamic), not routed, not tested. |
| `frontend/src/i18n/upgrade/*.mjs` (45 modules) | One-shot translation patches, all already merged into `ar.json`/`en.json` (the source of truth). Nothing imports them. `scripts/i18n-merge-upgrade.mjs` is kept for future patches. |
| `scripts/audit-before.mjs`, `crop.mjs`, `find-overflow.mjs`, `inspect-chevrons.mjs`, `probe-routes.mjs` | One-off debugging tools for the pre-v2 single-route UI (2026-10-14). Not referenced by package scripts, CI or runbooks. |
| `scripts/i18n-merge.mjs` | Superseded by `i18n-merge-upgrade.mjs`; unreferenced. |
| `roadmap.md` | Its own guides called it stale (unticked boxes, old numbers). References in `PROJECT_GUIDE.md` were updated. |
| `frontend/tsconfig.tsbuildinfo` | Generated TypeScript cache, committed by mistake. Now ignored, with `playwright-report/`. |
| 12 dead exports | `FixNotFound`, `isVoiceCached`, `DEMO_EMAILS`, `editComment`, `CLAIM_STATUSES`, `extendClaimScope`, `createPartnerLink`, `createPartnerPromotion`, `usePartnerInfo`, `RESOLVED_STATUSES`, `discardDraft`, `isSupabaseConfigured`. Each had no reference in its own file or anywhere else. The RPCs they wrapped are unchanged. |
| `vite-tsconfig-paths` (devDependency) | Not used: `vite.config.ts` declares the `@` alias itself. |

Not deleted on purpose:

- **Exports used inside their own file:** removing the `export` gains nothing.
- **Generators and fixture builders:** `gen-rules-data`, `build-demo-seed`, `make-*`, `tts`, `verify-extract`,
  `e2e-real-check` and the walkthrough scripts.
- **Sample media in `docs/saleem-v2/samples`:** evidence of the authorised live runs.
- **Screenshots and the historical V2 plans and reports:** they are linked from the programme rules and now indexed
  as history in `docs/README.md`.

## D. Refactored modules

- **`backend/supabase/functions/_shared/clients.ts`:** `serviceClient()` and `userClient(token)` replace the client
  construction copied into all 12 Edge Functions (12 service-role and 5 caller clients).
  - It is a separate file from `http.ts` so the Node unit tests that import `http.ts` keep working.
  - The authorization order in every function is unchanged.
- **`frontend/src/lib/canvas.ts`:** `wrapText` and `recordStream` replace the copies in `features/fix/mediaRender.ts`
  and `features/studio/render.ts`.
  - Studio keeps its «…» ellipsis and the media edit keeps its bitrate.
  - Verified by the full browser journey: rendered correction, MP4 download.
- **`frontend/src/features/review/RejectionReasonsField.tsx`:** one rejection-reasons field instead of two copies,
  in `DecisionDialog` and in the approval-flow step (`FlowPanel`). The validation logic stays in each dialog.
- **`frontend/src/i18n/index.tsx`:** English is a lazy chunk.
  - `setLang` switches only once the dictionary is loaded, so there's no blank page and no mixed language.
  - Tests preload English in `src/test/setup.ts`.

Intentional duplication that stays:

- **`lib/key-facts.ts` and `lib/api/studio.ts` (types):** these mirror backend `_shared` files that run in Deno. The
  frontend deploys on its own (Vercel root `frontend/`), and a test keeps `key-facts` byte-identical.
- **The claims «add URL» row in `ClaimsPage`/`LinkedClaims` (14 lines):** the two differ in upload handling and
  labels, and an abstraction would cost more than it saves.

## E. Security

Read-only checks on the isolated stack:

- **RLS:** enabled on every `public` table.
- **Anon writes:** no RLS policy lets the `anon` role insert, update or delete. The `anon` table grants are Supabase
  defaults and have no effect under RLS (see I-2).
- **`search_path`:** every `SECURITY DEFINER` function pins it.
- **Anon-callable definer functions:** each is either public by design (`get_shared_report`, `submit_share_review`,
  `verify_compliance_log`, `partner_link_info`, `authority_coverage`) or refuses callers without `auth.uid()`.
  - `partner_create_promotion` delegates to `_v2`, which raises `sign_in_required` for anonymous callers.
- **Edge Functions:** each checks the caller before using the service role:
  - JWT: `account`, `analyze`, `ask`, `cleanup-media`, `diagnostics`, `fix`, `studio`
  - RLS user client: `review-notify`, `internal-rules-draft`
  - cron secret: `cleanup-media`, `webhooks-deliver`
  - API key: `api`
  - `DEMO_MODE` and rate limits: `demo-login`
- **No regressions:**
  - No authorization boundary, RLS policy, quota or demo protection was changed.
  - All nine roles still see exactly their pages (persona check).
  - pgTAP RLS and permission suites pass.

## F. Database

- **New migration `20261124090000_v2_fk_indexes.sql`:** additive only, with `rollbacks/…down.sql`.
  - It indexes the hot-path foreign keys: `analysis_runs (submission_id, started_at desc)`, `frames`,
    `org_members (user_id)`, `org_invites (org_id)`, `review_events`, `finding_responses`, `review_decisions`,
    `share_links`, and `promotions (campaign_id)` / `(product_id)`.
  - Before, "latest analysis of a version", which reports, dashboards and review run constantly, was a sequential
    scan of `analysis_runs`; `EXPLAIN` now shows `Index Scan using analysis_runs_submission_idx`.
  - Verified on the isolated stack: apply, roll back, re-apply, a fresh `db reset`, and pgTAP 27 files / 279 checks.
  - **Not applied to the development or production database.**
- **Unchanged:** no historical migration was edited or deleted, and no table, row or rule was changed.
- **Deferred, needs approval:**
  - Revoking `insert/update/delete` from `anon` on public tables. Defence in depth: inert today under RLS, but it
    changes production grants.
  - About 60 remaining unindexed foreign keys on small or rarely joined tables. Add them only if `pg_stat_statements`
    shows a need.

## G. Performance

| | Before | After |
| --- | ---: | ---: |
| First-load JS, gzip | 291,142 B | 235,302 B (−55.8 KB, −19%) |
| `analysis_runs` lookup by version | Seq Scan | Index Scan |

English visitors download the English dictionary (about 60 KB gzip) on first use; the language switch waits for it.

## H. Test results (isolated stack `saleem_iso` only; deterministic providers, no AI request)

| Command | Result |
| --- | --- |
| `npm run lint` | 0 errors (31 warnings, all `react-refresh/only-export-components`, pre-existing) |
| `npm --workspace frontend exec tsc -- --noEmit -p .` | clean |
| `npm --workspace frontend run test` | 34 files, 168 passed |
| `npx --yes deno@2 check backend/supabase/functions/*/index.ts` | 12 functions, clean |
| `npm run build` | built, 13/13 routes prerendered |
| `node scripts/isolated-stack.mjs reset` + `test` (pgTAP) | 27 files, 279 checks, PASS |
| `node scripts/isolated-stack.mjs run -- npm --workspace backend test` | 27 files, 306 passed, 2 skipped (unchanged) |
| Workflows / isolation / demo-login suites with Edge Functions served | 15 passed, 2 skipped |
| `npm --workspace frontend run e2e` (Playwright, ar/en desktop + ar mobile) | 51 / 51 |
| `node scripts/personal-walkthrough.mjs` | 17 steps, 0 errors (below) |
| `node scripts/check-demo-personas.mjs` | 9 / 9 roles |
| `npm --workspace backend run eval -- --deterministic-only` | 26 cases, recall 0.81, precision 1.0 (unchanged) |

The full individual journey covered:

- individual demo login and the personal home
- upload and automatic analysis, with every authority considered: coverage for 10 authorities, the sector mismatch
  detected, the SFDA gap shown
- findings with their authority
- smart correction with an in-browser render (the refactored `canvas.ts`), comparison and re-analysis
- the MP4 download with the unresolved-findings warning
- the library and the rulebook, Ask SALEEM
- cross-session privacy in en-desktop, ar-mobile and en-mobile

No failure was introduced. One outdated step in the walkthrough script (it waited for the coverage cards that D219
removed from `/rules`) was updated.

## I. Remaining technical debt (priority order)

1. **High:** apply `20261124090000_v2_fk_indexes` to dev and production, with approval (see `RELEASE_PLAN.md`).
2. **Medium:** revoke the inert `anon` write grants on public tables, in a new migration, after review.
3. **Medium:** the rulebook page restored at the owner's request (D220/D224) labels every `is_active` rule «سارية
   ومطبقة», while the engine applies only `review_state = 'active'`. The page and the engine disagree; the owner
   decides.
4. **Medium:** 118 regulatory rules wait for their official texts and legal sign-off. Nothing was activated
   (hard rule 2.1).
5. **Low:** 31 `react-refresh/only-export-components` warnings. They are dev-only and would need constants or hooks
   moved out of component files.
6. **Low:** `RulePacks.tsx`, restored with the 85716c7 page, offers an organisation draft opt-in that no longer
   changes analysis (D217).
7. **Low:** frontend copies of backend types (`lib/api/studio.ts`) are kept in sync by hand. A generated shared
   package would remove the copy.
8. **Pending, unchanged:** the media-quality issues (video rendering, timing, narration, MP4 quality) remain a
   separate task. Nothing here claims to fix them.

## J. Git commits

| Commit | Purpose |
| --- | --- |
| `79252ce` | Phase B: verified dead code, files and dependency removed |
| `cb9462d` | Phase C: duplicated code consolidated (function clients, canvas helpers, reasons field) |
| `f7d9086` | Phase F: English dictionary lazy-loaded (−19% first-load JS) |
| `4efce7c` | Phase E: hot-path FK indexes + rollback, security audit notes, walkthrough step |
| (this commit) | Phase G: README developer setup and test gate, docs index, stale roadmap and tsbuildinfo removed, this report |

## K. Operational safety

- **Development database (`saleem`, 5432x):** not modified. It was only read by the browser on port 3000; no
  migration, test or seed ran against it.
- **Production database / hosted Supabase:** not touched (no `link`, `db push`, `secrets`, `functions deploy`).
- **External AI providers:** none called. The isolated stack ran with `SALEEM_TEST_PROVIDER=deterministic` and an
  empty `GEMINI_API_KEY`.
- **GitHub remote:** nothing pushed. **Vercel / deployed services:** nothing deployed.
- **Isolated stack (`saleem_iso`):** reset and re-seeded several times, as intended for destructive tests.
- **Not touched:** the untracked files at the repository root (`Nada_Cream_V2_with_audio.mp4`,
  `SALEEM_V2_UPGRADE.md`).
