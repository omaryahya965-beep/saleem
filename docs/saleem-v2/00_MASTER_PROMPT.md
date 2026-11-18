# SALEEM v2 — Master Implementation Prompt

> You are Claude Code working inside the SALEEM (سَليم) repository.
> This file is your operating manual for a multi-session programme that evolves SALEEM from a working
> creator-compliance prototype into an Arabic-first, enterprise pre-publication **review and approval**
> platform for Saudi organisations, starting with the financial sector.
> Read this file completely before doing anything else, every session.

---

## 0. How to use this pack

### 0.1 Files in this pack (read in this order the first time)

| # | File | What it gives you |
|---|------|-------------------|
| 1 | `00_MASTER_PROMPT.md` (this file) | Mission, hard rules, domain model, state machines, protocol, reporting |
| 2 | `PROGRESS.md` | What previous sessions finished, open questions, next step. **Source of truth for where we are.** |
| 3 | `01_REFERENCE_PRODUCT.md` | The capabilities we are learning from (Adclear and four competitors), translated into SALEEM decisions |
| 4 | `02_SAUDI_RULES.md` | Regulatory sources, rule packs, the SAMA draft rules, rule lifecycle and legal-review policy |
| 5 | `03_DATA_MODEL.md` | Every schema change, in migration order, with RLS, indexes, backfill and rollback |
| 6 | `04_AI_PIPELINE.md` | The analysis pipeline v2 contract: context, rule selection, checks, finding schema, coverage, merge |
| 7 | `05_UX_SPEC.md` | Information architecture, screens, components, RTL rules, Arabic copy glossary |
| 8 | `06_TEST_PLAN.md` | Test layers, the 15 acceptance cases, metrics, regression policy |
| 9 | `phases/phase-N-*.md` | One file per phase: scope, tasks, files, migrations, tests, acceptance criteria |
| 10 | `AUTONOMOUS_RUN.md` | Only when the user asks for a full autonomous run: how to run all phases without waiting, decide-and-record defaults, hard stops |

The repository also contains `PROJECT_GUIDE.md` (an onboarding guide written by a previous Claude Code
session after reading the code) and `AGENTS.md`. Treat `PROJECT_GUIDE.md` as a **map that may be wrong**:
the code and the migrations are the ground truth. When they disagree, the code wins and you record the
difference in `progress/phase-0-discovery.md`.

### 0.2 One phase per session

Every session follows the protocol in §7. In short:

1. Read this file, `PROGRESS.md`, and the current phase file.
2. Run the phase's discovery steps (read-only).
3. Write `progress/phase-N-plan.md` and show the user a short summary.
4. **Wait for the user to reply "go"** before changing any file outside `docs/saleem-v2/progress/`.
5. Implement in small, tested, committed steps.
6. Write `progress/phase-N-report.md`, update `PROGRESS.md` and `docs/DECISIONS.md`, then stop.

Never start the next phase in the same session unless the user explicitly asks. **Exception:** when the
user asks for an autonomous full run, follow `AUTONOMOUS_RUN.md`: plans are still written and reports
still filed, but there is no waiting for "go" (step 4) and no stop after a phase (step 6).

---

## 1. Mission

### 1.1 What SALEEM is today (verify in Phase 0)

SALEEM checks advertising content **before publication** against Saudi rules. A user uploads a video,
image or text with simple context; the browser extracts frames (1 fps, max 768px), a 16 kHz WAV and a
speech probe; the `analyze` Edge Function transcribes (Whisper), runs a vision/reasoning model with
strict JSON output, runs deterministic Arabic regex checks, merges results, blurs evidence frames,
stores findings, seals a compliance log with a hash, and notifies the user. A public `/verify/$id`
page checks the seal. Organisations (agencies) have members with roles, campaigns, and brand share
links. Media is deleted after 24 hours. There are 12 rules aimed at creators (Mawthooq, GCAM, SDAIA,
Ministry of Commerce), all with `source_verified = false`.

Stack: TypeScript strict, React 19, Vite, TanStack Router (file-based) and Query, Tailwind 4, Radix,
Supabase (Postgres 17, Auth, Storage, Edge Functions on Deno, pg_cron, pg_net, Vault), OpenAI
(`whisper-1` and the model configured in env), Resend, Vitest, Playwright, Vercel, GitHub Actions.

### 1.2 What SALEEM must become

An Arabic-first platform where Saudi organisations — **financial institutions first** (banks, finance
companies, payments/fintech under SAMA; then capital-market firms under CMA; then insurers under the
Insurance Authority) — run every advertisement through:

1. **Context-aware automated review** against official Saudi rules, internal policies, approved claims,
   approved disclaimers and approved product facts — with every finding typed, located, explained and
   cited, and with an honest report of what could not be checked.
2. **Human review and approval** with a clear state machine, separation of duties, structured
   responses to AI findings, comments pinned to the asset, versions, escalation to legal, and a sealed,
   tamper-evident decision record.
3. **Operational visibility**: queue, dashboard, audit log, and (later) analytics.

SAMA's *Rules for Advertising Products and Services Provided by Financial Institutions* (No. 44064343,
13/8/1444H, in force) require the compliance function to approve advertising material **in writing
before publication** (Article 15). SALEEM's core promise is to make that approval fast, consistent and
provable.

The creator/media rules and flows that exist today **stay**: they become the `sa-gmedia-creators` rule
pack and keep serving individual creators and agencies. An ad a bank publishes through an influencer
must satisfy both the SAMA pack and the creator pack.

### 1.3 Positioning constraints

- AI advises; an authorised human decides. SALEEM never approves anything by itself.
- SALEEM never claims regulator endorsement and never shows "100% compliant".
- Arabic is the primary language; English is supported.
- Pre-publication only. Post-publication monitoring is **out of scope** for this programme.

---

## 2. Hard rules (non-negotiable)

Violating any of these is a failed phase, even if features work.

### 2.1 Product and legal

1. **No invented regulation.** Rules come only from `02_SAUDI_RULES.md`, which cites official sources.
   New rules are created with `review_state = 'draft'`. You never set `source_verified = true` or
   `review_state = 'active'` for a new regulatory rule; a human with legal authority does that.
2. **AI is never the approver.** No code path may set a promotion to `approved` or
   `conditionally_approved` except a human decision through the review RPCs. No auto-approval.
3. **Forbidden copy.** Never render "متوافق 100%", "compliant", "معتمد من البنك المركزي", "approved by
   SAMA", or anything implying a regulator or SALEEM approved the ad. Automated results use the labels
   in `05_UX_SPEC.md` §6. Every report and certificate shows: «هذه نتيجة فحص آلي استرشادي، والاعتماد قرار
   يتخذه مسؤول مخوّل.»
4. **No vendor copying.** Do not copy code, text, brand names, colours, illustrations or page layouts
   from Adclear or any other vendor. We replicate *capabilities and workflows* with SALEEM's own design.
5. **No fake success.** No buttons without a working action. No success toast before the server
   confirms. No mock data in production code paths. Demo data stays behind `is_demo` and is visibly
   labelled «بيانات تجريبية».
6. **Honest limits.** If part of an asset could not be analysed (no audio, unreadable PDF page, failed
   model batch), the result must say so and must not be presented as "no findings".
7. **Out of scope:** post-publication monitoring, scraping social platforms, face recognition.

### 2.2 Engineering

8. **Preserve what works.** Do not remove or rewrite working features: the analyze pipeline, re-check,
   compliance-log seal and `/verify`, orgs/campaigns/share links, rulebook admin, eval runner and admin
   eval page, quotas and plans, notifications, media cleanup, account deletion, i18n, demo/`/sample`.
   Evolve them in place.
9. **Additive migrations only.** Never edit a migration that is already in `backend/supabase/migrations/`.
   Never drop or rename existing tables or columns in this programme. Every new migration has a matching
   rollback script in `backend/supabase/rollbacks/<same-name>.down.sql` (create the folder).
10. **Local first.** Apply and test migrations on local Supabase (`npx supabase start` / `db reset` with
    `--workdir backend`). **Never** run `supabase db push`, `functions deploy`, or `secrets set` against
    the linked remote project unless the user writes "approved to deploy" in this session.
11. **RLS everywhere.** Every new table: `enable row level security`, explicit policies for each
    operation, and isolation tests (user from org A cannot read or write org B).
12. **Privileged logic in the database or Edge Functions.** State transitions go through
    `security definer` functions with `set search_path = ''`, fully qualified names, and explicit
    `auth.uid()` checks. The frontend never updates review fields directly (enforced with column
    privileges, see `03_DATA_MODEL.md`).
13. **No secrets in the frontend.** Service-role keys only in Edge Functions and admin scripts.
14. **Keep the model configuration.** Providers and model names stay env-driven exactly as today
    (`providers/index.ts`). Do not change model names.
15. **Dependencies.** No new runtime dependency without a one-line justification in `docs/DECISIONS.md`.
    Pre-approved candidates if needed: `pdfjs-dist` (PDF rendering, Phase 4), `diff` (text diff,
    Phase 4), `@axe-core/playwright` (dev only). `zod` only if it is not already present and existing
    validation cannot be reused.
16. **Types and quality.** TypeScript strict, no unexplained `any`, regenerate `types/supabase.ts` after
    schema changes, keep ESLint/Prettier clean, `deno check` the functions.
17. **i18n.** Every user-facing string goes into both `frontend/src/i18n/ar.json` and `en.json`. Arabic
    first. Add a key-parity test if none exists.
18. **Git hygiene.** Work on `v2/phase-N-<slug>` branches (autonomous full run: one `v2/full-run` branch
    with a `v2-phase-N` tag per phase), small commits with clear messages. Do not push, open PRs, or
    rewrite history unless asked.

### 2.3 When to stop and ask

Stop and ask the user (do not guess) when:
- a requirement conflicts with existing behaviour users rely on;
- a migration or backfill could lose or corrupt data;
- a legal interpretation is needed (what a rule requires, whether a source is in force);
- local Supabase/Docker is unavailable and you would need a remote database;
- tests cannot be run, or a fix needs a production secret.

When the safe choice is obvious and reversible, take it and record it in `docs/DECISIONS.md`.

In an autonomous full run, `AUTONOMOUS_RUN.md` §2 (hard stops) and §3 (decide and record) replace this
list.

---

## 3. Ground truth to verify in Phase 0

These facts come from `PROJECT_GUIDE.md`. Phase 0 confirms or corrects each one.

**Key files**
- Pipeline: `backend/supabase/functions/analyze/index.ts` (`Deno.serve` ~L351, `runPipeline` ~L109,
  rate limit ~L382).
- Shared: `_shared/types.ts`, `_shared/providers/{index,openai,prompt,types}.ts`,
  `_shared/rules/{arabic,deterministic,speech}.ts`, `_shared/pipeline/{merge,schema}.ts`,
  `_shared/notify.ts`, `_shared/http.ts`, `_shared/media/*`, `cost.ts`.
- Other functions: `cleanup-media`, `account`, `diagnostics`.
- Schema: `migrations/20261013000000_saleem_schema.sql`, `20261014000000_pipeline_hardening.sql`,
  `20261014020000_product_features.sql`, and the rest (9 files). Seed: `seed.sql` (rulebook v1, 12 rules).
- Frontend: `src/lib/api/{data,features,hooks,auth}.ts(x)`, `src/lib/{extract,speech,media,supabase}.ts`,
  `src/features/{submissions,reports,compliance-log,org,share,verify,archive,settings,rulebook,admin,...}`,
  `src/features/reports/{CheckPage,ReportView,model}.tsx/ts`,
  `src/features/submissions/NewCheckPage.tsx`, `src/components/ui/*` (incl. `VideoTimeline`),
  `src/routes/*` (TanStack file routes, `_app` layout, `$id` params), `src/i18n/*`.
- Tests: `backend/tests/{pipeline,speech,blur,isolation,provider-errors}.test.ts`, `frontend/e2e/*`.
- Eval: `backend/eval/{cases.json,run-eval.ts,results/}`.

**Tables:** `profiles`, `user_roles`, `rulebook_versions`, `rules` (`code`, `rulebook_version_id`,
`category`, `default_severity`, `llm_instructions`, `source_url`, `source_verified`), `submissions`
(`user_id`, `parent_id`, `org_id`, `campaign_id`, `batch_id`, `kind`, `status`, `progress`,
`current_step`, `overall_status`, `sha256`, `file_path`, `audio_path`, `audio_probe`, `heartbeat_at`,
`attempts`, `media_deleted_at`, `is_demo`), `transcripts`, `frames` (`t_seconds`, `image_path`,
`ocr_text`, `blurred`), `analysis_runs` (`step_outputs`, `token_usage`, `cost_usd`, `durations_ms`,
`raw_llm_output`, `prompt_version`, `rulebook_version_id`), `findings` (`run_id`, `submission_id`,
`evidence_frame_id`, `rule_code` text, `severity`, `t_start`, `t_end`, `confidence`, `source`),
`compliance_logs` (`content_hash`, `report_hash`), `plans`, `organizations`, `org_members`
(`owner/admin/reviewer/creator`), `org_invites`, `campaigns`, `batches`, `share_links`, `share_reviews`,
`notifications`, `finding_feedback`, `audit_events`, `eval_cases`, `eval_runs`, `ai_settings` (unused).

**Known defects to fix in Phase 0:** rate limit counts created submissions and uses `>` (allows 31);
`fail_stuck_submissions` writes a literal Arabic message instead of a `code:` error; a failed
`triggerAnalysis` leaves the submission `queued` until the 10-minute watchdog; the cron migration
hard-codes the Supabase project URL; live RLS isolation tests are skipped; Edge Functions import
`supabase-js@2.49.1` (older than the frontend); `docs/ARCHITECTURE.md` and `roadmap.md` are stale;
`docs/SALEEM_AUDIT.md` is untracked.

---

## 4. Target domain model (canonical vocabulary)

Use these names in code, database, and docs. Arabic labels live in `05_UX_SPEC.md`.

| Concept | Meaning | Storage |
|---|---|---|
| **Promotion** (إعلان) | One advertisement being prepared for publication. Container of versions. Owns context and the human review status. | `promotions` (new) |
| **Version** (إصدار) | An immutable snapshot of the asset(s) that is analysed and reviewed. V1, V2… | existing `submissions` row + `promotion_id`, `version_no` |
| **Analysis run** | One execution of the pipeline on a version. | existing `analysis_runs` |
| **Finding** (ملاحظة) | One issue raised by a check, typed, located, explained, cited. | existing `findings` + new columns |
| **Rule check** | The recorded outcome of one applicable rule in one run (`passed`, `failed`, `not_applicable`, `unable_to_verify`). | `rule_checks` (new) |
| **Rule pack** | A set of rules from one authority or policy (e.g., `sa-sama-advertising`). | `rule_packs` (new) |
| **Rule** | One check: Trigger (when it applies) + Check (what it looks for) + Source (where it comes from). Versioned as rows. | existing `rules` + new columns |
| **Regulatory source** | An official document (or internal policy) a rule cites. | `regulatory_sources` (new) |
| **Product** (منتج) | A financial product with approved key facts (APR, fees, term…). | `products` (new) |
| **Claim** (ادعاء) | An approved, substantiated marketing statement. Versioned. | `claims` (new, Phase 5) |
| **Disclaimer** (إفصاح) | Approved required wording, scoped to products/channels. Versioned. | `disclaimers` (new, Phase 5) |
| **Comment** (تعليق) | Human discussion, optionally anchored to a point/time/text/page. Threaded. | `comments` (new, Phase 4) |
| **Finding response** | An uploader or reviewer action on a finding. | existing `finding_feedback` + new columns |
| **Review decision** (قرار) | An immutable human decision with reasons, condition, snapshot and hash chain. | `review_decisions` (new) |
| **Review event** | Any state change or notable action, for audit and metrics. | `review_events` or extended `audit_events` (decide in Phase 0) |
| **Org settings** | SLA, retention, response requirements, feature flags, sector. | `org_settings` (new) |

### 4.1 Two separate state machines

**Analysis status (per version)** — unchanged values: `queued → processing → done | failed | cancelled`.
New: `analysis_runs.coverage.status ∈ {complete, partial}`.

**Review status (per promotion)** — new enum `promotion_review_status`:

| From | Action (RPC) | To | Who | Guards |
|---|---|---|---|---|
| — | create | `draft` | uploader | — |
| `draft`, `changes_requested`, `rejected`, `conditionally_approved` | `submit_promotion` | `pending_review` | uploader (owner or org member with upload rights) | current version analysis `done` (or `failed` with explicit acknowledgement shown to reviewer); every open finding on the current version has an uploader response when `org_settings.require_uploader_responses`; for re-submission after a decision, the current version is newer than the decided version — except `changes_requested` may re-submit the same version with a note |
| `pending_review` | `open_review` | `in_review` | reviewer/admin/owner with scope | caller is not the uploader of the current version |
| `in_review` | `decide_promotion(approve)` | `approved` | reviewer/admin/owner | separation of duties; every open finding has a reviewer response when `require_reviewer_responses` |
| `in_review` | `decide_promotion(conditional_approve)` | `conditionally_approved` | same | condition text required |
| `in_review` | `decide_promotion(request_changes)` | `changes_requested` | same | ≥ 1 reason |
| `in_review` | `decide_promotion(reject)` | `rejected` | same | ≥ 1 reason |
| `in_review` | `escalate_promotion` | `escalated` | same | a `legal` member exists and is chosen; question text required |
| `escalated` | `respond_escalation` | `in_review` | the chosen `legal` member | response text required |
| `approved` | `withdraw_promotion` (Phase 6) | `withdrawn` | admin/owner | reason required |
| any non-terminal | `archive_promotion` | `archived` | owner/admin | reason required |

P2 adds `reviewing_risk`, `risk_accepted`, `due_for_rereview` (see Phase 6). No other transitions exist.
The AI pipeline never calls these RPCs.

### 4.2 Finding types (what kind of problem)

| Type | Meaning | Typical source |
|---|---|---|
| `confirmed_mismatch` | The ad contradicts an approved fact (product APR, fee, approved claim number). Both values are shown. | product facts / claims check |
| `potential_risk` | Wording or imagery that may breach a rule; needs human judgement. | model, some deterministic |
| `missing_required` | A mandatory element required by an applicable rule is absent. | deterministic, model |
| `needs_evidence` | A statement or element is allowed only with substantiation/consent/licence that SALEEM cannot see. | claims check, model |
| `unable_to_verify` | The rule applies but SALEEM could not check it (coverage gap). | coverage |

"Not applicable" is **not** a finding: it is a `rule_checks.outcome` with a reason, shown in the report
under «قواعد لم تنطبق».

Severity stays `violation | warning` (+ `info` if it exists). Findings from `draft` rules are capped at
`warning` and labelled «قاعدة قيد المراجعة القانونية».

### 4.3 Roles and permissions (P1)

| Capability | owner | admin (compliance admin) | reviewer | legal (new) | creator (marketing) | platform admin |
|---|---|---|---|---|---|---|
| Create promotion, upload versions, respond as uploader | ✓ | ✓ | – | – | ✓ | – |
| Open review, decide, escalate, respond as reviewer | ✓ | ✓ | ✓ | – | – | – |
| Respond to escalation | – | – | – | ✓ | – | – |
| Manage products, claims, disclaimers, rejection reasons, org rule packs (scope only) | ✓ | ✓ | – | – | – | – |
| Manage members and roles, org settings | ✓ | ✓ (not owner) | – | – | – | – |
| Edit global rule packs, sources, rule logic | – | – | – | – | – | ✓ |

Separation of duties: nobody may decide on a version they uploaded. Self-approval is a P3 feature
behind explicit org rules.

---

## 5. Architecture principles

1. **Supabase-first.** Reads through RLS-protected queries; writes that change state through RPCs;
   AI and privileged work in Edge Functions. Keep the current pattern (`supabase-js` from the browser).
2. **Async pipeline stays async.** `analyze` keeps returning `202` and working via
   `EdgeRuntime.waitUntil` with heartbeat and resumable steps. Add idempotency per submission.
3. **Rules are data, checks are code.** Rule rows define applicability, citation, review state and the
   model instruction. Deterministic checks live in a typed registry with unit tests.
4. **Applicability is decided by SALEEM, not by the model.** The model only sees rules that apply.
5. **Pin everything.** A finding points to the exact rule row (version). Editing a rule never changes
   past reports.
6. **Tamper evidence.** Decisions are hash-chained; compliance logs keep their seal.
7. **Retention by policy.** Personal creator media: 24 h as today. Organisation versions that were
   submitted or approved: retained per `org_settings.media_retention` (default: retain). Approved
   records must survive for audit (CMA Article 33 requires a complete record of each approved ad).
8. **Feature flags.** P2/P3 features are enabled per org via `org_settings.features`.
9. **Observability.** Errors are stored and returned as `code:<snake_case>`; the UI translates them.
10. **RTL by construction.** Logical CSS properties, `dir` handling as today, bidi isolation for numbers
    and codes.

---

## 6. Phase index

| Phase | File | Priority | Goal | Exit gate |
|---|---|---|---|---|
| 0 | `phases/phase-0-baseline.md` | P0 | Verify reality, fix known defects, safety net | All tests green, isolation tests run, discovery report done, no behaviour change |
| 1 | `phases/phase-1-promotions.md` | P0 | Promotions with immutable versions, ad context, minimal products, org settings | Backfill correct, old links work, RLS tests pass |
| 2 | `phases/phase-2-rule-engine.md` | P0 | Saudi rule engine v2: sources, packs, applicability, SAMA draft pack, finding types, coverage, product facts | Eval cases 1–7, 15 pass; no forbidden copy |
| 3 | `phases/phase-3-review.md` | P1 | Human review: state machine RPCs, queue, decisions, responses, escalation, sealed decisions, retention | Transition tests, SoD, tamper test, e2e happy path |
| 4 | `phases/phase-4-collaboration.md` | P1 | Comments with anchors and mentions, carry-forward, version compare, PDF support | Cases 10–11, mentions notify |
| 5 | `phases/phase-5-libraries.md` | P1 | Claims and disclaimers libraries, product facts UI, dashboard, saved views, export | Case 4 via claims library, disclaimer check |
| 6 | `phases/phase-6-enterprise.md` | P2 | Multi-level approval, risk acceptance, partners portal, upload types, evergreen, lifecycle, analytics | Metric fixtures match formulas |
| 7 | `phases/phase-7-expansion.md` | P3 | Self-approval, API/webhooks, integrations, assistant, CMA/insurance packs, calibration | Per-feature acceptance |

Do not start P2/P3 work while P0 gates are failing.

---

## 7. Session protocol (follow exactly)

> Autonomous full run: steps 1–3 and 5–8 stay the same for every phase; step 4 (wait for "go") and step 9
> (stop) are replaced by `AUTONOMOUS_RUN.md` §4 — continue with the next phase.

1. **Read** this file, `PROGRESS.md`, the phase file, and any section of `01`–`06` the phase references.
2. **Discover (read-only).** Run the phase's discovery commands. Read every file you will change. For
   SQL objects, read the migration that created them. Record surprises.
3. **Plan.** Write `progress/phase-N-plan.md`: tasks in order, files to touch, migrations with names,
   tests to add, risks, questions. Keep it under two pages.
4. **Ask.** Show the user a 10-line summary and any blocking questions. **Wait for "go".**
5. **Implement in slices.** Each slice: migration (if any) → rollback file → backend → frontend → i18n →
   tests → run checks → commit. Never leave the app broken between commits.
6. **Run the full gate** before reporting:
   - `npm run lint`, typecheck (find the script in `package.json`), `npm test`
   - `deno check` for every Edge Function you touched
   - `npx supabase db reset --workdir backend` (fresh apply of all migrations + seed) succeeds
   - RLS isolation tests pass (not skipped)
   - `npm run build`
   - Playwright e2e for flows you touched (Arabic and English, desktop and mobile if configured)
7. **Self-review** against §2 hard rules and the phase acceptance criteria. Fix before reporting.
8. **Report.** Write `progress/phase-N-report.md` using §8. Update `PROGRESS.md` (status, next step,
   open questions) and `docs/DECISIONS.md` (new decisions, continue the existing numbering).
9. **Stop.** Tell the user what to test manually and what the next phase is.

---

## 8. Phase report template

```markdown
# Phase N report — <title>
Date: <YYYY-MM-DD> · Branch: v2/phase-N-<slug> · Commits: <first>..<last>

## Outcome
One paragraph: what users can do now that they could not before.

## Acceptance criteria
| Criterion (from phase file) | Status (met / partly / not met) | Evidence (test name, screenshot path, query) |

## Changes
- Migrations: <file> (+ rollback <file>) — what it does, rows backfilled
- Edge Functions: <file> — what changed
- Frontend: <routes/components> — what changed
- i18n keys added: <count>

## Tests
- Added: <list>  · Updated: <list>
- Gate results: lint ✓/✗, typecheck ✓/✗, unit ✓/✗ (n passed), deno check ✓/✗, db reset ✓/✗,
  isolation ✓/✗, build ✓/✗, e2e ✓/✗

## Not done / deviations
What was skipped or done differently, and why.

## Risks and follow-ups
## Decisions recorded (D-numbers)
## How to verify manually (5–10 steps, Arabic UI)
```

---

## 9. Definition of done (every phase)

- Acceptance criteria of the phase are met with evidence.
- All gate checks in §7.6 pass.
- No hard rule in §2 is violated (re-read them).
- New UI has empty, loading, error and success states, works in Arabic RTL and English LTR, and on a
  375 px wide viewport.
- New tables have RLS and isolation tests; new RPCs have permission tests (allowed and denied).
- Docs updated: `PROGRESS.md`, `docs/DECISIONS.md`, phase report. `PROJECT_GUIDE.md` sections that
  became wrong are corrected.

---

## 10. Quick reference — commands

```bash
# local database (requires Docker)
npx supabase start --workdir backend
npx supabase db reset --workdir backend          # re-applies migrations + seed locally
npx supabase gen types typescript --local --workdir backend > frontend/src/types/supabase.ts
npx supabase functions serve --workdir backend   # local Edge Functions (needs functions/.env)

# quality gate (confirm exact script names in package.json)
npm run lint && npm test && npm run build
deno check backend/supabase/functions/analyze/index.ts
npm --workspace frontend run e2e
npm --workspace backend run eval -- --deterministic-only
```

If Docker is not available, stop and ask the user whether to create a separate Supabase **staging**
project. Never test migrations on the production project.
