# SALEEM v2 — Progress

> Claude Code updates this file at the end of every session, and after every slice in an autonomous full
> run. Keep it short and current. It is the source of truth for where the work stands.

**Mode:** autonomous full run (started 2026-11-17; see `AUTONOMOUS_RUN.md`).

## Current position

- Phase: 1 (Promotions)
- Task: discovery + plan
- Last commit: Phase 0 report (tag `v2-phase-0`)
- Next step: read `phases/phase-1-promotions.md` and `03_DATA_MODEL.md` M1–M2; write `progress/phase-1-plan.md`.

## Status

| Phase | Status | Branch / tag | Report | Date |
|---|---|---|---|---|
| 0 Baseline | done (with not-run checks) | v2/full-run · v2-phase-0 | progress/phase-0-report.md | 2026-11-17 |
| 1 Promotions | not started | – | – | – |
| 2 Rule engine | not started | – | – | – |
| 3 Review | not started | – | – | – |
| 4 Collaboration + PDF | not started | – | – | – |
| 5 Libraries + dashboard | not started | – | – | – |
| 6 Enterprise (P2) | not started | – | – | – |
| 7 Expansion (P3) | not started | – | – | – |

Status values: not started · planning · waiting for "go" · in progress · done · done (with not-run
checks) · blocked.

## Verified facts (filled in Phase 0)

- See `progress/phase-0-discovery.md`. Key differences from PROJECT_GUIDE: analysis status enum is
  `queued, extracting, transcribing, analyzing, done, failed` (cancel = failed + `cancelled_by_user`);
  `rules.code` is unique per rulebook version; owners cannot write results (service role only);
  test accounts are shown unless `VITE_SHOW_TEST_ACCOUNTS=false`.
- A fresh `db reset` was broken before Phase 0 (fixed, D71).
- No Docker in this environment; Deno via `npx --yes deno@2`.

## Open questions for the user

- Who is the legal reviewer who can activate the SAMA draft rules (name and capacity)?

## Assumptions to confirm (autonomous run: decisions taken without asking)

- D67: the deletion of the old `docs/` tree in your working tree is yours and was left uncommitted.
- D70: test accounts stay visible on the sign-in page by default (set `VITE_SHOW_TEST_ACCOUNTS=false` in production to hide).
- D71: the next deploy uses `supabase db push --include-all` (one older-timestamp, idempotent migration).
- D72: a Vault secret `project_url` must be created on the hosted project before the cleanup cron works again.
- D76: no network calls to the hosted project during this run (eval offline, e2e not run).

## Not run (environment) — run these before deploying

- `npx supabase start --workdir backend && npx supabase db reset --workdir backend`
- `npx supabase test db --workdir backend`
- Isolation + DB tests: set `SUPABASE_LOCAL_URL`, `SUPABASE_LOCAL_ANON_KEY`, `SUPABASE_LOCAL_SERVICE_ROLE_KEY` (from `npx supabase status --workdir backend`), then `npm --workspace backend test`
- `npm --workspace frontend run e2e` against a local stack

## Decisions this programme (also in docs/DECISIONS.md)

- D67–D77 (Phase 0).
