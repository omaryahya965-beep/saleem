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
