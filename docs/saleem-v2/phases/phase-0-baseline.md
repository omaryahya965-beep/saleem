# Phase 0 — Baseline, verification and hardening (P0)

**Goal:** know exactly what exists, make the safety net work, and fix the known defects — with no
change to product behaviour except clearer error handling.

**Why:** every later phase changes the schema and the pipeline. Without verified facts, running tests and
a working local database, those changes are guesses.

## 0.1 Discovery (read-only)

Run and read; record results in `docs/saleem-v2/progress/phase-0-discovery.md` as a table
«Claim in PROJECT_GUIDE → Verified / Different (what) / Not found».

```bash
git status && git log --oneline -15 && git branch -a
cat package.json frontend/package.json backend/package.json      # exact script names
ls backend/supabase/migrations backend/supabase/functions backend/tests backend/eval frontend/e2e
grep -n "create table\|create type\|create or replace function\|create policy\|cron.schedule" backend/supabase/migrations/*.sql
grep -rn "org_members\|finding_feedback\|audit_events\|share_reviews\|batches\|ai_settings" backend/supabase/migrations frontend/src --include=*.sql --include=*.ts --include=*.tsx | head -100
sed -n '1,140p' backend/supabase/functions/analyze/index.ts      # then read the rest in chunks
ls frontend/src/routes frontend/src/routes/_app frontend/src/features/*
cat AGENTS.md; ls docs; cat docs/DECISIONS.md | tail -40
```

Answer explicitly in the discovery file:
1. Exact type of `org_members.role` (enum name or text + check) and its values.
2. Columns of `submissions`, `findings`, `finding_feedback`, `audit_events`, `rules`, `rulebook_versions`,
   `share_reviews`, `notifications`, `analysis_runs`. Is there a title/name for a submission? Where are
   platform / paid / product category stored?
3. Existing helper functions used by RLS (`can_read_submission`, etc.) and how org membership is checked.
4. How rulebook versions are created and activated (seed, admin UI, RPC).
5. Is batch upload implemented end-to-end (`batches`, `batch_id`, UI)? Are there comments anywhere?
6. Does `audit_events` have a generic append-only shape usable for review events? (Decide M5 strategy.)
7. Where the suggested fix lives on a finding today.
8. How `compute_report_hash` and `seal_compliance_log` use pgcrypto (schema name of `digest`).
9. Whether Docker + Supabase CLI work locally (`npx supabase --version`, `docker info`).
10. The last decision number in `docs/DECISIONS.md`.

## 0.2 Plan and wait

Write `progress/phase-0-plan.md`, summarise, **wait for "go"**.

## 0.3 Tasks (after "go")

1. **Local stack.** `npx supabase start --workdir backend`; `npx supabase db reset --workdir backend`;
   run every test script; record the baseline (passed/failed/skipped) in the plan file. If Docker is not
   available: stop and ask (see master §2.3).
2. **Project memory for future sessions.** Create or update `CLAUDE.md` at the repo root (short): points
   to `AGENTS.md`, `PROJECT_GUIDE.md`, `docs/saleem-v2/00_MASTER_PROMPT.md`, `docs/saleem-v2/PROGRESS.md`,
   and lists the quality-gate commands. Do not duplicate content.
3. **Rate limit fix** (`analyze/index.ts` ~L382): count analysis starts for the user in the last hour
   (e.g., `analysis_runs` created by this user's submissions, or a dedicated table if simpler) and block
   when `count >= limit`. Keep `ANALYZE_RATE_LIMIT_PER_HOUR` (default 30). Unit test: the 31st call is
   blocked, the 30th is not.
4. **Stuck-submission error code**: new migration replacing `fail_stuck_submissions` so it writes
   `code:stuck_timeout`; add `errors.stuck_timeout` to `ar.json`/`en.json`; test.
5. **Failed trigger visibility**: when `triggerAnalysis` fails (or a submission stays `queued` for > 30 s
   without heartbeat), `CheckPage` shows «تعذّر بدء التحليل» with «إعادة المحاولة» that re-invokes
   `analyze`; the function must be idempotent for an already-running submission. Component test.
6. **Cron URL**: new migration that unschedules the jobs created with the hard-coded project URL and
   reschedules them reading the URL from Vault (e.g., secret `project_url`) — keep the existing
   `x-cron-secret` mechanism. Document the required Vault secret in `README.md` deployment notes. Do not
   change the remote project; this only takes effect on the next approved deploy.
7. **Isolation tests**: un-skip `backend/tests/isolation.test.ts` when a local Supabase URL is present
   (env guard), make them pass, document how to run them.
8. **Edge `supabase-js` version**: try aligning the esm.sh import with the frontend major/minor; keep
   only if `deno check` and pipeline tests pass; otherwise record the reason in DECISIONS and keep 2.49.1.
9. **Demo credentials**: confirm `VITE_SHOW_TEST_ACCOUNTS` gates their display and production builds do
   not show them by default; do not remove the demo account.
10. **Stale docs**: add a banner at the top of `docs/ARCHITECTURE.md` and `roadmap.md` («هذا الملف قديم؛
    المرجع الحالي PROJECT_GUIDE.md و docs/saleem-v2») — do not delete content. Ask the user whether
    `docs/SALEEM_AUDIT.md` should be committed or ignored (autonomous full run: leave it untouched and
    mention it in the final report).
11. **i18n key parity test** if none exists.
12. **Baseline eval**: run `--deterministic-only` and record the output path in the report (no claims).
13. **PROGRESS.md**: fill in Phase 0 status, verified facts, open questions.

## 0.4 Acceptance criteria

- [ ] `phase-0-discovery.md` answers all 10 questions with file/line evidence.
- [ ] `db reset` succeeds locally from scratch.
- [ ] All pre-existing tests pass (or each failure is explained and fixed); isolation tests run and pass.
- [ ] Rate-limit, stuck-code and trigger-failure fixes each have a test.
- [ ] The cron migration no longer contains a hard-coded project URL; old migration untouched.
- [ ] No user-visible behaviour change other than the new error/retry message.
- [ ] `CLAUDE.md`, `PROGRESS.md`, `docs/DECISIONS.md` updated; phase report written.

## 0.5 Out of scope

Schema changes for v2 features, UI redesign, new rules.
