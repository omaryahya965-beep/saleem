# How to run this pack with Claude Code

## Setup (both options)

1. Copy the whole `docs/saleem-v2/` folder into the SALEEM repository (same path), next to the existing
   `docs/` content. Make sure `PROJECT_GUIDE.md` is at the repository root.
2. Open a terminal at the repository root and start Claude Code there.

Two ways to run it:

- **Option 1 — Full autonomous run:** Claude Code implements Phases 0 → 7 in one continuous run and only
  stops for the hard stops in `AUTONOMOUS_RUN.md` §2. Nothing is deployed.
- **Option 2 — Phase by phase:** one phase per session; Claude Code shows a plan and waits for `go`.
  More control, more of your time.

---

## Option 1 — Full autonomous run

### 1a. Let it run without asking for every command

Create `.claude/settings.local.json` at the repository root (merge the lists if the file already exists)
and add `.claude/settings.local.json` to `.gitignore`. File edits and the listed commands then run
without prompts; the `deny` list blocks every deploy and remote command even if something goes wrong.
Settings files must be strict JSON (no comments, no trailing commas).

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(npm run *)",
      "Bash(npm test *)",
      "Bash(npm install *)",
      "Bash(npx vitest *)",
      "Bash(npx playwright *)",
      "Bash(npx tsc *)",
      "Bash(npx eslint *)",
      "Bash(npx prettier *)",
      "Bash(npx supabase start *)",
      "Bash(npx supabase stop *)",
      "Bash(npx supabase status *)",
      "Bash(npx supabase db reset *)",
      "Bash(npx supabase test db *)",
      "Bash(npx supabase migration new *)",
      "Bash(npx supabase gen types *)",
      "Bash(npx supabase functions serve *)",
      "Bash(deno check *)",
      "Bash(deno test *)",
      "Bash(docker info *)",
      "Bash(docker ps *)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git switch *)",
      "Bash(git checkout *)",
      "Bash(git branch *)",
      "Bash(git tag *)"
    ],
    "deny": [
      "Bash(git push *)",
      "Bash(gh pr *)",
      "Bash(vercel *)",
      "Bash(npx vercel *)",
      "Bash(npm run *deploy*)",
      "Bash(npm run *push*)",
      "Bash(*supabase*db push*)",
      "Bash(*supabase*functions deploy*)",
      "Bash(*supabase*secrets*)",
      "Bash(*supabase*migration repair*)",
      "Bash(*supabase*db dump*)",
      "Bash(*supabase*projects*)",
      "Bash(*--linked*)",
      "Bash(*--db-url*)"
    ]
  }
}
```

Other commands will still ask once; choose "Yes, and don't ask again" only for commands that are safe.
If your plan offers auto mode, `claude --permission-mode auto` prompts even less; the deny list still
applies. Do not use `bypassPermissions` on your own machine.

### 1b. Prompt for the run

```text
Implement the whole SALEEM v2 programme in this session: Phases 0 to 7, from start to finish, without
stopping for my approval between tasks or phases.

SALEEM (سَليم) is an existing, working Arabic-first pre-publication ad compliance app. Evolve it into an
enterprise review-and-approval platform for Saudi organisations, financial sector first, without breaking
anything that works today.

1. Read docs/saleem-v2/00_MASTER_PROMPT.md completely, then docs/saleem-v2/AUTONOMOUS_RUN.md.
   AUTONOMOUS_RUN.md is my instruction for this run: do not wait for "go", do not stop after a phase,
   and when something would be a question for me, choose the conservative default it describes, record
   it in docs/DECISIONS.md and under "Assumptions to confirm" in PROGRESS.md, and continue. Every other
   hard rule in the master prompt still applies.
2. Read docs/saleem-v2/PROGRESS.md, AGENTS.md and PROJECT_GUIDE.md (a map that may be out of date; the
   code wins). Set the Mode in PROGRESS.md to "autonomous full run". Create the branch v2/full-run from
   the current default branch and commit docs/saleem-v2/ (and PROJECT_GUIDE.md if untracked) as the
   first commit.
3. Run Phases 0 → 7 in order. For each phase: read its file in docs/saleem-v2/phases/ and the sections
   of 01–06 it references, write the plan, implement in small slices with tests, commit after each slice,
   run the full quality gate, fix until green, self-review, write the phase report, update PROGRESS.md
   and docs/DECISIONS.md, tag v2-phase-N, then continue immediately with the next phase.
4. Never deploy or touch anything remote: no supabase db push / functions deploy / secrets, no --linked
   or --db-url, no vercel, no git push, no pull requests. Never activate a regulatory rule: SAMA, CMA
   and insurance rules stay draft until a human legal review. AI never approves. No invented
   regulation, no fake data or dead buttons, no secrets in the frontend, additive migrations only, and
   never stage .env files or .claude/settings.local.json.
5. Stop early only for the hard stops in AUTONOMOUS_RUN.md §2. Do not ask me whether to continue.
6. After every slice, update "Current position" in PROGRESS.md. If your context is compacted, re-read
   00_MASTER_PROMPT.md §2, AUTONOMOUS_RUN.md, PROGRESS.md, the current phase plan, git log and git
   status, and continue from the next unfinished task.
7. When Phase 7 is done (or a hard stop ends the run), write docs/saleem-v2/progress/FINAL_REPORT.md as
   AUTONOMOUS_RUN.md §6 describes, then give me a short summary in Arabic: what was built, what is
   blocked or not run, and what I must do next (verify, legal review, deploy).
```

### 1c. If the session ends before the run is finished

Usage limits or a closed terminal can end a long run. Start a new Claude Code session at the repository
root and paste:

```text
Continue the SALEEM v2 autonomous full run on branch v2/full-run. Read docs/saleem-v2/00_MASTER_PROMPT.md
§2, docs/saleem-v2/AUTONOMOUS_RUN.md, docs/saleem-v2/PROGRESS.md and the current phase plan, then run
`git log --oneline -20` and `git status`. Continue from the next unfinished task with the same rules,
without waiting for my approval, until docs/saleem-v2/progress/FINAL_REPORT.md is written.
```

### 1d. When it finishes

Read `docs/saleem-v2/progress/FINAL_REPORT.md`, run its "verify before deploy" commands, follow its
Arabic manual test script, and give the legal-review checklist to a qualified reviewer. Each phase is a
tag (`v2-phase-0` … `v2-phase-7`), so you can review them one by one with `git diff v2-phase-1 v2-phase-2`.

---

## Option 2 — Phase by phase

### First-session prompt (Phase 0)

```text
You are going to evolve SALEEM (سَليم), an existing and working Arabic-first pre-publication ad
compliance app, into an enterprise review-and-approval platform for Saudi organisations, starting with
the financial sector, without breaking what works.

1. Read docs/saleem-v2/00_MASTER_PROMPT.md completely. It is your operating manual: follow its hard
   rules and session protocol exactly.
2. Read docs/saleem-v2/PROGRESS.md, then docs/saleem-v2/phases/phase-0-baseline.md, and the parts of
   01–06 that phase references. Also read AGENTS.md and PROJECT_GUIDE.md (treat the guide as a map that
   may be out of date; the code wins).
3. Do Phase 0 discovery only (read-only). Write docs/saleem-v2/progress/phase-0-discovery.md and
   docs/saleem-v2/progress/phase-0-plan.md.
4. Show me a short summary of the plan and your questions. Do not change any other file until I reply "go".
```

### Next-session prompt (replace N)

```text
Continue the SALEEM v2 programme with Phase N.
Read docs/saleem-v2/00_MASTER_PROMPT.md, docs/saleem-v2/PROGRESS.md, the previous phase report in
docs/saleem-v2/progress/, and docs/saleem-v2/phases/phase-N-*.md (plus the 01–06 sections it references).
Run the discovery steps, write docs/saleem-v2/progress/phase-N-plan.md, show me the summary and your
questions, and wait for "go" before changing anything else.
```

### If a session runs out of context mid-phase

```text
We are in the middle of SALEEM v2 Phase N. Read docs/saleem-v2/00_MASTER_PROMPT.md,
docs/saleem-v2/PROGRESS.md and docs/saleem-v2/progress/phase-N-plan.md, then `git log --oneline -20`
and `git status`. Tell me which plan tasks are done and which remain, then continue from the next
unfinished task. Same rules as before: tests and the full gate before reporting.
```

---

## Deployment (only when you decide, either option)

Claude Code never deploys on its own. When the work is accepted and you want it live, start a session
and write: `approved to deploy` — it lists the exact commands from the runbook (`db push`,
`functions deploy`, `secrets set`) for you to confirm one by one, and reminds you to back up the
production database first. With the deny list above in place, you run those commands yourself in a
terminal, or remove the matching deny rules for that session.
