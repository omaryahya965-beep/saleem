# Gemini integration

SALEEM now supports Google Gemini for both compliance analysis and Arabic audio transcription.
The production path remains authenticated Supabase Edge Functions, persisted analysis runs,
deterministic checks, and the existing Arabic/English report. No model error returns demo findings.
Sample/demo reports remain explicitly seeded samples, separate from user submissions.

## Architecture

- `_shared/providers/gemini.ts` implements the existing `AnalysisProvider` and `TranscriptionProvider` interfaces using the official `@google/genai` SDK, pinned to **3.3.0**. This release is compatible with the Deno dependency age policy; the newer 3.4.0 release was too recent when verified.
- The code default remains **`gemini-3.8-flash`**. The verified local environment selects **`gemini-3.5-flash-lite`** through `GEMINI_MODEL` because 3.8 returned 503 and 3.6 timed out in independent minimal requests on 2026-11-17. `GEMINI_MODEL` overrides both stages. Explicit `LLM_PROVIDER=openai` or `TRANSCRIPTION_PROVIDER=openai` retains the existing OpenAI path and its own credentials/models.
- Text ads use actual submitted text/captions. Images/carousels use the browser-prepared image frames. Video analysis uses Saudi Arabic transcription plus timestamped sampled frames, preserving the existing upload/extraction design rather than streaming original video containers to the provider.
- The model receives the selected database rulebook, category applicability, rule identifiers and existing source references. The adapter validates rule codes and grounds transcript/caption quotes in supplied content and visual timestamps in attached frames. It does not generate a regulatory reference field; the UI resolves references from the run's rulebook version. Rules remain illustrative and need legal review.
- Structured JSON uses `responseJsonSchema` and a server-side validator. Unknown rules, missing evidence, unsupported timestamps, invalid JSON, safety-blocked or truncated replies fail explicitly. Uncertain interpretations become warnings. Other uncertainty is persisted as bilingual `review_reasons` in `analysis_runs.step_outputs`; an otherwise clean result becomes `review`.
- The existing findings model supplies the rule ID, card title/explanation, evidence, timestamp, severity/risk, correction, and rulebook reference. Findings requiring human review say so in their explanation. Run-level review notices render in the existing report. No database migration is required.
- Missing visuals cannot produce an unqualified clean result. On re-checks after media expiry, prior OCR remains available to deterministic checks; it is not passed to Gemini as newly visible evidence.
- Gemini transcription token usage is stored separately in step outputs; both stages record reasoning/output tokens. The cost helper estimates only configured/known model prices; 3.5-flash-lite currently has no built-in price and its stored zero cost is **not** proof of free usage. Gemini audio is not priced as Whisper minutes. Prices are estimates, with the documented January 2027 price change and existing `PRICE_<MODEL>` overrides supported.
- Each deployed function has its own `deno.json` import map. Google SDK code and all API credentials remain server-side.

## Limits and failure behavior

- Existing app limits: 25 MiB original upload, 90 s video, at most 62 sampled frames (approximately 1/s, fewer for longer clips), 768 px frame long side.
- Gemini inline audio limit: 8 MiB; typical browser-extracted 90 s mono WAV is about 2.9 MiB. Supported audio MIME types are WAV, MPEG/MP3, MP4 audio, AAC, OGG, FLAC and WebM audio. No audio stream is handled by the existing browser probe. A raw video container when browser audio extraction fails produces a clear unsupported-input error instead of being silently treated as silence.
- Frame limit: 512 KiB each; 16 frames per request; total serialized request budget 16 MiB, below Google's documented 20 MB inline-request limit. Oversized frames fail explicitly.
- Image downloads are bounded and accept only inline JPEG/PNG/WebP or signed storage paths from the configured `SUPABASE_URL` origin. Redirects are rejected. Local/self-hosted HTTP storage is supported only when its origin is explicitly configured server-side.
- Generation timeout: 45 s per attempt, at most two attempts with jittered backoff. Complete multi-batch analysis has a 120 s budget including downloads. Authentication, authorization, unsupported-input and missing-model errors do not retry. Network, 429 and 5xx errors retry within the budget. Invalid structured responses get one retry and then fail.
- SDK auto-retries/continuations are disabled so the adapter's retry/timeout budgets control the work. Cancelling a local request does not guarantee cancellation of provider-side billing.
- Long/worst-case runs can exceed a free Edge Function's wall-time budget. Use a suitable function plan/worker execution budget for video; timeouts surface as failures and resume through the existing retry flow.
- Provider exceptions are sanitized; API keys, request bodies and signed media URLs are never logged by this adapter. API failures remain failures, not fabricated reports.

## Environment setup

From the feature checkout, copy templates only when those files do not already exist:

```bash
cp -n backend/.env.example backend/.env
cp -n backend/supabase/functions/.env.example backend/supabase/functions/.env
```

Put the real key only in the ignored `backend/supabase/functions/.env`:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash-lite
LLM_PROVIDER=gemini
TRANSCRIPTION_PROVIDER=gemini
```

Each developer supplies their own authorized key in this ignored file; do not copy another
developer's credentials into Git or a shared document. Do not add a `VITE_GEMINI_API_KEY` variable. Vite exposes only
public Supabase variables from `backend/.env`:

```dotenv
VITE_SUPABASE_URL=https://your-development-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-development-publishable-key
VITE_DEMO_MODE=false
VITE_SHOW_TEST_ACCOUNTS=false
```

Replace those placeholders with a local or development Supabase project's values. The Gemini key
alone does not provide Supabase authentication, database/storage access, or run the Edge Functions.
No service-role key belongs in frontend variables.

## Run the isolated local environment

Requirements: Node 22.12+, npm, Docker Desktop running, the existing ignored server credential file,
and Supabase CLI 3.2.0 (the commands below pin it). From the feature checkout:

```bash
npm ci
# Required for the full production prerender and Playwright checks:
npx playwright install chromium
node backend/scripts/prepare-local.mjs
npx --yes supabase@3.2.0 start --workdir ../saleem-local --exclude vector,logflare,imgproxy,supavisor,edge-runtime,studio,postgres-meta
```

Wait for startup to finish before serving functions. In a separate terminal:

```bash
npx --yes supabase@3.2.0 functions serve --workdir ../saleem-local --env-file ../saleem-local/.env.functions
```

Then configure only this checkout and start its frontend:

```bash
(umask 077; npx --yes supabase@3.2.0 status --workdir ../saleem-local --output env > ../saleem-local/status.env)
node backend/scripts/configure-local.mjs
npm --workspace frontend run dev -- --host 127.0.0.1 --port 3001 --strictPort
```

The runtime is a separate ignored directory beside the checkout, project ID `saleem-gemini-local`.
API: `http://127.0.0.1:55421`; database: port 55422; frontend: `http://localhost:3001`.
The frontend override is ignored `backend/.env.local`. Gemini credentials remain in mode-600
`../saleem-local/.env.functions`; local test-user credentials are mode-600
`../saleem-local/e2e-credentials.json`. Do not print these files. The configuration script creates
or resets two **synthetic local** accounts (`creator-live@saleem.test` and `isolation-live@saleem.test`);
the random passwords are available only in that local credentials file. It assigns a local test quota; it performs no billing action.

Production configuration, migrations and seed files are unchanged. The preparation script copies them
and makes local-only adaptations: unique ports/project/auth redirects; a local cleanup-cron URL;
and the existing rulebook seed before migrations that already depend on it, with the final versioned
rules conflict target corrected in the copied seed. The copied seed also seals the synthetic demo reports
through the existing `seal_compliance_log` function after insertion. Verification controls stay enabled.
The seeded demo submissions remain demo data and
are not used as live-analysis results. JWT verification, RLS and the private media bucket remain enabled.

Rerun `prepare-local.mjs` after function edits to refresh the runtime copy. Restart the function server
if changes are not picked up. To stop only this isolated stack:

```bash
npx --yes supabase@3.2.0 stop --workdir ../saleem-local
```

No hosted project is linked, reset, deployed or modified by these scripts.

## Verification commands

```bash
npm test
npm run lint
npm --workspace frontend exec tsc -- --noEmit -p .
deno check --config backend/supabase/functions/analyze/deno.json backend/supabase/functions/analyze/index.ts
deno check --config backend/supabase/functions/diagnostics/deno.json backend/supabase/functions/diagnostics/index.ts
npm run build
# Mocked browser contract tests; separate from live provider checks:
npm --workspace frontend run e2e -- gemini-report.spec.ts
# Opt-in live provider smoke tests:
npm --workspace backend run smoke:gemini
```

The opt-in smoke command makes **live Google requests**, using representative synthetic Arabic ads
and the repository's existing seed rulebook. It covers clean text, misleading claims, multiple rules,
an image, and synthetic Saudi speech plus a video frame. It writes a sanitized, ignored
`backend/eval/results/gemini-live.json`. Use `-- --case=clean-text` to run one case. The tests use the
same production adapter; mock transport tests alone do not establish that the live API works.

The Playwright `gemini-report.spec.ts` tests the report and exhausted-503 contracts with mocked REST responses, separately
from the live provider. It verifies Arabic/English notices, the review status, language switching and
the absence of misleading clean-result copy. The Browser plugin was unavailable in this session;
the check used Playwright with the device's installed Google Chrome on desktop and mobile viewports.

## Reproduce live checks

These commands make real Google requests and consume any applicable API quota. They do not enable billing:

```bash
# Independent official REST probe: model lookup, bare text, JSON, Arabic, image, direct video.
node backend/scripts/probe-gemini.mjs
# Real browser login/upload/Edge Function/Gemini/database/report. Installed Google Chrome required.
node backend/scripts/live-local-e2e.mjs
# Optional single-case rerun; output files are overwritten in the selected output directory.
node backend/scripts/live-local-e2e.mjs --case=image-ad --output-dir=backend/eval/results/live-local/image-rerun
# Real two-user authentication, database and private-storage isolation checks.
(cd backend && node --env-file=../../saleem-local/.env.isolation ../node_modules/vitest/vitest.mjs run tests/isolation.test.ts)
```

The direct probe uses at most three attempts, 1/2-second exponential backoff, and 20-second minimal
request timeouts (30 seconds for progressive media requests). It records status, sanitized errors,
latency, availability and usage, without importing SALEEM or Supabase. The browser harness uses up
to three UI invocations per case with 2/4-second exponential backoff. Each provider invocation retains
its own two-attempt budget. A local-only network guard aborts accidental remote backend requests;
it never supplies responses. Its fixtures and accounts are synthetic, while authentication, uploads,
provider responses and persisted analysis results are live.

## Verification observed on 2026-11-17

- Official API listed 64 models. All three requested models were available (HTTP 200).
  3.8-flash failed all three bare-text attempts with HTTP 503/high demand. 3.6-flash exceeded all
  three 20-second request timeouts. 3.5-flash-lite succeeded with bare text, JSON, Arabic, image
  and direct video input. Arabic required one retry after a 503.
- All five authenticated frontend cases **PASS** using `gemini-3.5-flash-lite`: Arabic coffee text,
  misleading weight-loss text, image claim, 13-second Arabic video, and insufficient evidence.
  Findings reference the existing run rulebook. Image claim COM-01 was grounded in visible text;
  video used 15 frames and three real Arabic transcript segments. Licensing uncertainty and
  insufficient evidence displayed explicit human-review notices. No demo results replaced errors.
- Intermittent upstream 503s occurred during live checks before successful bounded retries.
  An early video harness run clicked before media inspection; waiting for the preview fixed
  the harness without changing application video processing.
- Live local Supabase isolation: **7 pass**, one skip-notice test skipped because the suite was enabled.
- Unit tests: **37 frontend + 140 backend pass** (177 total, including 47 Gemini mocked-transport tests).
  Frontend TypeScript, both Edge Function Deno checks, lint (17 existing warnings) and SPA build pass.
  Production build includes all 12 prerender routes after installing bundled Chromium.
- The wider browser suite passes **39/39**, exercising local public data plus mocked signed-in/report contracts.
  The initial three public verification failures reproduced on the untouched default branch because
  local synthetic demo logs were unsealed; the copied local seed now invokes the trusted sealer.
- Frontend/backend unit tests and mocked report rendering are separate checks; they do not prove
  live provider accuracy. Screenshots and sanitized per-case usage/latency are in the external
  verification report, not seeded database samples.
- Remaining limits: provider availability remains intermittent; 3.8/3.6 are not verified working
  with this key. No built-in 3.5-flash-lite cost estimate. The illustrative rulebook and broader
  Saudi speech/OCR accuracy still require expert evaluation. Existing dependency advisories and their CI/developer impact
  are recorded in `docs/GEMINI_REVIEW.md`; the audit gate remains enabled.
- No billing, hosted Supabase data/configuration, deployment, push, merge or pull request changed.

## Official references

- Stable model and input modalities: https://aistudio.google.com/docs/models/gemini-3.8-flash
- Official SDK: https://github.com/googleapis/js-genai
- Structured outputs: https://aistudio.google.com/docs/structured-output
- Audio and inline-request constraints: https://aistudio.google.com/docs/audio
- SDK timeout/abort/schema configuration: https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html
- Per-function Deno dependencies: https://supabase.com/docs/guides/functions/dependencies
- Pricing estimates: https://aistudio.google.com/docs/pricing#gemini-3.8-flash

## Review boundaries

Canonical rule titles, reference names and reference URLs come only from database rules selected
for the run's version. Model-supplied source fields are discarded, unknown rule codes fail validation,
and finding text is rendered as plain React text. A model cannot install its own regulatory link.
Free-form explanations can still contain incorrect legal assertions; this is not a guarantee against
all hallucinated prose. The illustrative rulebook and uncertain findings require human review.

Existing environments that relied on implicit OpenAI defaults must explicitly set
`LLM_PROVIDER=openai` and `TRANSCRIPTION_PROVIDER=openai` with their existing key before adopting
this branch, or configure Gemini explicitly. No hosted configuration is changed by local setup.

The Vite dev server should stay on loopback while inherited development-server advisories remain.
Use `npm audit --omit=dev --audit-level=high` to reproduce the existing failing CI audit gate;
do not treat passing application tests as a clean dependency audit. See `GEMINI_REVIEW.md`.
