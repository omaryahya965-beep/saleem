# SALEEM v2 — Progress

> Claude Code updates this file at the end of every session, and after every slice in an autonomous full
> run. Keep it short and current. It is the source of truth for where the work stands.

**Mode:** autonomous full run (started 2026-11-17; see `AUTONOMOUS_RUN.md`).

## Current position

- Phase: 3 (Review)
- Task: discovery + plan
- Last commit: Phase 2 report (tag `v2-phase-2`)
- Next step: read `phases/phase-3-review.md`, `03_DATA_MODEL.md` M5–M6, `05_UX_SPEC.md` §2.4/§6.4–6.6; write `progress/phase-3-plan.md`.

## Status

| Phase | Status | Branch / tag | Report | Date |
|---|---|---|---|---|
| 0 Baseline | done (with not-run checks) | v2/full-run · v2-phase-0 | progress/phase-0-report.md | 2026-11-17 |
| 1 Promotions | done (with not-run checks) | v2/full-run · v2-phase-1 | progress/phase-1-report.md | 2026-11-18 |
| 2 Rule engine | done (with not-run checks) | v2/full-run · v2-phase-2 | progress/phase-2-report.md | 2026-11-18 |
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
- D76: no network calls to the hosted project during this run (eval offline, public e2e not run).
- D84: personal creators and org reviewers keep the old upload form; only org owners/admins/creators see the ad-context step.
- D80: deleting an organisation keeps its promotions as personal ones (org_id set to null).
- D92: Mawthooq creator rules no longer apply to a bank's own-channel financial promotions (they still apply to creators, agencies and influencer distribution).
- D95: the automated result labels changed from «جاهز للنشر» to «لا ملاحظات آلية» (and similar) on every screen.
- All SAMA/CMA rules are drafts; financial orgs see them only after opting in to the preview.

## Not run (environment) — run these before deploying

- `npx supabase start --workdir backend && npx supabase db reset --workdir backend`
- `npx supabase test db --workdir backend`
- A real analysis with the model (prompt v2 / schema v2 were only exercised with recorded output): `npm --workspace backend run smoke`, then one text, one image and one video check
- Isolation + DB tests: set `SUPABASE_LOCAL_URL`, `SUPABASE_LOCAL_ANON_KEY`, `SUPABASE_LOCAL_SERVICE_ROLE_KEY` (from `npx supabase status --workdir backend`), then `npm --workspace backend test`
- `npm --workspace frontend run e2e` against a local stack (the public spec needs demo data)
- On a copy of production after the Phase 1 migration: `select count(*) from submissions where promotion_id is null` → 0

## Decisions this programme (also in docs/DECISIONS.md)

- D67–D77 (Phase 0), D78–D87 (Phase 1), D88–D103 (Phase 2).
