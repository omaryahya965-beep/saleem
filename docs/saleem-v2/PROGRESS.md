# SALEEM v2 — Progress

> Claude Code updates this file at the end of every session, and after every slice in an autonomous full
> run. Keep it short and current. It is the source of truth for where the work stands.

**Mode:** autonomous full run (started 2026-11-17; see `AUTONOMOUS_RUN.md`).

## Current position

- Phase: 8 (steps 1–6, 8 and 10 done; step 7 blocked on the demo video; step 9 deploy not started)
- Task: waiting for the user — SAMA/CMA mapping approval, demo video, squash and deploy authorisation
- Last commit: Phase 8 reports (slice commits on `v2/full-run`, not squashed)
- Next step: the user annotates `docs/saleem-v2/legal/SAMA_CMA_MAPPING.md`, provides `demo/media/real-ad.mp4`, and frees disk space on C.

## Status

| Phase | Status | Branch / tag | Report | Date |
|---|---|---|---|---|
| 0 Baseline | done (with not-run checks) | v2/full-run · v2-phase-0 | progress/phase-0-report.md | 2026-11-17 |
| 1 Promotions | done (with not-run checks) | v2/full-run · v2-phase-1 | progress/phase-1-report.md | 2026-11-18 |
| 2 Rule engine | done (with not-run checks) | v2/full-run · v2-phase-2 | progress/phase-2-report.md | 2026-11-18 |
| 3 Review | done (with not-run checks) | v2/full-run · v2-phase-3 | progress/phase-3-report.md | 2026-11-18 |
| 4 Collaboration + PDF | done (with not-run checks) | v2/full-run · v2-phase-4 | progress/phase-4-report.md | 2026-11-18 |
| 5 Libraries + dashboard | done (with not-run checks) | v2/full-run · v2-phase-5 | progress/phase-5-report.md | 2026-11-18 |
| 6 Enterprise (P2) | done (with not-run checks; 6.3 external reviewer and 6.4 carousel not built) | v2/full-run · v2-phase-6 | progress/phase-6-report.md | 2026-11-18 |
| 7 Expansion (P3) | done (with not-run checks; API v1 read-only) | v2/full-run · v2-phase-7 | progress/phase-7-report.md | 2026-11-18 |
| 8 Docker gate, Saudi rules, roles, company rules | in progress (demo, mapping approval, deploy pending) | v2/full-run (slices) | progress/phase-8-report.md | 2026-11-18 |

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
- D105: human review is for organisation promotions; personal creators keep the automated check only.
- D118: `npm audit --omit=dev` reports pre-existing high advisories in build tooling (TanStack router plugin, Vite); upgrade them before relying on the CI audit step.
- D109: media of submitted/approved org versions is kept (no 24 h deletion); personal media still goes after 24 h.
- D121: saved views only on the promotions list for now (queue and claims scopes exist in the table, not in the UI).
- D122: the two disclaimer templates are proposals; nothing applies until an org adopts its own wording after legal review.
- D127: partner analyses use the partner's own plan quota; external_reviewer not built.
- D128: carousel analysis not built (variations + batch only).
- D129: a Thursday/Friday regulator notice is due Sunday; org holidays only editable in SQL.
- D131: without a model key, internal-rule drafts come from the guideline's directive sentences (marked).
- D133: the public API is read-only in this release (no write / analysis trigger).
- D132: self-approval blocked packs are set in SQL only.

## Not run (environment) — run these before deploying

- `npx supabase start --workdir backend && npx supabase db reset --workdir backend`
- `npx supabase test db --workdir backend`
- A real analysis with the model (prompt v2 / schema v2 were only exercised with recorded output): `npm --workspace backend run smoke`, then one text, one image and one video check
- Isolation + DB tests: set `SUPABASE_LOCAL_URL`, `SUPABASE_LOCAL_ANON_KEY`, `SUPABASE_LOCAL_SERVICE_ROLE_KEY` (from `npx supabase status --workdir backend`), then `npm --workspace backend test`
- `npm --workspace frontend run e2e` against a local stack (the public spec needs demo data)
- PDF upload in a real browser (text PDF and scanned PDF) and a Playwright journey for comments/compare
- Playwright journey for the review path (submit → decide → certificate) against a local stack
- On a copy of production after the Phase 1 migration: `select count(*) from submissions where promotion_id is null` → 0

## Decisions this programme (also in docs/DECISIONS.md)

- D67–D77 (Phase 0), D78–D87 (Phase 1), D88–D103 (Phase 2), D104–D112 (Phase 3), D113–D118 (Phase 4).
