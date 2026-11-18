# Autonomous full run — all phases in one continuous run

The user has asked Claude Code to implement the **whole** programme (Phases 0 → 7) end to end, without
waiting for approval between phases. This file changes **how the work is run**. Every product, legal and
engineering rule in `00_MASTER_PROMPT.md` §2 stays in force, except where §1 below says otherwise.

## 1. What this mode overrides

| Normal rule | In this mode |
|---|---|
| §0.2 "one phase per session", §7 step 4 "wait for go", §7 step 9 "stop" | Write the plan, then implement it immediately. When a phase is done (gate green, report written), start the next phase in the same run. Never ask "should I continue?". |
| §2.3 "stop and ask" | Decide and record (§3 below). Stop only for the hard stops in §2. |
| §2.2 rule 18, branches `v2/phase-N-<slug>` | One branch `v2/full-run`, created from the current default branch. Commit after every slice; tag `v2-phase-N` when phase N is done. Never push, never open a PR, never merge into the default branch. |
| "Phase N accepted" in phase preconditions | Means: phase N gate green (or only "not run" items, see §4), report written, tag created. |
| Phase 0 task 10 "ask the user about `docs/SALEEM_AUDIT.md`" | Leave the file exactly as it is (not committed, not deleted, not ignored); mention it in the final report. |
| Phase 6 "ask the user which order matters most" | Build 6.1 → 6.7 in file order, each behind its feature flag, default off. |
| Phase 7 "start only after P0–P2 are stable in production and the user picks items" | Build items 1, 2, 3 (Slack/Teams notifications only; no design-tool or drive imports), 4, 6 and 7, each behind a feature flag, default off. Item 5: make sure the CMA and insurance packs exist as **drafts** with their legal-review checklist; never activate them. |

## 2. Hard stops (never overridden)

**Never do, under any circumstance:**
- Deploy or change anything remote: `supabase db push`, `supabase functions deploy`, `supabase secrets …`,
  `supabase migration repair`, `supabase db dump`, any command with `--linked` or `--db-url`, any `npm run`
  script that deploys or pushes, `vercel`, `git push`, `gh pr …`, SQL against the hosted project. The user
  deploys later by writing "approved to deploy" in a session.
- Activate a regulatory rule (`review_state = 'active'` for SAMA, CMA or IA rules) or present a draft as
  reviewed. Legal review is a human step.
- Invent regulation, let AI approve anything, show forbidden copy, ship fake data or dead buttons, put
  secrets in the frontend, read or print secret values, drop/rename/truncate existing objects, edit an
  applied migration, change model names or providers.
- Stage `.env*` files, `.claude/settings.local.json` or anything containing a secret. Stage files by path;
  do not use `git add -A` or `git add .`.

**Stop the run and report when:**
1. A migration or backfill could lose or corrupt existing data and no additive alternative exists.
2. A P0 or P1 phase gate is **red** after three focused fix attempts on the same failure (three different
   hypotheses, each followed by a re-run). Later phases depend on it.
3. The work needs a production secret, a paid service, or a new external account.

For a P2/P3 sub-feature (Phase 6 or 7 item) that cannot be made green after three attempts: revert only
that sub-feature's commits, mark it "not done" with the reason in the phase report, and continue with the
next sub-feature.

On a stop: commit what is safe, write the phase report with status `blocked`, update `PROGRESS.md`, write
`progress/FINAL_REPORT.md` (§6), and tell the user exactly what is needed to continue.

## 3. Decide and record (instead of asking)

When something would normally be a question for the user:
1. Choose the most conservative reversible option: keep existing behaviour, keep data, keep new features
   off by default, keep regulatory rules in draft, add rather than replace.
2. Record it in `docs/DECISIONS.md` (continue the numbering) and add one line to "Assumptions to confirm"
   in `PROGRESS.md`.
3. Continue.

Known defaults:
- **Docker / local Supabase not available:** try `npx supabase start --workdir backend` once (and check
  `docker info`). If it cannot start, continue with everything that needs no database (types, unit tests,
  `deno check`, lint, build), still write every migration, rollback and SQL test, and mark each
  database-dependent check **"not run — no local database"**. Never use the hosted project instead.
- **Legal reviewer unknown:** all SAMA/CMA/IA rules stay draft; `include_draft_rules` stays false for real
  organisations; test fixtures may set it to true.
- **Stale docs:** add the banner, keep the content.
- **Local runs that need an API key** that is not in the local environment: use the mocked providers;
  skip the manual run and note it.
- **New dependencies:** only the pre-approved ones in §2.2 rule 15, each with a line in `DECISIONS.md`.

## 4. Order of work

Phases 0 → 7, in order. For each phase:
1. **Read** the phase file and the sections of `01`–`06` it references.
2. **Discover** (read-only): Phase 0 writes `progress/phase-0-discovery.md`; later phases put a short
   "Discovery" section at the top of their plan.
3. **Plan:** `progress/phase-N-plan.md`, one to two pages. Do not wait for approval.
4. **Implement in slices** (master §7 step 5). Commit each slice: `v2(phase-N): <what>`.
5. **Full gate** (master §7 step 6). A check that ran and failed is **red**: fix it. A check that could not
   run for an environment reason is **"not run"**: record it with the exact command for the user.
6. **Self-review** against §2 of the master prompt and the phase acceptance criteria.
7. **Report:** `progress/phase-N-report.md` (master §8); update `PROGRESS.md` and `docs/DECISIONS.md`;
   commit; `git tag v2-phase-N`.
8. **Continue** with the next phase immediately.

Never start a phase while an earlier P0/P1 gate is red.

## 5. Continuity on a long run

- **Files are the memory.** After every slice, update the "Current position" block in `PROGRESS.md`:
  phase, task, last commit, next step. It must be enough for a fresh session to continue.
- **After a context compaction or in a new session:** re-read `00_MASTER_PROMPT.md` §2, this file,
  `PROGRESS.md`, the current phase plan, `git log --oneline -20` and `git status`. Continue from the next
  unfinished task. Never redo finished work.
- Keep reads targeted: open the files you will change and search for the rest.

## 6. Final deliverables

When Phase 7 is finished, or a hard stop ends the run, write `docs/saleem-v2/progress/FINAL_REPORT.md`:
1. Per phase: status, what was built, gate results (green / red / not run), deviations.
2. Feature flags: each flag, what it enables, how an org admin turns it on.
3. Decisions and assumptions to confirm (links to `DECISIONS.md` numbers).
4. **Verify before deploy:** the exact local commands to run first, especially every "not run" check.
5. **Deployment runbook** for the user (not executed): back up the production database; apply migrations;
   deploy functions; the secrets that must exist (names only, never values); smoke tests.
6. **Legal-review checklist:** each draft SAMA/CMA/IA rule with its source article, for the reviewer.
7. Manual test script in Arabic (10–15 steps across the main journeys).

Then send the user a short summary **in Arabic**: what was done, what is blocked or not run, and what
they must do next.
