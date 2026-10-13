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
