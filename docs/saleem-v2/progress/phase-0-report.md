# Phase 0 report — Baseline, verification and hardening
Date: 2026-11-17 · Branch: v2/full-run · Commits: 290baef..(tag v2-phase-0)

## Outcome
The codebase is verified against the onboarding guide, a fresh `supabase db reset` no longer breaks
(it did before this phase), the known defects are fixed, and there is a test safety net for isolation,
i18n parity and the new behaviours. Users only see one change: when an analysis never starts, the check
page says «تعذّر بدء التحليل» with a retry button.

## Acceptance criteria
| Criterion | Status | Evidence |
|---|---|---|
| Discovery answers all 10 questions | met | `phase-0-discovery.md` |
| `db reset` succeeds from scratch | partly (not run) | No Docker. PGlite smoke harness: all migrations + seed apply (before the fix two migrations and the seed failed). Command for the user: `npx supabase db reset --workdir backend` |
| Pre-existing tests pass; isolation runs | partly | 38 frontend + 97 backend pass; isolation rewritten for local Supabase but **not run** (no Docker) |
| Rate-limit, stuck-code, trigger-failure fixes each have a test | met | `backend/tests/rate-limit.test.ts`, `backend/supabase/tests/p0_stuck_code.test.sql` + `frontend/src/test/model.test.ts`, `frontend/src/test/start-failed.test.tsx` |
| Cron migration has no hard-coded URL; old migration untouched | met | `backend/tests/cron-url.test.ts` |
| No behaviour change except the error/retry message | met | rate-limit 429 body unchanged; watchdog message now translated |
| CLAUDE.md, PROGRESS.md, DECISIONS.md, report | met | this commit |

## Changes
- Migrations: `20261014035900_v2_p0_fresh_reset_rulebook.sql` (fresh-reset fix, no-op on hosted DB);
  `20261117000000_v2_p0_stuck_code.sql`; `20261117000100_v2_p0_cron_vault_url.sql` — each with a rollback
  in `backend/supabase/rollbacks/`. `seed.sql`: rules conflict target.
- Edge Functions: `analyze` rate limit (`_shared/pipeline/rate-limit.ts`); all four import supabase-js 2.117.3.
- Frontend: `ProcessingView` start-failure alert + retry; `data.ts` `triggerAnalysis` returns a result,
  `startAnalysis`, `startFailed`; `model.ts` `analysisStartStalled`.
- Eval: `--offline` flag; baseline `backend/eval/results/baseline-v2-p0-deterministic.json` (12 cases,
  deterministic only: 9 hits, 8 misses, 0 false alarms — misses are model-only rules).
- i18n keys added: 3 (`pipelineErrors.stuck_timeout`, `processing.startFailedTitle/Body`).
- Docs: `CLAUDE.md`, README Vault note, `roadmap.md` stale banner.

## Tests
- Added: rate-limit, cron-url, local-db-guard, start-failed (3), i18n-parity (3), stuck-timeout translation,
  pgTAP `p0_stuck_code`. Updated: isolation (local mode).
- Gate: lint ✓ (0 errors, 17 pre-existing warnings) · typecheck ✓ · unit ✓ (38 + 97, 7 skipped) ·
  deno check ✓ (4 functions) · db reset **not run** (no Docker; PGlite smoke ✓) · isolation **not run** ·
  build ✓ (placeholder Supabase URL, D76) · e2e **not run** (suite reads the hosted project, D76).

## Not done / deviations
- `docs/ARCHITECTURE.md` is deleted in the working tree (user change), so no banner; `docs/SALEEM_AUDIT.md`
  no longer exists on disk (D67).
- Demo accounts: gating confirmed but default kept (D70).

## Risks and follow-ups
- Deploy needs `--include-all` because of the 035900 migration (D71) and a `project_url` Vault secret (D72).

## Decisions recorded
D67–D77.

## How to verify manually
1. `npx supabase start --workdir backend` then `npx supabase db reset --workdir backend` → no errors.
2. `npx supabase test db --workdir backend` → `p0_stuck_code` passes.
3. Set `SUPABASE_LOCAL_URL/ANON_KEY/SERVICE_ROLE_KEY` from `npx supabase status`, run `npm --workspace backend test` → isolation runs (not skipped).
4. In the app, create a check with the functions server stopped → after ~30 s «تعذّر بدء التحليل» appears; start `functions serve`, press «إعادة المحاولة» → processing continues.
