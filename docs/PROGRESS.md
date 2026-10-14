# SALEEM — Progress log

## Phase 1 — Audit (done)
- **Done:** `docs/AUDIT.md` (architecture, visual per screen, UX, functional F1–F19, code, gap list).
  36 before-screenshots + console log in `docs/audit/before/` via `scripts/audit-before.mjs`.
- **Verified:** typecheck/tests/build pass; lint fails (CRLF); hosted REST OK; demo login fails (400);
  CLI linked (migrations in sync, 2 functions deployed with verify_jwt).
- **Mocked/pending:** everything listed in AUDIT §4 (processing simulated, log hardcoded, provider mocks).
- **Blockers found:** no `docs/design/`, no `backend/tests/fixtures/`, no service-role key locally.
- **Next:** Phase 2 design system.

## Phase 2 — Design system (done)
- **Done:** tokens + semantic tokens in `styles.css` mapped to Tailwind; self-hosted fonts; type scale;
  motion/reduced-motion; i18n rebuilt (`src/i18n/{ar,en}.json`, typed keys, dir switching, formatters);
  30 primitives in `components/ui`; dev-only `/styleguide`; localized 404/error pages; route code splitting.
  `docs/DESIGN_SYSTEM.md` documents tokens and contrast.
- **Verified:** tsc ✓, eslint 0 errors (was 4,930), vitest ✓, build ✓; styleguide screenshots in
  `docs/screens/phase2/` (desktop/mobile × AR/EN), no console errors.
- **Pending:** legacy screens still use legacy CSS (Phase 3).

## Phase 3 — Screens redesigned (done)
- **Done (G1–G10):** report (needs fixes/review/ready) with status band, facts, synced player ⇄ timeline ⇄
  issue cards ⇄ transcript, delete-media dialog, sticky mobile action bar; ready view with real
  "what you fixed" diff vs parent; new check (segmented type, validated dropzone with preview, caption,
  title, platform/category, 3 switches with helpers, license prefilled from profile, consent, side
  panel + privacy, re-check banner); live processing (real progress/steps, ETA, cancel, failure + retry);
  dashboard (URL filters, debounced search, pagination, thumbnails, skeleton/empty/error); A4 compliance
  log (verification ID, SHA-256, QR → /verify/:id, print CSS); rulebook (search, category tabs, grouped
  rules, illustrative notice); landing (interactive mini-report, how/who/what/trust, footer disclaimer);
  auth (sign in, sign up, forgot, reset, demo); settings (profile, license, platforms, language).
  Removed all legacy screens, legacy CSS (1,225 lines), hardcoded fixtures and silent mock fallbacks.
- **Verified:** tsc ✓, eslint 0 errors, vitest 15/15, build ✓ (main chunk 285 kB). 65 screenshots in
  `docs/screens/phase3/` (16 screens × desktop/mobile × AR/EN), zero console errors/failed requests;
  no horizontal overflow at 390 px (`scripts/find-overflow.mjs`).
- **Mocked/pending:** signed-in screenshots use network mocks (no test account). Demo login shows a clear
  message because `demo@saleem.app` doesn't exist on the hosted project. Real pipeline results depend on
  Phase 4. `/verify/:id` target page is Phase 5.6.

## Phase 4 — Core product works (done, with blockers noted)
- **Done:** provider layer (OpenAI ASR + vision/reasoning, strict JSON, retries; Gemini/Anthropic disabled),
  resumable `analyze` (auth + ownership + rate limit + heartbeat + cancel + clear errors + cost/tokens/
  durations/models/prompt+rulebook versions stored), browser extraction (frames + WAV), deterministic
  Arabic checks (disclosure, codes, promo phrases, health/finance claims, metadata, AI), merge rules,
  integrity migration, cron cleanup, cancel/retry RPCs, evidence frames in reports, English source names,
  eval harness + admin page, clip runner.
- **Verified (evidence):**
  - Backend tests 42 pass (+7 live isolation tests skipped: need test accounts); frontend 19 pass; Deno check ✓.
  - Live function checks: no JWT → 401, publishable key → 401, cron w/o secret → 403, anon finding insert → RLS 42501.
  - Live model eval (`backend/eval/results/latest.json`): 12 cases, recall 100 %, precision 94 % (1 false alarm:
    perfume "lasts all day" flagged COM-01), mean timestamp error 0 s, $0.0057 and 7.5 s per case.
    Deterministic-only baseline: recall 53 %, precision 100 %.
  - Real video through the full path (`docs/demo/CLIPS.md`): synthetic 22 s Saudi-dialect ad (TTS + slides) →
    23 frames + WAV → 6 findings, 5/5 expected rules, claim at 8.2 s, 30.6 s, $0.027.
  - Browser extraction verified in Chromium (`scripts/verify-extract.mjs`): 7 frames @1/s 768×432 + 16 kHz WAV.
- **Blocked / pending:**
  - Your real clips: `backend/tests/fixtures/` had none → run `npm --workspace backend run clips` after adding them.
  - Live end-to-end through the deployed function + storage isolation proof: needs two confirmed test accounts
    (`TEST_USER_A/B_*` in backend/.env) or the demo user.
  - `eval_runs` upload needs `SUPABASE_SERVICE_ROLE_KEY` locally; the admin page currently has no DB rows.

## Phase 5 — Product features (done; some paths verified only with mocks)
- **5.1 Settings:** plan & usage meter, profile, license, platforms, language (saved to profile), email
  notifications toggle, change password, JSON export, account deletion (Edge Function `account`).
- **5.2 Archive audit:** `/archive` multi-clip upload (≤ plan batch, validated), shared metadata, progress;
  `/archive/:id` summary («N مقاطع قد تؤثر على تجديد رخصة موثوق»), per-clip status/rules, CSV (UTF-8 BOM for Excel).
- **5.3 Agency workspace:** `/org`, `/org/:id` (overview stats, campaigns, members + roles, invites),
  `/org/:id/campaigns/:cid` compliance view, `/invite/:token`; New check can target a workspace + campaign;
  org-scoped RLS for submissions, child tables and storage.
- **5.4 Sharing:** share dialog on reports (expiry, copy, revoke, decision history), public `/share/:token`
  read-only report with approve / request changes / comment.
- **5.5 Rulebook admin:** `/admin/rules` versions draft → legal review → published, changelog, effective date,
  rule editing on drafts; report banner + menu action to re-run on the latest version.
- **5.6 `/verify/:id`:** authentic + unchanged check, local file hash match.
- **5.7 Notifications:** in-app table + bell + toasts; email via provider interface (console by default).
- **5.8 Plans & quotas:** server-side limits + usage meter; friendly quota errors in New check/Archive.
- **5.9 i18n:** all new strings in ar/en (typed keys; test asserts quota + legal coverage); LTR screenshots.
- **5.10 Legal:** `/legal/terms|privacy|disclaimer|ai` + footer links.
- **Verified:** migration applied; live RPC checks (verify demo → `unchanged: true`; bad token → `valid:false`;
  anon can't create links/compute hashes); functions deployed (`analyze` v-next, `account`); tsc ✓, eslint 0
  errors, frontend 22 tests, backend 42 (+7 skipped); 28 screenshots in `docs/screens/phase5/`, no console
  errors, no 390 px overflow.
- **Mocked/pending:** signed-in Phase 5 screens were exercised with network mocks (no test accounts);
  org/share/rerun/delete flows are not yet proven end-to-end against the live DB. Email sending is console-only.

## Phase 6 — Quality & production readiness (done; one target missed)
- **Security:** RLS everywhere, results write-protected, quotas in triggers, JWT + ownership checks in functions,
  rate limits (analyze, reviews), audit log, security headers, `npm audit` 0 vulnerabilities (prod + dev).
  Live two-user isolation tests written (`backend/tests/isolation.test.ts`), skipped until test accounts exist.
- **Reliability:** resumable idempotent steps, heartbeat + watchdog cron, backoff + timeouts, orphan cleanup.
- **Observability:** structured function logs, client error reporter interface, `/admin/metrics` (runs, failures,
  p50/p95, cost by model, daily, recent errors), `/admin/eval`.
- **Performance:** code splitting + vendor groups, lazy Supabase, prerendered public pages, font preloads.
  Lighthouse desktop: landing 97 / rules 97 / report 85 perf; accessibility 95–100; best-practices 100; SEO 100.
  Mobile (simulated) perf ~70 — **below the ≥ 90 target**; applied-throttling FCP ≈ 1.9 s, login 92.
- **Tests:** frontend Vitest 22, backend Vitest 42 (+7 live, skipped), Deno type-check, Playwright E2E 33/33.
- **CI:** `.github/workflows/ci.yml` (needs repo variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- **Deployment:** `docs/OPERATIONS.md` (staging/prod, env per env, hosting options, cron, backups, domain, email,
  Sentry, Saudi data residency path); README ≤ 10 commands.

## Phase 7 — Demo & pitch assets (done)
- `docs/DEMO_SCRIPT.md` (3-minute flow: needs fixes → seek → re-check → ready → verify log), demo pair seeded from
  real pipeline output with playable video, `docs/demo/ACCURACY.md` (pitch slide), `docs/demo/final/` (60
  screenshots), `docs/demo/CLIPS.md`, `docs/FINAL_REPORT.md`.
- **Verified:** final run — tsc ✓, eslint 0 errors, Vitest 22 + 42 (+7 skipped), Deno ✓, E2E 33/33, build with
  12/12 prerendered pages; demo verify page reports `unchanged: true`.
- **Next:** see FINAL_REPORT §5–6 (test accounts, real clips, mobile LCP, legal review, deployment).

## Hotfix 2026-10-14 — real checks failed at «تفريغ الكلام» («مفتاح غير صالح»)
- **Root cause:** the hosted `OPENAI_API_KEY` secret was a 19-character placeholder (no `sk-` prefix) — byte-identical
  (SHA-256 digest match) to `backend/supabase/functions/.env`, from which it had been pushed at project setup. The
  real key (164 chars, `sk-proj-…`, no spaces/quotes) existed only in `backend/.env`. Local smoke/eval/clip runs
  worked because `backend/eval/lib.ts` lets `backend/.env` override the functions env, so the bad hosted secret
  went unnoticed. Code read the right variable (`OPENAI_API_KEY`); project/function linkage was correct.
- **Evidence (hosted, via new admin-only `diagnostics` function):** before — `/v1/models` 401 `invalid_api_key`
  (also for `gpt-6.1-sol` and `whisper-1`); after — all 200, 2 s transcription OK in 1.9 s.
- **Fix:** set the real key as the hosted secret (temp file, deleted; value never printed), replaced the placeholder
  in the git-ignored `functions/.env`, redeployed `analyze` + `diagnostics`.
- **Error mapping rewritten** (`_shared/providers/errors.ts`): "invalid key" only for 401; 403 no access, 404 model
  not found, 429 split into insufficient_quota vs rate_limited, 400/413/415/422 bad request, 5xx/timeouts provider
  down. Stored as `code:` tokens, translated in the UI (ar/en generated from the same table by
  `scripts/gen-pipeline-errors.ts`). Server logs provider status, error type and request id (keys redacted).
  Tests: backend 60 (+18 mapping), frontend 24.
- **Real end-to-end check (deployed pipeline, demo@saleem.app, synthetic 22 s ad):** reached report «يحتاج تعديلات»
  in ~140 s; 6 findings (MAW-01 00:00, COM-01 00:08 speech, MAW-02 00:08, COM-01 00:12 on-screen, MAW-03, MAW-04);
  transcribe 5.9 s, model 29.1 s, 23 frames, 5,584/1,518 tokens, **$0.0285**. Screenshot `docs/demo/real-check-report.png`.
  Open: ~60 s spent between 95 % and done (persist/notify phase) — not yet profiled.
- `diagnostics` is kept as an admin-only function (`node scripts/run-diagnostics.mjs`); it returns no secret values.

## Audio modes 2026-10-14 — speech / music_no_speech / no_audio
- **Browser probe** (`frontend/src/lib/speech.ts`, stored as `submissions.audio_probe`): RMS p95 (silent < −50 dB),
  2–8 Hz envelope modulation, pause ratio, ZCR variation; score = 0.2·mod + 0.4·pause + 0.4·zcr, pause < 0.08 →
  no_speech_likely. Calibration (Chromium): speech 0.89 / 0.91 → speech_likely; music 0.18 → no_speech_likely; silent clip → silent.
  The probe only skips the API call for no-audio/silent; "no_speech_likely" switches the post-filter to strict.
- **Post-transcription filter** (`_shared/rules/speech.ts`): drops segments by no_speech_prob + avg_logprob,
  very low logprob, compression ratio > 2.4 (loops) and known hallucinations («شكراً للمشاهدة», «اشتركوا في القناة»,
  subtitle credits, [موسيقى]). Speech requires ≥ 2 kept words; otherwise the transcript is emptied and dropped lines are kept in `step_outputs.asr_dropped`.
- **No-speech handling:** MAW-01 only satisfied by written disclosure (on screen in first 5 s or caption) with explicit wording;
  report note «المقطع بدون كلام…», transcript «لا يوجد كلام في المقطع», `analysis_runs.audio_mode` shown in report facts and compliance log.
- **Real end-to-end (hosted, real UI, demo account):**

| Clip | audio_mode | Status | Findings | Processing | Cost |
|---|---|---|---|---|---|
| music-only-ar (fixture) | music_no_speech | يحتاج تعديلات | 4 (MAW-01 written-disclosure, MAW-02, COM-01 ×2) | ~118 s | $0.0232 |
| no-audio-ar (fixture) | no_audio | جاهز للنشر | 0 (transcription skipped) | ~95 s | $0.0111 |
| slimming-tea-ar | speech | يحتاج تعديلات | 6 | ~116 s | $0.0284 |

  Whisper hallucinated «اشتركوا في القناة» on the music clip; the filter dropped it. Screenshots in `docs/demo/audio/`.
  Tests: backend 84 (+speech), frontend 28 (+probe).

## Report latency 2026-10-14 — the "~60 s after 95 %" gap and total time
- **Root cause of the gap: the measurement, not the pipeline.** `scripts/e2e-real-check.mjs` polled the progress bar with
  Playwright's default 30 s timeout; once the processing view unmounted, two lookups waited 30 s each (~60 s). The server
  itself reached "done" ~9 s after 95 % (instrumented: blur 6.7 s, findings/log/run writes ~0.4 s each), and the browser polls
  status every 1.5 s. **No cron job finishes normal runs**: the only jobs are `saleem-fail-stuck` (every 5 min, fails checks idle
  ≥ 10 min) and `saleem-cleanup-media` (hourly). `backend/tests/no-cron-dependency.test.ts` fails if a scheduled job ever calls
  `analyze` or writes `done`, if the pipeline stops writing `done` itself (before seal/notify), or if it gains fixed waits.
- **Speed-ups (analyze):** rules/frame list/frame rows/signed URLs prepared while transcription runs; on-screen text written in
  one parallel batch (was ~22 sequential updates, 9.4 s → 1.2–1.8 s); evidence frames blurred in parallel and alongside the
  findings writes; run save + status "done" written together; seal + notification after "done", in parallel; handler lookups
  (rate limit, rulebook, latest run) in parallel; no separate 85 % write. Every step is now timed in `durations_ms`.
  Transcription stays before the model call on purpose: the model needs the transcript to judge spoken claims and disclosure.
- **Before / after (hosted, real UI, demo account; processing = submit → report visible):**

| Clip | audio_mode | Before (as reported) | Before (corrected) | After | Server total after | Transcribe | Model | OCR store | Blur | Cost after | Findings |
|---|---|---|---|---|---|---|---|---|---|---|---|
| music-only-ar | music_no_speech | ~118 s | — | **44 s** | 35.6 s | 4.4 s | 21.2 s | 1.3 s | 4.3 s | $0.0145 | 4 (same) |
| no-audio-ar | no_audio | ~95 s | — | **21 s** | 14.7 s | skipped | 8.4 s | 1.2 s | 0 | $0.0040 | 0 (same) |
| slimming-tea-ar (22 s) | speech | ~116–131 s | 64 s (server 58.6 s: OCR 9.4, blur 6.7) | **48 s** | 42.0 s | 5.5 s | 25.3 s | 1.8 s | 4.7 s | $0.0170 | 6 (same) |

  95 % → report is now ~4–5 s (mostly the blur). Cost differences vs. earlier runs come from prompt caching, not code changes.
