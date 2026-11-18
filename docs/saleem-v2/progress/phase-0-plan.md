# Phase 0 plan — Baseline and hardening

Discovery: see `phase-0-discovery.md`. Key constraint: **no Docker → no local Supabase**. Every
database-dependent check is written and marked "not run — no local database" (AUTONOMOUS_RUN §3).

## Supplementary SQL verification (not a gate substitute)

To avoid shipping never-executed SQL, migrations are smoke-applied in a scratch harness (PGlite —
Postgres compiled to WASM — installed in the session scratchpad, **not** a project dependency) with stubs
for `auth`, `storage`, `vault`, `cron`, `net`. It catches syntax and ordering errors only; it does not
replace `supabase db reset` (D69).

## Tasks (in order)

| # | Task | Files | Test |
|---|---|---|---|
| 1 | Local stack attempt + baseline | discovery file | — (done: not available) |
| 2 | `CLAUDE.md` pointer file | `CLAUDE.md` | — |
| 3 | Lint baseline fix (Prettier error) | `ReportView.tsx` | `npm run lint` |
| 4 | Rate limit: count runs started by the user in the last hour, block at `>= limit` | `_shared/pipeline/rate-limit.ts` (pure), `analyze/index.ts` | `backend/tests/rate-limit.test.ts` (30th allowed, 31st blocked) |
| 5 | Stuck code: `fail_stuck_submissions` writes `code:stuck_timeout`; i18n `errors.stuck_timeout` | migration `20261117000000_v2_p0_stuck_code.sql` + rollback | SQL test file + frontend error-mapping test |
| 6 | Trigger failure visibility: `triggerAnalysis` returns ok/error; CheckPage shows «تعذّر بدء التحليل» + retry when invoke failed or `queued` > 30 s with no heartbeat; analyze stays idempotent | `data.ts`, `CheckPage.tsx`/`ProcessingView.tsx`, i18n | component test |
| 7 | Cron URL from Vault secret `project_url` | migration `20261117000100_v2_p0_cron_vault_url.sql` + rollback; README deploy note | `no-cron-dependency`-style static test: new migration has no hard-coded URL |
| 8 | Isolation tests: env guard for local Supabase (`SUPABASE_LOCAL_URL` + keys) | `isolation.test.ts`, docs | runs when env present; not run here |
| 9 | Edge supabase-js align to 2.117.x if `deno check` + tests pass | 4 function files | `deno check` |
| 10 | Demo accounts: verify gating; keep behaviour (D70) | — | — |
| 11 | Stale docs banner on `roadmap.md`; `ARCHITECTURE.md` deleted in tree → noted | `roadmap.md` | — |
| 12 | i18n key parity test (if missing) | `frontend/src/test/i18n-parity.test.ts` | itself |
| 13 | Baseline eval `--deterministic-only` | `backend/eval/results/` | record path |
| 14 | Report, PROGRESS, DECISIONS (restore `docs/DECISIONS.md` from HEAD, D67+) | docs | — |

## Risks

- Working tree deletes the old `docs/` tree. Conservative choice (D67): do not commit those deletions;
  restore only `docs/DECISIONS.md` (the programme must append to it) and leave the rest as the user's
  pending change.
- `fail_stuck_submissions` replacement must keep its signature and grants.
