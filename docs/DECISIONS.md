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
