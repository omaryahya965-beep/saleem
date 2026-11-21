# Decisions log

Format: decision — why — alternatives considered.

## Phase 1
- **D1. Add `@playwright/test@1.64.0` (Apache-2.0) as a frontend dev dependency** — required for
  audit screenshots now and E2E in Phase 6. Alt: `npx playwright` ad-hoc (not reproducible).
- **D2. Before-screenshots of mobile nav captured via DOM `dispatchEvent`** — the legacy mobile nav is
  hidden, so real taps are impossible; documented as an audit finding rather than worked around in code.

## Phase 2
- **D3. `docs/design/` absent → baseline = the token list in the prompt + legacy CSS look.**
- **D4. Added tokens `line-strong #8A877B` and `amber-text #8A4F00`** — `line` is 1.26:1 (fails 3:1 for
  control borders) and amber on amber-bg is 4.47:1 (fails AA 4.5:1 for text).
- **D5. Focus ring = green, not mint** — mint on paper is 1.6:1; green is 5.5:1.
- **D6. Self-hosted fonts via `@fontsource/ibm-plex-sans-arabic` and `@fontsource/noto-naskh-arabic` (OFL)**
  — removes the render-blocking Google Fonts `@import`. Alt: preload Google Fonts (third-party request).
- **D7. Added `@radix-ui/react-direction` (MIT)** — RTL-aware arrow keys in Tabs/RadioGroup.
- **D8. Native `<select>`** instead of Radix Select — better mobile pickers and screen-reader support.
- **D9. VideoTimeline always LTR** — matches native player and media convention; avoids the swapped
  start/end labels found in the audit.
- **D10. Dates use Gregorian calendar with Latin digits in Arabic (`ar-SA-u-ca-gregory-nu-latn`)** — consistent
  with times (00:12), hashes and IDs; Hijri can be added later as a setting.
- **D11. Prettier `endOfLine: "auto"`** — fixes 4.9k CRLF lint errors on Windows without rewriting history.
- **D12. Removed 25 unused shadcn files and 18 unused deps** (Radix accordion/alert-dialog/…, react-hook-form).
- **D13. Legacy CSS kept in a low-priority `@layer legacy`** until each screen is rebuilt in Phase 3.
- **D14. Router `autoCodeSplitting`** — main chunk 790 kB → 476 kB.

## Phase 3
- **D15. Real URL routes** (`/`, `/dashboard`, `/new?parent=`, `/checks/$id`, `/checks/$id/log`, `/rules`,
  `/settings`, `/login`, `/signup`, `/forgot-password`, `/reset-password`) under a pathless `_app`
  layout; guards via `beforeLoad`. `/checks/$id` is public — RLS decides (own rows or `is_demo`).
- **D16. One route for processing + report** — `/checks/$id` polls the row (1.5 s) and swaps to the report
  when `status=done`; progress/steps are the backend's `progress`/`current_step` (no simulation).
- **D17. Cancel = owner sets `status=failed, error_message=cancelled_by_user`** (allowed by existing RLS);
  the pipeline must check for it between steps (Phase 4).
- **D18. Storage layout `{user}/{submission}/original.ext` + `thumb.jpg`** with client-generated UUIDs, so
  `cleanup-media` (which lists `user/submission/`) actually finds the files (audit F11). Upload errors
  now abort the submission (F13).
- **D19. Analyze/cleanup are invoked with the user's JWT** via `supabase.functions.invoke` (fixes F1).
- **D20. Added `qrcode@1.5.4` (MIT)** for the compliance-log QR (SVG, no canvas).
- **D21. `exactOptionalPropertyTypes` disabled** — conflicts with TanStack Router search reducers;
  `strict` and `noUncheckedIndexedAccess` remain on.
- **D22. Arabic plurals via `Intl.PluralRules` + `tn()`** — "3 مخالفات", "مخالفتان", never "3 مخالفة".
- **D23. Signed-in screenshots use Playwright network mocks** (`scripts/mock-auth.mjs`) — no test users are
  created on the hosted project; public data still comes from the real backend.
- **D24. Rule source names are Arabic-only in the DB** — shown as-is in English UI until `source_name_en`
  is added (Phase 5.9).

## Phase 4
- **D25. Models (checked on developers.openai.com, 2026-10-14):** LLM `gpt-6.1-sol` (vision + reasoning,
  strict Structured Outputs, $2/$10 per 1M tok); alt `gpt-6-luna` ($0.10/$0.50) for cost; `gpt-6-astra` too costly.
  ASR `whisper-1` ($0.006/min). **Measured** cost: ≈$0.006 per text case, $0.027 for a 22 s clip with 23 frames
  (≈$0.06 projected for 60 s / 62 frames).
- **D26. `whisper-1` over `gpt-4o-transcribe-diarize`** — tested live: diarize returned 1 segment for 21 s of a
  single speaker (segments = speaker turns), pinning every claim to 00:00; whisper gave sentence segments
  (claim at 8.2 s ✓). The diarize/whisper switch is env-only (`TRANSCRIPTION_MODEL`); the provider
  auto-falls back to whisper on configuration errors. `gpt-transcribe` documents no segment timestamps.
- **D27. Gemini/Anthropic providers wired but disabled** (`LLM_PROVIDER=gemini|anthropic` → clear error).
- **D28. Responses API + `text.format: json_schema strict`** and server-side validation (`validateAnalysis`),
  one extra attempt on invalid JSON, exponential backoff on 408/409/429/5xx, 120–140 s timeouts. Unsupported
  `reasoning` param (non-reasoning models) is dropped automatically.
- **D29. Frames 1/s (≤60) + first/last at ≤768 px and mono 16 kHz WAV are produced in the browser**
  (`frontend/src/lib/extract.ts`), uploaded to `{user}/{sid}/frames/<ms>.jpg` + `audio.wav`; the function
  never decodes video (CPU limits). Images use one resized frame; text posts skip ASR/frames.
  Handles WebM with `duration=Infinity` (MediaRecorder) — found while testing.
- **D30. Pipeline order transcribe → model (findings + on-screen text) → deterministic (transcript + OCR +
  caption) → merge**, so regex checks also cover on-screen text. Steps persist in `analysis_runs.step_outputs`
  and resume on retry; 202 + `EdgeRuntime.waitUntil`; heartbeat prevents double workers; cancellation checked
  between steps.
- **D31. Report integrity hardening (migration `20261014000000`)**: removed owner write policies on findings,
  runs, transcripts, frames, compliance logs; owners can only update `title`; insert trigger forces `queued`;
  cancel/retry via SECURITY DEFINER RPCs. Without this a user could forge a "ready" compliance log.
- **D32. No auto-admin on first sign-up** (old trigger made the first user admin).
- **D33. Whole-post rules (MAW-01..04, AI-01) keep one finding**, preferring the deterministic one; other
  rules dedupe within 3 s; confidence < 0.7 violation → warning.
- **D34. Hourly media cleanup via pg_cron + pg_net**; shared secret generated inside Vault and verified by
  `verify_cron_secret()` — the secret never leaves the database or enters git. `cleanup-media` deployed with
  `verify_jwt=false` and verifies JWT (owner path) or the cron secret itself; also removes orphan uploads.
- **D35. Rulebook**: exactly the 12 rules active, all `legal_status=illustrative_pending_review`,
  `source_verified=false`; added `source_name_en`. CNT-01 instructions now accept speech evidence (eval miss).
- **D36. Eval harness**: `backend/eval/cases.json` (12 Saudi-dialect cases), `npm run eval`, results JSON +
  optional upload to `eval_runs` (needs service key); admin page `/admin/eval`. `npm run clips` runs real
  clips via headless Chromium using the app's own extraction module. Test users can't be created
  (Supabase rejects example.com; no real mailboxes) → live isolation tests skip until creds are provided.

## Phase 5
- **D37. One schema migration for all product features** (`20261014020000_product_features.sql`): plans/quotas,
  batches, organizations (+members, invites, campaigns), share links/reviews, rulebook versions, sealed logs,
  notifications. Every privileged action is a SECURITY DEFINER RPC that checks the caller; tables expose
  read-only RLS. Rules unique constraint changed from `code` to `(rulebook_version_id, code)` so versions can coexist.
- **D38. Quotas enforced in the database insert trigger** (monthly checks, clip length, batch size, org/campaign
  membership) — not bypassable from the client. Plans: Free 10/mo (batch 5), Creator 100/mo (batch 20),
  Agency 1000/mo + workspace. Users can't change their own plan (column-level grants). No payments.
- **D39. Org roles**: owner/admin manage; reviewer reads all org checks + media; creator sees own checks only.
  Invites are single-use tokens bound to an email (7 days); link is copied by the inviter (no email provider yet).
- **D40. Sharing**: 1–30 day, revocable, unguessable token; `get_shared_report` returns findings/rules only
  (no video, transcript, user); reviews rate-limited 20/hour/link and notify the owner.
- **D41. Verifiable logs**: `report_hash = sha256(sid | file sha256 | status | rulebook version | findings)` sealed
  by the pipeline; `/verify/:id` recomputes it server-side (`unchanged`) and can hash a file locally to match the
  stored SHA-256. Public facts are minimal (no title/caption/user).
- **D42. Re-run on latest rulebook** keeps old runs; works after media deletion using the stored transcript and
  the previous run's on-screen text (no frames).
- **D43. Email provider interface** (`_shared/notify.ts`): `console` (default, masked address) and `resend`
  (needs `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`) — no account was created. In-app: notifications table +
  bell + toasts (20 s polling; Realtime is a later optimisation).
- **D44. Account deletion via `account` Edge Function** (needs the admin API) with typed-email confirmation;
  blocks if the user is the sole owner of a workspace with other members. Data export is client-side JSON of
  everything RLS lets the user read.
- **D45. Fixed duplicate `@radix-ui/react-direction`** (1.1.1 vs 1.2.0): Radix Tabs/RadioGroup were reading a
  different context and rendering `dir="ltr"` inside Arabic pages (wrong chevrons, reversed arrow keys).
- **D46. Legal pages are drafts with explicit `[ ]` placeholders** and an on-page notice; they must be completed
  by counsel (PDPL: controller identity, processors and cross-border transfers, complaint channel).

## Phase 6
- **D47. Audit log via triggers** on share links, org members/invites, organizations, user roles, rulebook versions,
  and submission deletion/media deletion; admin-read only.
- **D48. Watchdog cron** (`fail_stuck_submissions`, every 5 min): stale heartbeat > 10 min → failed with a retry
  message, so no check spins forever.
- **D49. Error tracking = provider interface** (`lib/telemetry.ts`, console by default). Recommended: Sentry.
  No account created.
- **D50. Build-time prerendering of 10 public pages** (`scripts/prerender.mjs`) + same-frame hand-off
  (`lib/prerender.ts`, MutationObserver) + `inert` snapshot + `html[data-app-ready]`. Unknown paths are served
  the clean `spa.html` (hosting rewrite; mirrored in `vite preview`). English visitors drop the Arabic snapshot
  before paint. Alt considered: migrate to SSR (TanStack Start) — reverted by the owner earlier, so not reintroduced.
- **D51. Chunking**: vendor-react / vendor-router / vendor-supabase / vendor-tslib groups; Supabase loads lazily
  (auth, roles, notifications) so it never blocks first paint; app scripts `fetchpriority=low`, no modulepreload.
  `tslib` got its own chunk because Radix and Supabase share it (it was pulling Supabase into first load).
- **D52. Lighthouse** measured with Playwright's Chromium (`docs/lighthouse/*.json`). Mobile *simulated* perf stays
  ~70 because Lantern models JS as render-gating; with *applied* throttling FCP ≈ 1.9 s. Remaining gap (landing/legal
  LCP ~8 s under applied throttling) = React re-painting the heading after the web font arrives → needs true
  hydration (SSR/SSG) or metric-matched fallback fonts. Recorded as an open issue, not hidden.
- **D53. E2E**: Playwright, 11 flows × {ar-desktop, en-desktop, ar-mobile} = 33 tests; signed-in flows use the
  network mocks; public flows hit the real project. CI: GitHub Actions (lint, typecheck, unit, audit, build,
  Deno check, E2E) — no remote configured, so not yet run on GitHub.
- **D54. Hosting configs** for Vercel (`vercel.json`) and Netlify/Cloudflare Pages (`_headers`, `_redirects`) with
  CSP/HSTS/frame-ancestors and immutable asset caching.

## Phase 7
- **D55. Demo pair from real pipeline output** on synthetic clips (`20261014040000_demo_pipeline_pair.sql`,
  generated by `scripts/build-demo-seed.mjs` from `docs/demo/clips/*.json`), labelled «مقطع اصطناعي للعرض»,
  sealed and verifiable. The original hand-written demo rows stay (labelled `demo-fixture`).
- **D56. Demo media ships with the app** (`frontend/public/demo/*.webm`, `file_path = demo:/demo/…`) — demo rows
  are public, storage is private; no storage policy was loosened.
- **D57. Landing "see a sample report" → the new real-output demo** (`…0003`).
- **D58. Synthetic fixtures** (OpenAI TTS `gpt-4o-mini-tts` + Arabic slides, MediaRecorder WebM) stand in until
  consented creator clips exist; every doc says so.
- **D59. Phase 6 committed directly on master** (branch creation was in a shell command that aborted);
  `phase-6-quality` points at that commit. History was not rewritten.
- **D60. Accuracy claims are scoped**: pitch numbers come with the sample size and limits (docs/demo/ACCURACY.md).

## Hotfix
- **D61. Provider errors are classified codes, not provider text** — precise user messages per cause and no leakage
  of provider details; "invalid key" only on 401.
- **D62. Keep `diagnostics` (admin-only)** — cheap way to prove the hosted AI config (key format, model access,
  real transcription) without exposing secrets; documented in OPERATIONS.
- **D63. Eval scripts must not mask hosted config** — they now remain useful, but hosted health is checked with
  `scripts/run-diagnostics.mjs` against the deployed secret.
- **D64. Blur every evidence frame server-side (not only frames with people)** — detecting people/minors would
  need another model call; blurring all evidence guarantees no unblurred child image reaches the report or the
  compliance log. Cost: on-screen text in the thumbnail is unreadable (it is quoted in the evidence line).
  Face-only blurring is a later improvement. Only the demo reports were backfilled; older reports show no thumbnail.
- **D65. Keep transcription before the model call** — running them in parallel would drop the transcript from the model's
  input (spoken claims/disclosure); instead everything independent of the transcript is prepared during transcription.
- **D66. Blur completes before "done"** — the report never shows a missing or unblurred thumbnail; the blur runs in parallel
  with the findings writes so it costs ~4–5 s, not extra round trips. Status polling stays at 1.5 s while running.

## v2 programme — Phase 0 (autonomous full run, 2026-11-17)
- **D67. Pending deletion of the old `docs/` tree is not committed** — the working tree had every old doc
  deleted (unstaged) before this run. Conservative: leave that change to the user; only `docs/DECISIONS.md` was
  restored because the programme appends to it. Alt: commit the deletions (irreversible intent we can't confirm).
- **D68. Review events get a dedicated `review_events` table (M5)** — `audit_events` is admin-read-only and has no
  org scope; review history must be readable by org members under RLS and append-only. `audit_events` stays as is.
- **D69. Database checks without Docker** — no Docker/Podman/psql here. `supabase db reset` and DB tests are marked
  "not run". As a supplementary smoke check, migrations + seed + SQL tests are applied on PGlite (Postgres in WASM)
  with stubs for auth/storage/vault/cron/net, installed in the session scratchpad, **not** a project dependency.
  `deno check` runs via `npx --yes deno@2` (tool download, not a dependency).
- **D70. Demo/test accounts stay visible unless `VITE_SHOW_TEST_ACCOUNTS=false`** — today's live sign-in page relies
  on them; changing the default is a behaviour change. Recommendation for production: set it to `false`.
- **D71. Fresh `db reset` fix** — `20261014040000_demo_pipeline_pair.sql` needs the active rulebook, which only seed.sql
  created (seed runs after migrations), and seed.sql's `on conflict (code)` lost its unique constraint in
  `20261014020000`. Added the idempotent `20261014035900_v2_p0_fresh_reset_rulebook.sql` (no-op on the hosted DB) and
  changed seed to `on conflict (rulebook_version_id, code)`. Its timestamp precedes applied remote migrations, so
  the next deploy needs `supabase db push --include-all`. Alt: edit the applied migration (forbidden).
- **D72. Media-cleanup cron reads `project_url` from Vault** via `public.invoke_cleanup_media()`; missing secret →
  the job logs a notice and does nothing (never calls a wrong project). `x-cron-secret` unchanged.
- **D73. Rate limit = analysis runs started by the user in the last hour, blocked at `>= limit`**; resuming an
  unfinished run is never limited. The 429 body (`rate_limited`) is unchanged for client compatibility.
- **D74. "Analysis did not start" is detected client-side** (failed `analyze` invoke in this session, or `queued` with
  no heartbeat after 30 s) and retried by re-invoking the idempotent function. No new server state.
- **D75. Edge Functions import `supabase-js@2.117.3`** (frontend's resolved version); `deno check` green.
- **D76. No network to the hosted project during this run** — eval gets `--offline` (rule codes from seed.sql); the
  gate build uses a local placeholder `VITE_SUPABASE_URL`; the existing e2e suite reads hosted demo data, so it is
  "not run". New e2e specs mock the network.
- **D77. Database tests are pgTAP files in `backend/supabase/tests/`** (`npx supabase test db --workdir backend`), with
  assertions in `DO` blocks so they also run in the PGlite smoke harness.

## v2 programme — Phase 1 (promotions)
- **D78. Reuse `is_org_member` / `org_role_of` instead of a new `member_role` helper** — equivalent and already used
  by every org policy; one source of truth for membership.
- **D79. Navigation stays a header + mobile bottom bar** (no sidebar exists): «الإعلانات» added to the main nav,
  «المنتجات» to the account menu. A sidebar redesign is out of scope.
- **D80. FK delete behaviour** — `promotions.org_id … on delete set null` (like `submissions.org_id`; account deletion
  deletes sole-owner orgs first), `submissions.promotion_id … on delete restrict`; the `account` function deletes the
  user's now-empty promotions.
- **D81. `types/supabase.ts` is extended by hand to match the SQL** (no local DB to run `gen types`); regenerate when
  a local stack is available.
- **D82. `promotions.owner_id` is nullable** — demo/seed submissions have no user.
- **D83. A version always takes its promotion's org/campaign** (attach trigger), so org reviewers can read every
  version; with that, submission read access needs no change (`can_read_promotion` mirrors `can_read_submission`).
- **D84. Personal creators and org reviewers keep the existing upload path** (no explicit promotion; the trigger
  creates one, `creator_sponsored`). Org owners/admins/creators get the context step and an explicit promotion.
  Legacy re-checks of rows the caller cannot extend (e.g. the public demo) start a new promotion instead of failing.
- **D85. `/checks/$id` redirects only when the version resolves** (`/promotions/$id?v=N`); otherwise the existing
  page renders its own not-found/error state. Compliance-log, verify and share routes stay keyed by submission id.
- **D86. Backfill is a function** (`v2_backfill_promotions()`, service role, idempotent) called once by the
  migration, so it is testable on fixtures; chains never cross owners or demo↔real.
- **D87. Offline e2e** — `scripts/mock-auth.mjs` prefers `process.env.VITE_SUPABASE_URL` and, when the backend is
  unreachable, answers un-mocked REST calls like RLS would (`[]` / PGRST116). Behaviour with a reachable backend is
  unchanged.

## v2 programme — Phase 2 (rule engine)
- **D88. The v2 check kind is `rules.check_kind`** (`deterministic|llm|hybrid|workflow`) — `rules.check_type` already
  exists as the legacy enum (`audio|visual|text|metadata|hybrid`) and stays untouched.
- **D89. Release `2026.11-v2` is built by `v2_publish_rulebook()`**, called by the M3 migration and again at the end of
  seed.sql (on a fresh database the v1 rules only exist after the seed). It activates the release only while v1 is the
  active one, so it never overrides a later admin release. `create_rulebook_draft` now copies the v2 columns.
- **D90. The engine is a pure module (`_shared/pipeline/evaluate.ts`)** so Vitest runs cases 1–7 and 15 end to end with a
  recorded model output; `analyze/index.ts` only gathers inputs and persists results.
- **D91. Deterministic checks live in one registry file** (`_shared/rules/checks/index.ts`) instead of one file per key —
  16 short functions share helpers and messages; each key has its own tests.
- **D92. Mawthooq rules (MAW-01..04) apply to creator/general content or influencer distribution** (rule
  `applicability`), per 02_SAUDI_RULES §3 "default for creators, agencies, any influencer distribution". Personal and
  agency promotions keep today's behaviour; a bank's own-channel financial promotion no longer gets creator findings.
- **D93. AI-01 is not edited**; findings from rules whose source is a `guideline` (SDAIA) are capped at warning at merge time.
- **D94. New runs type the v1 creator-check findings** (MAW-01, AI-01 → missing_required; MAW-02..04 → needs_evidence;
  others → potential_risk). Stored legacy rows keep `finding_type = null` and show «ملاحظة (إصدار سابق من المحرك)».
- **D95. Overall-status labels changed to the advisory wording** («لا ملاحظات آلية / ملاحظات للمراجعة / ملاحظات تستلزم
  التعديل», prefixed «الفحص الآلي:») — «جاهز للنشر» implied that SALEEM clears an ad for publication (master §2.1 rule 3).
  Two e2e assertions updated in the same commit.
- **D96. Weak-evidence downgrade (violation → warning below 0.7) applies to every model finding**, not only creator rules.
- **D97. CNT-01..06 have no `regulatory_source_id`** — their source (GCAM content rules) is not in the verified source list;
  they keep their stored source name and link.
- **D98. An approved product with `fees: []` passes the fee-disclosure check**; unknown fees (key absent) still require
  disclosure.
- **D99. Schema v2 deviations:** OCR and evidence carry `t` seconds (frames are matched by time, as today) instead of a
  `frame_ref`; the optional `region` is omitted (strict structured output requires every field).
- **D100. A model batch that stays invalid after one retry makes coverage partial** (its rules `unable_to_verify`,
  `model_output_invalid`) instead of failing the check; transport errors still fail the run so it can be retried.
- **D101. Any `confirmed_mismatch` makes the automated result `needs_fixes`, even under a draft rule** (04 §10 literal);
  the finding itself stays capped at warning and labelled as a draft rule.
- **D102. Report hash v2 is versioned per log** (`compliance_logs.hash_version`); logs sealed before keep verifying
  with the v1 input. Fresh databases seal the demo logs at the end of seed.sql.
- **D103. Eval v2 uses recorded model output** (no live model, D76); its metrics are on invented, self-labelled cases
  and must not be quoted as real-world accuracy.

## v2 programme — Phase 3 (human review)
- **D104. Finding responses live in a new append-only `finding_responses` table** written only by
  `respond_finding()`. `finding_feedback` has `unique (finding_id, user_id)` and cannot hold a history; it stays as
  is for the existing dispute UI. A reviewer response always overrides an uploader response.
- **D105. Human review is for organisation promotions** (`can_submit` → `personal_promotion`): personal creators have
  no reviewers. Their flow is unchanged.
- **D106. The chosen legal member is stored on `promotions.escalated_to`** (written only by the RPCs; not in the client
  column grants). Legal members can read their organisation's promotions (`can_read_promotion`/`can_read_submission`).
- **D107. Decision hash input** = the decision row as JSON (promotion, version, decision, actor, role, reasons,
  condition, comment, statuses, asset sha256, rulebook version, findings snapshot, created_at at millisecond
  precision) chained with the previous hash; `verify_decision_chain` recomputes it.
- **D108. `notifications.kind` check widened** to the review kinds (superset; existing rows stay valid). In-app
  notifications are written by the RPCs; emails go through the new `review-notify` Edge Function, which the client
  calls after a successful action and which sends each pending notification once (`emailed_at`).
- **D109. Retention = `media_retention_candidates()`**: personal 24 h as before; org versions only while their
  promotion was never submitted or decided (after `media_retention.unsubmitted_hours`). Submitted/decided/approved
  versions keep media.
- **D110. Finding response buttons are in a panel under the report** (current version only) instead of on each card —
  the report card component stays shared with the public demo and compliance log.
- **D111. «طابور المراجعة» and «سجل التدقيق» are in the account menu** (header nav has no room on mobile, D79).
- **D112. The check-finished email uses the advisory labels** (same reason as D95).

## v2 programme — Phase 4 (collaboration + PDF)
- **D113. `pdfjs-dist@4.10.38` added (pre-approved, master §2.2 rule 15)** — renders PDF pages and reads the text layer
  in the browser; loaded on demand with its worker as a separate asset.
- **D114. PDF pages are `frames` rows with `t_seconds = page_no = page number`** (`t_seconds` is NOT NULL); the text
  layer is uploaded as `pages/text.json` (clients cannot write `frames`), `frames.text_source` says text layer vs model OCR.
- **D115. Comments live in their own tab with a pin-able preview** (image / first PDF page with a page number / video
  second / text) rather than inside the shared report media component; «أين؟» highlights the pin in that preview.
- **D116. No `diff` dependency** — a tested LCS word diff (`features/collab/model.ts`) covers ad-length text.
- **D117. A PDF with unreadable pages never produces deterministic `missing_required` findings**: those rules become
  `unable_to_verify` (`coverage:pdf_pages`) and coverage is partial (case 10).
- **D118. Pre-existing `npm audit --omit=dev` high findings** (TanStack router plugin, Vite, picomatch advisories) are
  not fixed in this run — upgrading build tooling is out of scope; `pdfjs-dist` adds none. The CI audit step fails
  until they are upgraded.

## v2 programme — Phase 5 (libraries + dashboard)
- **D119. No `pg_trgm`; claim matching runs in TypeScript** (`_shared/claims/match.ts`). It reuses the rule engine's
  Arabic normalisation and number extraction. Similarity is the larger of trigram Jaccard and 0.85 × coverage of the
  library claim; 0.6 means similar and 0.9 means the same claim.
- **D120. Org overrides only narrow a rule** (exclude channels or disable it, with a reason, audited). `SYS-*` rules
  are exempt, and an override never changes a rule's logic or severity.
- **D121. Saved views ship on the promotions list only** (scopes `queue` and `claims` exist in the table, not yet in
  the UI). This is a conservative default, to confirm.
- **D122. Disclaimer templates are platform proposals** («صيغة مقترحة — راجعها قانونياً»). They apply only after an
  org adopts them as its own active disclaimer.

## v2 programme — Phase 6 (enterprise workflows, P2; every feature behind an org flag, off by default)
- **D123. Step decisions use a new RPC, `decide_promotion_step(_pid, _step, …)`**, not a `step_id` parameter on
  `decide_promotion`. An overload with defaults would make existing calls ambiguous. While a flow is live,
  `can_decide` returns `multi_level_flow`, and escalation is blocked.
- **D124. Multi-level details:** a submitter cannot carry every step forward, so at least one is reviewed again.
  Carried steps count for the "two steps, same person" rule. Editing a preset bumps its version, and that blocks
  carry-forward. Replacing a live flow marks its approved and carried steps as discarded (`skipped`); their sealed
  decisions stay in the chain.
- **D125. A flag is on only when it is exactly `true`** (`org_feature`). The flags card lists only built features.
- **D126. Risk acceptance:** acceptors are chosen by owners/admins from owner/admin/reviewer/legal members. The
  decision is sealed with `actor_role = 'risk_acceptor'`. Acceptance never sets `approved_at` or
  `approved_version_id`, and analytics excludes it.
- **D127. Partners:** `is_org_member(org)` without a role list now excludes `external_*` roles (deny by default).
  Partner analyses count against the partner's own plan quota. A new version is inserted with `org_id = null`,
  and the attach trigger sets the promotion's workspace. Partners see comments unless the org hides them.
  `external_reviewer` and the share-link migration are **not built**: the role exists and grants nothing.
- **D128. Carousel analysis is not built.** Variations and batch cover the other upload types. The carousel schema
  exists, so it needs no further migration.
- **D129. Saudi business day:** the next Sun–Thu date that is not an org holiday, at the same Riyadh time, so a
  notice on Thursday or Friday is due on Sunday. `business_holidays` can only be edited in SQL for now. The UI
  shows the date as a deadline, never as legal advice.
- **D130. Analytics:** durations are in hours. Early requests include deadlines already past at submission. First
  response is the earliest of a reviewer response to a finding, a comment by someone other than the owner, or a
  decision. Bars are plain CSS (no chart dependency).
- **D131. Internal rules:** drafting uses the configured analysis provider and model (no new model or provider).
  Without a key, drafts come from directive sentences and are marked `heuristic_draft`. A person must edit each
  draft before approval. `INT-*` rule ids are prefixed `internal:`, so they are never stored as rulebook ids and
  get no `rule_checks` rows.

## v2 programme — Phase 7 (expansion, P3; every item behind an org flag, off by default)
- **D132. Self-approval** works only from `pending_review` (the uploader submits first, so the submission event is
  recorded). The decision is a sealed `approve` with `actor_role = 'self_approval'` and the comment prefix
  «اعتماد ذاتي». Blocked packs (`org_settings.self_approval_blocked_packs`) can only be set in SQL for now. The UI
  offers roles, channels and market; product types and named users go through the RPC only.
- **D133. Public API v1 is read-only.** Creating promotions or versions and triggering analysis are not built:
  `analyze` accepts only user JWTs, and adding a server-to-server path would change a P0 guarantee. The scopes
  `promotions:write` and `analysis:run` are reserved, and the UI does not offer them.
- **D134. Delivery:** pg_cron `saleem-webhooks` runs every minute and calls `webhooks-deliver`, reusing the vault
  secrets `project_url` and `cleanup_cron_secret`; it does nothing when the queue is empty. Webhook signing secrets
  stay in the database (service role, or the owner/admin `webhook_secret` RPC). Chat messages never carry finding
  text.
- **D135. Ask SALEEM** uses keyword retrieval (no embeddings, no `pg_trgm`). The model only rephrases from the
  numbered sources, using the configured provider and model.
- **D136. Readability thresholds:** more than 35 words per sentence; dense footnotes means 3 or more markers, or a
  footnote block over 60 words. Only the caption and text are checked.
- **D137. Calibration** uses the last reviewer response per finding and dates by the start of the analysis run.
  Notes are plain text, with no rule edits.

## Phase 8 — Docker gate, Saudi rules v0.1, roles, company rules (2026-11-18)

- **D138. History rewrite:** with the user's approval, each phase 0–7 is one commit whose tree equals its old tag.
  The tags were moved, the backup is branch `v2/full-run-backup`, and main was not touched. Phase 8 stays as
  separate slice commits. The user asked not to squash or force-push without explicit authorisation.
- **D139. Column grants on real Supabase:** Supabase default privileges give `authenticated` ALL on new tables, so
  the v2 column grants restricted nothing. Status columns were writable, and token hashes were readable.
  `20261118080200` revokes the table privileges and restates the intended column grants. PGlite had hidden this.
- **D140. Saudi rules v0.1** are generated from the CSVs (`gen-saudi-rules.mjs`), never typed by hand. All 187 are
  drafts, HAJ is archived, and packs are off by default. Mapping of `check_mode` to `check_kind`: content → llm;
  hybrid → hybrid; document and workflow → workflow. Priority high maps to violation, otherwise warning, and drafts
  are capped at warning anyway.
- **D141. Cross-sector scope:** SALE triggers on `discount_sale`, COMP on `contest_or_prize`, PD on
  `direct_marketing`, and MEDIA on influencer distribution. Sector packs outside finance (FOOD, DRUG, RE, TR, …) are
  opt-in per organisation, because the organisation sector list covers finance only.
- **D142. check_mode semantics in the engine:** document → «يحتاج مستنداً» (needs_evidence, warning, never sent to
  the model); workflow → a reviewer-checklist outcome (`reviewer_checklist`), never a finding or a model guess;
  hybrid → capped at potential_risk/warning, with `evidence_request_ar`; content with partial coverage →
  `unable_to_verify` (`coverage:partial`). With no model, nothing is fabricated: content rules are unable to verify.
- **D143. SAMA/CMA mapping:** `gen-rule-mapping.mjs` classifies by source document, article path (numbers and
  Arabic sub-item letters) and text similarity. Results: 33 Exact (citation identity, not wording), 16 Possible,
  1 No Match. «Verified Equivalent» is never automatic. Nothing was superseded, merged, deleted or deactivated.
  `rule_mappings` rows are pending, and the 44 NEW drafts with a match carry `possible_duplicate_of` and are never
  applied (`possible_duplicate:<code>`). The old rules are drafts, so no "verified active" rule was at stake.
  Awaiting the user's decision.
- **D144. Version-aware evaluation:** every finding's citation records `rule_version` (the release id, or
  `internal:vN` for company rules), `check_mode` and `evidence_policy_ar`. Coverage records the packs applied, why,
  and per-pack counts.
- **D145. Roles:** `compliance_lead` and `viewer` are added (enum). Existing roles are unchanged and no user is
  migrated, but four display names changed. Risk acceptor stays the `can_accept_risk` permission. Source of truth:
  `frontend/src/lib/permissions.ts` → `org_role_can` / `org_can` (hand-written SQL) →
  `p8_roles_matrix.test.sql` (generated: 153 cells and 99 probes against the real RPCs and tables).
- **D146. Role rewrite by generator:** `gen-roles-migration.mjs` restated 26 functions and 7 policies from the local
  definitions, adding `compliance_lead` wherever owner, admin and reviewer are listed together, and viewer reads.
  A lone `'reviewer'` literal (an `actor_role`) is left alone. The viewer is blocked in `add_comment` and
  `can_submit`.
- **D147. Company rules:** versioned (`internal_rules.version`, immutable `internal_rule_versions` written on each
  approval). The author (last editor) cannot approve. «جرّب القاعدة» is `analyze {try_rule}`: text only (transcript,
  caption, last on-screen text, no frames), nothing saved, gated by `manage_company_rules`. **NOT VERIFIED with a
  live model.**
- **D148. Supabase types:** regenerating them from the local database was rejected. The generated types are
  stricter on nullable RPC arguments and would have broken dozens of call sites, so new tables and functions are
  added by hand.
- **D149. Intermittent e2e failures:** investigated. With 3 workers: 135/135 over three repeats. With 6 workers,
  failures reproduce (10/33). Traces show the HTML from `vite preview` taking 39.8 s and the first Supabase REST call
  never completing, with an empty `<main>`. Cause: an environment resource limit (drive C has 1.1 GB free); no app
  defect was found. Timeouts were not loosened. To confirm, re-run on a machine with free disk space.

## UX pass — navigation, errors, demo personas (2026-11-18)

- **D150. Navigation:** the account menu holds only account-level items (name, email, active workspace and
  switcher, my settings, terms, sign out). App modules live in a sidebar (`components/layout/navModel.ts`) grouped
  as Work, Compliance, Organization, Help and Platform admin. The sidebar is derived from `lib/permissions.ts` and
  the organisation's feature flags. It is visibility only: the server still enforces every action. Nothing is
  shown until the role is known.
- **D151. Errors are classified** (`classifyError`): network, unauthorized, forbidden, not_found, schema, provider,
  invalid, server. Each has an Arabic message and the right recovery action. React Query retries only network and
  server errors. Likely cause of the hosted "backend unavailable" pages: the deployed frontend expects v2
  tables/RPCs that are not on the hosted database. It now says «الخادم يحتاج تحديثاً». Not confirmed on
  production, which was not touched.
- **D152. Demo personas:** the hard-coded test passwords were removed from the bundle. `npm run demo:seed` (local
  only) creates «بنك سليم التجريبي» with 7 users via the app's RPCs. The password is stored only in the git-ignored
  `demo/.demo-credentials.json`. The login page shows 5 persona cards only when `VITE_DEMO_MODE=true` **and**
  `VITE_DEMO_PASSWORD` are set at build time. The old `demo@`, `agency@` and `admin@saleem.app` accounts were
  public in the old bundle: **rotate or disable them on the hosted project before any production deploy.**
- **D153. Partners** can read their own membership row (new policy). Their navigation has no `/new`, because they
  create through their partner link.
- **D154. Removed:** `seed-demo-user.ts` (hard-coded default password, printed it, no local guard),
  `check-test-logins.mjs`, the unused `signInDemo`, the role home's wall of disabled cards, and unused `nav.*`
  i18n keys.
- **D155. e2e flakiness, revisited:** isolated runs pass (63/63, 135/135). Full parallel runs sometimes time out
  waiting for data. Traces show a 39.8 s HTML response and a REST call that never returned, with drive C at under
  1 GB free. Added a router pending state, so a slow navigation shows a loading page instead of the old page.
  Timeouts were not loosened.

## PR #1, rules verification, secure demo, live audit (2026-11-18)

- **D156. PR #1** (`feature/gemini-integration`, by ahmad daghra, 3 commits, based on pre-v2 master) was
  integrated on `integrate/pr-1-gemini`, not merged as-is. The PR implemented only the v1 `analyze()`; we added
  `GeminiAnalysis.analyzeV2` using the v2 prompt, schema and validator. The PR's v1 `review_reasons` notices were not
  taken, because v2 coverage and `unable_to_verify` cover them. Its local `saleem-local` scripts were not taken,
  because `demo:seed` supersedes them.
- **D157. AI keys:** the local OpenAI key returns 401 `expired_secret_key`. There is no Gemini key anywhere locally.
  Live AI analysis is NOT VERIFIED.
- **D158. SAMA/CMA verified against the official texts** (`SAMA_CMA_VERIFIED_MAPPING.md`): 44 verified equivalent,
  9 no match, and 1 superseded by the official text (CMA-CMI-35-RETAIL omits Art 35's suitability exception).
  Everything stays pending; no status was changed.
- **D159. Demo:** a server-side broker (`demo-login`), enabled only by the server secret `DEMO_MODE`. It issues
  one-time magic-link tokens only to allow-listed personas confined to registered sandbox orgs. `VITE_DEMO_PASSWORD`
  was removed. The 2-hour session expiry is enforced client-side; server-side per-user session timeboxes are not
  available per user in Supabase.
- **D160. Live site:** production runs the v1 build and schema. Analyses fail because the production AI key is
  invalid. The earlier "missing v2 migrations" hypothesis is withdrawn.

## Gemini only, PR #1 merge (2026-11-19)

- **D161. Gemini is the only AI provider.** `providers/openai.ts` was removed; `LLM_PROVIDER`,
  `TRANSCRIPTION_PROVIDER` and `OPENAI_API_KEY` are no longer read, so an old secret cannot route analyses to
  OpenAI, and there is no fallback. Configuration: `GEMINI_API_KEY` (required, server-side only) and
  `GEMINI_MODEL` (default `gemini-3.8-flash`). Historical runs keep `llm_provider='openai'` (not rewritten).
  Google errors are classified precisely (400 `API_KEY_INVALID` → invalid key; per-minute 429 → busy/retry;
  quota 429 → quota, no retry). Transcription media rejected by Gemini marks `transcription_failed`
  (partial coverage), never "no audio". Frames: identical consecutive frames are sent once with their
  on-screen duration; frames are packed by a 12 MiB inline budget instead of fixed batches of 16.
- **D162. PR #1 merged by history, not by copy.** `feature/gemini-integration` (e2f9c18) was merged into
  `integrate/pr-1-gemini` with a real merge commit (resolved to the v2 tree; per-file notes in the commit), so
  GitHub marks PR #1 merged when that branch reaches `master`. From the PR we also took the active-release
  rulebook filter and per-run versioned rule references in reports. PR #1 contains no API key.
- **D163. The "invalid key" error on the live site** («مفتاح مزوّد التحليل غير صالح. أبلغ فريق سَليم.») comes
  from the v1 build on `master`, which defaults to OpenAI; the OpenAI key is expired (D157). The fix is deploying
  this branch with `GEMINI_API_KEY` set as a Supabase secret, which needs separate release approval.
- **D164. Live Gemini findings (2026-11-19).** First real runs exposed: (1) a 45 s client timeout, which the SDK
  sends as `X-Server-Timeout`, made Google answer 504 for full v2 prompts (~39 s at default thinking) → 90 s;
  (2) thinking dominated output tokens and latency (6,073 → 2,419 output tokens, 39 s → 23 s for the same kind
  of ad) → `GEMINI_THINKING_LEVEL`, default `LOW` (answers stay schema-validated and evidence-checked);
  (3) CheckPage briefly rendered a report bundle fetched before the run finished — a false "no automated
  findings" — now shows the skeleton until the fresh bundle arrives; (4) the project key is on the Gemini
  **Free Tier: 20 requests/day per model**, far below SALEEM's needs — billing is required before release.
- **D165. Cost honesty and release rehearsal (2026-11-19).** Unknown model price is `null` (UI: "cost unknown",
  excluded from totals), never $0. Official prices added for `gemini-3.6-flash` (= 3.8). `gemini-3.5-flash` is
  deprecated and routed by Google to 3.6, so yesterday's live runs were effectively 3.6. Local upgrade rehearsal
  (`master` + v1 data → 34 v2 migrations) kept existing rows byte-identical and seal verification unchanged; the
  migrations backfill data and rewrite RLS, so the release needs a backup and a short maintenance window. Demo
  login UI is opt-in (`VITE_DEMO_LOGIN=true`). Inherited `seroval` (prod) and `vite` (high, dev) advisories fixed.
- **D166. Demo phase model choice (2026-11-19).** Primary `gemini-3.6-flash` (best quality in live runs). Optional
  `GEMINI_FALLBACK_MODEL` switches once to another Gemini model on 503 or timeout only — never on quota (429) or
  other errors, never another provider — and every run records the model that answered. Live evidence today:
  3.6/3.8 Flash overloaded (503) for long periods while `gemini-3.1-flash-lite` answered; Lite is faster but gave
  one false-positive company-rule violation, so it stays a fallback. A request to `gemini-3.7-flash` was served by
  `gemini-3.8-flash` (`modelVersion`). Demo guide: docs/DEMO.md.
- **D167. Video transcription under Gemini overload (2026-11-19).** Live failure: 3.6 Flash 503 → fallback 3.1 Lite
  503 within 17 s → transcription failed. Overload (503 or timeout) now retries with bounded backoff (0/3/8/15 s +
  jitter), alternating primary and fallback, never past the deadline; quota/rate limits (429) never change model.
  New error code `overloaded` (Arabic message distinct from quota and generic outage). `attempts` counts real
  requests. Retry reuses the unfinished run, keeps the upload, frames and transcript (verified live: 1 run, 32
  frames). Upload form defaults to the active workspace so org packs and company rules apply. COM-01 wording:
  a guaranteed financing approval is a finance claim (was worded as health).
- **D168. RBAC hardening for all organisations (2026-11-19).** New `backend/tests/rbac.test.ts` builds a fresh
  organisation with real users per role and calls the database directly. It found: (1) claims writes accepted any
  member except legal — viewer and both external roles could write the claims library; (2) NULL-unsafe role checks
  (`not (NULL in …)` does not raise) in assign_reviewer, respond_finding, link_claim; (3) `org_metrics` used its own
  role list instead of `org_can`. All fixed in `20261119100000_v2_rbac_hardening.sql`. Matrix: reviewer loses
  `view_analytics`; `assign_reviewer` is «cond» (self) for the reviewer, as the server already enforced. Pages:
  one `PAGE_ROLES` table drives the sidebar and a route guard; dashboard create action and claim buttons follow the
  role; query cache cleared when the signed-in user changes. Reference: docs/saleem-v2/RBAC.md.
- **D169. Final governance decisions (2026-11-19).** (1) Marketers propose claims: own drafts only, submit for
  review, withdraw before approval; approval only by a different owner/admin/lead/reviewer (`review_claim`), never by
  direct table writes. (2) Reviewers never assign: `assign_reviewer` is owner/admin/compliance_lead; `open_review` no
  longer makes the opener the assignee (that was a self-assignment path); a reviewer opens and decides only cases
  assigned to them (`can_decide` → `not_assigned`). (3) Legal is case-scoped (`legal_case`: escalated to them, or
  answered by them): promotions, versions, media, linked claims (+ evidence files), the case product and the
  disclaimers that apply; no organisation libraries or other advertisements. Also fixed: `archive_claim` was
  NULL-unsafe for non-members. Migration `20261119110000_v2_governance.sql`; tests in `rbac.test.ts` (D1–D3), pgTAP
  `p3_review`, `p6_lifecycle`, `p6_risk` now assign before opening. UI: no «استلام» for reviewers, «بانتظار الإسناد»,
  claims «اقتراح ادعاء» / «اقتراحاتي فقط» / «سحب الاقتراح», approved vs pending badges, compliance lead can assign
  and decide in the UI (server already allowed), no «إعلان جديد» for roles that cannot create.
- **D170. Sector model for non-financial advertising (2026-11-20).** Products, organisations and advertisements
  accept cosmetics, food & beverages, health & supplements, tourism, e-commerce and retail besides the five
  financial sectors; product types per sector and regulators SFDA / MOT / MOC (`SECTOR_MODEL`). Non-financial
  attributes are optional free text under `key_facts.<group>`; financial key facts and their validation apply only
  to financial sectors. The analysis context uses the advertisement's own sector, then its product's, then the
  organisation's — a bank's cosmetic ad is not evaluated as a financial promotion. Migration
  `20261120100000_v2_upgrade_workflow.sql` (constraints widened, existing values unchanged).
- **D171. MAW-03 / MAW-04 scope (2026-11-20).** The written creator agreement and the Mawthooq licence concern
  advertising through natural-person creators (GAMR/Mawthooq; secondary sources agree, official text not
  re-verified here). They now apply to `creator_sponsored` communication or `influencer` distribution only; an
  organisation publishing a general commercial ad on its own channels is excluded with the reason
  `context:communication_type`. `legal_status` stays `illustrative_pending_review`; the rule's `applicability_ar`
  states that official accounts need legal confirmation. `v2_rule_scope_fixes()` re-applies it after a fresh seed.
- **D172. Submission and finding responses (2026-11-20).** Unanswered findings no longer block submission: the
  marketer adds an explanation when `require_uploader_responses` is on (`note_required_unanswered:n`). New answers:
  correction done, request guidance, provide evidence (uploader); evidence required, correction verified,
  clarification required (reviewer, assigned only). Repeating the same answer is a no-op (no duplicate history).
- **D173. Decision gating vs approval blockers (2026-11-20).** `can_decide` returns `ok` (may decide at all) and
  `approve_ok` / `approve_blockers`. Request changes and reject need no per-finding answers; approve and conditional
  approve stay blocked by confirmed violations not verified as corrected and by missing reviewer assessments when the
  organisation requires them. Enforced in `decide_promotion`. The dialog has no default decision.
- **D174. Partners (2026-11-20).** The one-at-a-time rule blocked partners with an unsent draft (`one_at_a_time`).
  Replaced by a per-link `max_active_submissions` (default 5; draft, pending, in review, escalated, changes
  requested, conditionally approved, risk review, re-review count), checked under an advisory lock and reporting the
  blocking ads. Links gain campaign, instructions, expiry, assigned partners and communication types; rotation issues
  a new token (old one stops); partners open assigned links from their account (`partner_link_for_me`, no token);
  owners cancel unsent drafts (archived, history kept). Resubmission returns to the previous reviewer only while that
  reviewer is still eligible; re-assigning the same reviewer is a no-op.
- **D175. Structured conditional approval (2026-11-20).** `approval_conditions` (description, required action,
  evidence flag, responsible person, due date, status). Marketer answers each condition (note, https links, files in
  `evidence/<org>/conditions/<promotion>/`), then «إرسال الشروط للتحقق» (no new analysis). The assigned decider
  verifies, asks for more evidence or rejects the fulfilment; `finalize_conditional_approval` writes a separate,
  hash-chained `approve` decision only when every condition is verified and the version is unchanged. Conditional
  decisions and their conditions stay immutable history.
- **D176. Finding grouping (2026-11-20).** Grouping is a pure, deterministic client function (rule + claim facet
  from the evidence text, else rule + normalised explanation; whole-post rules collapse). Raw findings, responses and
  hashes are unchanged; an answer to a group is written to every raw finding (idempotent). The same key is used to
  compare versions. Nada Cream V1: 9 raw findings → 6 consolidated, two distinct COM-01 claims.
- **D177. Advertisement workspace (2026-11-20).** One page: header with separate approval and live analysis
  states (fixes the «جارٍ التحليل» shown after a finished report — the header read a stale bundle), historical
  version banner, role next step, latest decision with correction checklist, conditions, and five tabs. One primary
  «ارفع النسخة المعدلة» plus «الإصلاح الذكي».
- **D178. SALEEM Fix (2026-11-20).** Implemented: AI-assisted TEXT correction (plan per finding + corrected caption
  and script, user edits, acceptance creates a new text version under the same advertisement, analysed afresh, no
  approval inherited). `correction_jobs`, flag `saleem_fix` (off by default), monthly quota
  (`saleem_fix_monthly_limit`, default 30, separate from analysis), idempotency key, atomic two-step acceptance,
  estimate before any call, one Gemini request per attempt (max 3, never automatic). The model output is rejected if
  it states a licence number, regulator approval, clinical evidence, endorsement or written agreement — with no
  "already in the ad" exemption (prompt-injection test). Media editing and replacement generation: provider
  abstraction only, reported «يتطلب إعداداً»; no video is generated or simulated.
- **D179. New-advertisement wizard (2026-11-20).** Four steps; one paid flag and one licence field; the version
  platform derives from the channels; communication type follows the product; conflicts are shown before the
  analysis; field-only draft recovery in localStorage (never the file, never a server draft).
- **D180–D181. Queue and comparison (2026-11-20).** Queue: managers start on «غير مُسند», reviewers on their cases,
  counters, rich cards with grouped counts, direct assignment of eligible reviewers (`eligible_reviewers`).
  Comparison: side-by-side media, sentence-level text with labelled additions/removals, grouped findings; «no
  longer detected» is never shown as «resolved», no percentage.
- **D182–D183. Public pages (2026-11-20).** `/sample` is the read-only Nada Cream report built from the manual-test
  rows (V1 and V2 videos recovered from the local storage volume after the local DB was reset; quotes cut in the
  captured rows end with «…»). The herbal-tea demo remains at `/checks/<id>`. New landing page; every capability
  shown is implemented, provider-dependent and experimental ones are labelled.
- **D184–D185. Notifications and dashboards (2026-11-20).** Decision notifications name the decision and version
  and link to the advertisement version; new kinds `conditions_submitted`, `condition_returned`,
  `partner_access_decided`. The dashboard adds RLS-scoped workload tiles per role and the partner's links.
- **D186. Self-approval and lifecycle (2026-11-21).** `can_self_approve` also refuses multi-level flows, financial
  promotions, partial coverage, unanswered findings, open violations, required evidence, high-risk packs and
  unverified conditions. Publication can be recorded only from approved, risk-accepted or due-for-re-review states.
- **D187. Demo abuse limits (2026-11-21).** All sandbox personas share one daily AI cap, `DEMO_AI_DAILY_LIMIT`
  (default 40; `demo_quota` 429). The `demo-login` code default is now 20 sessions per IP per hour; production
  sets its own value. Destructive tests run only on the isolated stack (`scripts/isolated-stack.mjs`, `saleem_iso`).
- **D188. Evaluation (2026-11-21).** 26 Arabic cases across sectors. Three COM-01 false negatives fixed
  (absolute-result, no-side-effects and English absolute patterns). Deterministic recall reported separately.
- **D189–D191. Collaboration (2026-11-21).** Comment kinds (question, reviewer feedback, legal opinion, evidence),
  replies and links. Mentions are limited to promotion readers, and externals see role names only. Information tab.
  Mawthooq licence check is a manual, audited workflow (`verify_creator_license`). Distribution gains `agency`.
- **D192. History (2026-11-21).** One chronological timeline with actors, recorded roles, versions, transitions,
  reasons and hashes. Filters, and repeated events collapse.
- **D193–D194. Workspace and features (2026-11-21).** Six-tab Team & Workspace. The owner row shows a badge (display
  bug fixed). Features are grouped into five categories and configured in place, including the SALEEM Fix monthly
  quota.
- **D195. Roles page (2026-11-21).** Nine roles with corrected descriptions, member counts, enabled state and a
  searchable matrix grouped by functional area.
- **D196. Duplicate company rules (2026-11-21).** Duplicates are detected by stemmed Arabic token overlap (warning
  at ≥0.5; approval refused as `duplicate_of_active` at ≥0.8 or an exact match). AI extraction skips known rules.
  Nothing is deleted or silently replaced.
- **D197. Role dashboards (2026-11-21).** Per-role workspaces from RLS-scoped rows: governance, reviewer deadlines
  and resubmissions, legal cases, marketer actions, partner, external reviewer and viewer.
- **D198. SALEEM Fix media (2026-11-21).** `media_edit` is deterministic and runs in the browser on the ORIGINAL
  footage: mute ranges, cover bands, disclosure overlay, subtitles, and a recorded or uploaded voiceover. It renders
  a real MP4 or WebM with canvas, Web Audio and MediaRecorder, and acceptance creates a new video version that is
  analysed afresh. Third-party TTS and video providers report "not configured" and never return simulated media
  (`docs/saleem-v2/SALEEM_FIX_PROVIDERS.md`). A stale `accepting` job can be re-claimed by its creator after 10 min.
- **D199. Fix notifications (2026-11-21).** An asynchronous proposal becoming ready notifies its creator. An
  accepted correction notifies the assigned reviewer.
- **D200. Company rule categories (2026-11-21).** Seven descriptive categories, recorded on approved versions. AI
  drafts get a keyword guess. A category change sends an active rule back to draft. The page states that internal
  policies are not Saudi regulatory requirements.
- **D201. Partner workspace and test isolation (2026-11-21).** `/org` lists the organisations an external user is
  authorised for, from their own membership and assigned links only. The roles matrix scroller contains its
  sr-only labels. Isolated-stack hardening: the copied Gemini key is blanked unless `ISO_ALLOW_REAL_AI=1`;
  `demo-env` keeps the isolated keys under the runner; seed and workflow tests use `DEMO_STATE_DIR`. A nine-role
  browser walkthrough script was added.
- **D202. Regulatory verification (2026-11-21).** A generated register classifies the evidence of the 187 draft
  rules: official instrument vs announcement, URL reachability, and status per authority. None is marked verified
  or activated. Cosmetics coverage is mapped to the Nada claims, with one candidate rule (therapeutic claims) that
  needs legal approval. Mawthooq licence rules apply to individuals and creator content only; this is tested.
- **D203. Nada acceptance (2026-11-21).** The governance half runs as the real role users on the isolated stack.
  Approval is blocked while claim violations remain, and changes are requested with a reason. No evidence is
  invented.
- **D204. Demo rate-limit key (2026-11-21).** The client IP comes from `cf-connecting-ip`, then `X-Real-IP`, then
  the last `X-Forwarded-For` hop. The first `X-Forwarded-For` entry was client-controlled and let the per-IP limit
  be bypassed.
- **D205. Partial analysis state (2026-11-21).** The advertisement header shows «مكتمل جزئياً» when the finished
  run's coverage is partial (it reads the same cached report as the analysis tab). The conditional-approval
  workspace was exercised end to end in the browser on the isolated stack.
- **D206. Public website redesign (2026-11-21).** «/» and «/sample» get their own marketing chrome: a sticky nav
  with a mobile menu, and a footer with existing links only. The visual system uses forest and warm gold taken from
  the Nada Cream footage, with Naskh display type for Arabic. The landing presents SALEEM as a creation,
  correction, compliance and approval workspace. Its hero walks real video frames through detection, correction and
  human review. It also has two journeys (generation is labelled «قادم» or "provider-dependent", never offered as
  available), a before/after with both videos and a change ledger computed by the app's own grouping, an
  interactive lifecycle, a capabilities bento, a collaboration flow and a transparency section. The draft rules
  are never marketed as verified. «/sample» is a guided, read-only five-stage experience: original, findings,
  correction, comparison and review. Evidence seeks the video, rule references come from the published rulebook,
  and the page says V2 was prepared manually for the demonstration. «/sample» is now prerendered. Invariants are in
  `public-sample.test.ts`; screenshots are in `docs/saleem-v2/screenshots/public-redesign/`.
- **D207. SALEEM AI Studio (2026-11-21).** `/new` offers «create with AI» or «upload and correct». `/studio` is a
  seven-step workspace: brief, direction, regulatory context, script, voice, rendering, acceptance. Script providers
  are chosen explicitly: a deterministic `template` (no AI) or ONE quota-checked Gemini request (`studio`
  function), validated against fabricated licences, approvals, evidence and endorsements. A deterministic
  pre-generation review uses the claims engine. Voice is the open-source Piper model running in the browser
  (`@diffusionstudio/vits-web`, MIT): a real WAV, the text never leaves the device, free. Recording and upload
  remain. Gemini TTS, ElevenLabs and HeyGen are reported unavailable and are never faked. Video comes from a
  deterministic template renderer (canvas + Web Audio + MediaRecorder) producing a real MP4; it is never presented
  as AI footage. Acceptance goes through `createPromotion` + `createSubmission`, so analysis and human review follow
  as usual and nothing is approved automatically. Drafts are creator-private with frozen results
  (`studio_drafts`). Per-capability quotas live in `ai_usage` + `ai_allowance` (image/video default to 0). The Fix
  «replacement» method opens the Studio and saves a new version. The video corrector can generate a replacement
  narration locally. Covers hide on-screen text completely and continuously between sampled frames (both defects
  were found by inspecting the corrected Nada MP4). The microphone is allowed for self (recording was blocked in
  production), and the CSP permits local TTS.
- **D208. Partner workflow and upload fixes (2026-11-21).** Found by the partner browser test: (1) every video upload
  through the four-step wizard failed, because the poster was fetched from a preview URL the dropzone had already
  revoked (introduced in 2e13705, on master); the stored poster Blob is used now. (2) Partners could not upload the
  file or versions of their own advertisement (`/new?promotion=` was blocked by the role guard); allowed for
  external uploaders on their own ad, with the server still checking ownership. (3) `analyze` without a configured
  model now fails at once with `provider_not_configured` instead of a 10-minute «stuck». (4) Approval (full or
  conditional) requires a completed analysis of the current version (`analysis_not_done` blocker); requesting
  changes and rejecting stay possible.
- **D209. Public availability labels (2026-11-22).** The landing page and the sample describe only what was verified.
  - **Script:** the free deterministic template, or Gemini when configured (provider-dependent).
  - **Available:** Arabic and English voice generated on the device, and MP4 assembly from product photos, text and
    disclosures.
  - **Not configured:** fully generated footage and virtual presenters, labelled «paid provider, not configured»
    instead of «coming soon».
  - **SALEEM Fix:** described as in-browser correction that sends no video to a provider.
  - The Create call to action opens the Studio.
- **D210. Release preparation: rollbacks and plan (2026-11-22).** The 8 migrations pending since master had no
  `rollbacks/*.down.sql` (a §2 hard rule). They are generated from a catalog diff of each migration on the isolated
  stack (`scripts/rollback-from-catalog.mjs`) and reviewed. They restore master's function bodies and grants, and
  bring the narrower CHECK constraints back `NOT VALID`, so rows written after the upgrade do not block a rollback.
  Verified on the isolated stack:
  - master plus the 8 equals a fresh install
  - master plus the 8 plus every rollback in reverse equals master
  - a rollback over post-upgrade data succeeds

  The production steps (backup, migration check, secrets, functions, Vercel, smoke checks, rollback order) are in
  docs/saleem-v2/RELEASE_PLAN.md. Nothing is run against the hosted project without the owner's approval.
