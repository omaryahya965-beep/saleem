# SALEEM — Phase 1 Audit

Date: 2026-10-14 · Branch: `phase-1-audit` · Base commit: `22123f8`

Method: ran the Vite dev server against the hosted Supabase project, captured all 9 legacy screens ×
desktop (1440×900) / mobile (390×844) × AR / EN with Playwright (`scripts/audit-before.mjs`), recorded
console output and failed requests (`docs/audit/before/console-log.txt`), probed the hosted REST,
Auth and Functions endpoints with the publishable key, and read every source file in `frontend/src`
and `backend/supabase`.

Screenshots: `docs/audit/before/<screen>.<desktop|mobile>.<ar|en>.png` (36 files).

## 0. Baseline health

| Check | Result |
|---|---|
| `tsc --noEmit` (frontend) | Pass |
| `npm run lint` | **Fail**: 4,930 problems, almost all `prettier/prettier Delete ␍` (files checked out with CRLF, no `.gitattributes`, prettier expects LF) |
| `npm test` | Pass, but only 1 frontend test (route smoke) and 8 backend tests |
| `npm run build` | Pass, single 573 kB JS chunk (warning >500 kB, no code splitting) |
| Hosted REST (anon) | OK: 12 rules, 1 rulebook version, 2 demo submissions, 6 demo findings |
| Demo login `demo@saleem.app` | **Fails (400)**: the user was never seeded on the hosted project |
| Edge Functions | `analyze` and `cleanup-media` deployed v1, `verify_jwt: true` |
| Migrations | 1 local = 1 remote (`20261013000000`) |
| Console | Every screen logs `An empty string ("") was passed to the src attribute` (`<source src="">` in VideoPlayer) |

## 1. Architecture-level problems (apply to every screen)

1. **No real routing.** The whole app is one route (`/`) with a `useState<Screen>` switch
   (`frontend/src/routes/index.tsx`). No URL per screen, no deep link to a report, back button
   leaves the app, refresh always goes back to the hardcoded demo report.
2. **No auth state.** Nothing reads the session. Signed-out users see "My checks" and the report;
   the avatar letter «م» is hardcoded; there is no sign out, no sign up, no forgot password.
3. **No i18n in the UI.** `lib/i18n.tsx` defines ~130 keys and a provider, but no screen uses it.
   Every string is hardcoded Arabic, `dir="rtl"` is hardcoded, and the «EN» button has no handler.
   All `*.en.png` screenshots are identical to the Arabic ones.
4. **No mobile navigation.** `nav` is hidden below ~900 px and nothing replaces it. On 390 px the
   user cannot reach My checks / New check / Rulebook (Playwright had to dispatch DOM clicks).
5. **Two parallel component systems.** ~30 shadcn/Radix files in `components/ui/` are unused by the
   screens; screens use bespoke `components/Button.tsx` + 1,227 lines of global CSS classes in
   `styles.css`. Button has no `type`, `disabled`, `loading` or `size`.
6. **Data fetching bypasses TanStack Query.** Every screen uses `useEffect(fetch...)` with no
   loading, empty or error state; errors are swallowed or replaced with fixtures.
7. **Mock data leaks into non-demo mode** (see §4).

## 2. Visual issues per screen

### Report — needs fixes (`report-needs-fixes.*`)
- Status band is good in spirit, but the facts row is 4 unlabeled grey strings; platform shows the raw
  enum `snapchat`; date is hardcoded «13 أكتوبر 2026»; no provider/model fact.
- Issue titles are `explanation_ar.slice(0, 45)`, so titles are cut mid-word («...في إعلان منتج ص»).
- Each card shows the rule code twice (`MAW-01` chip + `MAW-01` text) and the "source" link is
  always the string «دليل القواعد 2026.10» that navigates to the rulebook, not the official source.
- Evidence thumbnail is a dark green placeholder square even for transcript/metadata evidence.
- Video: placeholder play icon over an empty `<video>`; timeline assumes a 40 s clip
  (`time / 40`); timestamps formatted as `00:${seconds}` (breaks ≥ 60 s, e.g. `00:75`).
- Timeline markers are positioned with `inset-inline-start`, but the start/end labels are swapped
  visually in RTL ("00:40" on the left under the start, "00:00" on the right) and the fill
  direction contradicts the markers.
- Transcript collapsed by default in a `<details>` with no timestamps clickable.
- Whole issue card is a `<button>` that contains a nested `<a>` (invalid interactive nesting).
- Mobile: player is not sticky, no sticky action bar; the long card list pushes the primary
  action off-screen.

### Report — ready (`report-ready.*`)
- «ما تم إصلاحه» lists `defaultIssues` (hardcoded fake issues such as «ظهور شخص يبدو قاصراً»)
  because the ready submission has no findings — the comparison is **fabricated**, not computed
  from the parent submission's findings.
- Previous-version link is hardcoded to «5 ملاحظات» and the demo ID.
- Large empty left half on desktop.

### New check (`new-check.*`)
- Dropzone is click-only (no drag-and-drop handlers despite the copy), no preview, no thumbnail,
  no duration or size, no validation (90 s / 25 MB / format are only text).
- Only 3 platforms and 2 categories offered; the schema supports 5 and 6.
- "Text only" kind still shows the file dropzone and no text field.
- No license number field, no consent checkbox; «ابدأ الفحص» has no loading/disabled state,
  so double-submits create duplicate submissions.
- Side panel promises «لا نحتفظ بالفيديو بعد 24 ساعة» but no cleanup cron is scheduled.
- Switch helper texts are copy-pasted («يمكنك تغيير هذا الخيار لاحقاً» twice).
- `<select>` uses native styling inconsistent with the rest.

### Processing (`processing.*`)
- **Entirely simulated**: a `setInterval` adds 25% every 1.8 s and a button reads «محاكاة اكتمال
  الفحص». It never reads the submission's `status`/`progress`. No cancel, no failure state, no
  time estimate. «عرض التقرير» always opens the demo report.

### Dashboard (`dashboard.*`)
- Date is hardcoded «13 أكتوبر 2026», platform shows raw enum, no thumbnails (play icon only).
- Status chip maps everything that isn't `needs_fixes` to «جاهز للنشر» (a `review` or failed check
  would show as ready — a correctness bug).
- No search, no pagination, no empty state, no loading skeleton, no error state.
- Mobile: titles wrap into 3 lines; filter pills wrap onto two rows.

### Rulebook (`rulebook.*`)
- Version label hardcoded; groups don't match tabs (AI rules appear under "Content" group but under
  the "Transparency" tab). No source name, date, description or check type shown.
- If the query fails, a 5-rule hardcoded fallback is shown silently (even outside demo mode).

### Compliance log (`compliance-log.*`)
- **Entirely hardcoded**: content name, platform, date, hash `7d8a9c…e31f`, «جاهز للنشر», and the
  issue table (`defaultIssues`) regardless of the submission. ID is `SLM-` + first 8 chars of UUID
  («SLM-D0000000»). No verification ID, no QR, no real hash, no print stylesheet
  (header/buttons print too).

### Landing (`landing.*`)
- Mini-report is static (no interaction). Only hero + "how it works"; no who-it's-for, what it
  checks, trust/limits or footer/disclaimer. «سليم» in hero copy lacks the fatha used in the brand.

### Login (`login.*`)
- «إنشاء حساب جديد» silently logs in as the demo user. Demo login fails on the hosted project
  (user not seeded) and the error is unhandled. Error text uses inline `#ef4444` (off-palette, and
  raw English Supabase messages). No forgot password, no labels association/validation.

### Cross-screen visual
- Typography: Google Fonts `@import` (render-blocking), no preload; no defined scale (sizes vary
  per class); English text renders in the Arabic font.
- Contrast: muted text on paper is OK (#4B5552/#F3F1EA ≈ 7.1:1), but `.chip.w` amber on amber-bg
  and some 12 px labels are borderline; focus ring is mint (#7FD1AE) on paper = 1.6:1 (fails 3:1).
- Touch targets: filter pills and timeline markers are < 44 px on mobile.
- No 404 in Arabic; root error screens are English-only and use shadcn tokens that don't exist in
  the palette.

## 3. UX issues
- Users can't tell whether they're signed in; reports for real checks aren't reachable by URL.
- After «ابدأ الفحص» the processing screen lies about progress, then shows the demo report instead
  of the new one — the core flow is a dead end.
- «رفع النسخة المعدّلة» jumps to the fake processing screen instead of a re-check form with the
  parent linked.
- No feedback on failures anywhere (upload error is swallowed: `console.warn` and continue).
- Copy inconsistencies: «تنزيل سجل الامتثال» vs «سجل الامتثال»; «جرّب الحساب التجريبي» vs i18n
  «جرّب العرض التوضيحي».

## 4. Functional issues
| # | Issue | Where |
|---|---|---|
| F1 | Analyze is called with the publishable key as Bearer; functions have `verify_jwt: true`, and `sb_publishable_` keys are not JWTs → gateway rejects; the error is swallowed | `client.ts triggerAnalysis` |
| F2 | `analyze` uses the service role and never checks who the caller is — any caller with a valid JWT can trigger analysis (and spend OpenAI budget) on any submission ID | `functions/analyze` |
| F3 | Silent mocks in production paths: transcription returns a canned Arabic transcript when there is no key **or no audio**; LLM returns 2 canned findings when there is no key | `providers/*.ts` |
| F4 | Frames are never extracted/uploaded (`extractVideoFrames` is unused), so the vision check receives no images; OpenAI path sends no images at all | `client.ts`, `llm.ts` |
| F5 | Full video file (up to 50 MB) sent to Whisper as `audio/wav`; Whisper limit is 25 MB and the mime is wrong | `transcription.ts` |
| F6 | LLM model hardcoded `gpt-4o` for OpenAI regardless of `LLM_MODEL`; `json_object` not strict schema; no schema validation | `llm.ts` |
| F7 | Env var mismatch: secrets set `TRANSCRIPTION_MODEL`, code reads `ASR_MODEL`; DB default `llm_model` is a retired Claude model | `analyze/index.ts`, migration |
| F8 | Deterministic checks miss discount codes, promo phrases, health/finance claims (all delegated to LLM) and don't read on-screen text | `deterministic.ts` |
| F9 | Pipeline runs in one request; any failure leaves the submission stuck in `analyzing` (status never set to `failed`, no `error_message`) | `analyze/index.ts` |
| F10 | Compliance log hash falls back to `hash-<id>`; no verification ID; log page ignores the DB entirely | `analyze`, `Log.tsx` |
| F11 | Storage path `${userId}/${Date.now()}_original.ext` is not under `${userId}/${submissionId}/`, so `cleanup-media` (which lists `user/submission/`) never finds the files → media is never deleted | `client.ts`, `cleanup-media` |
| F12 | No cleanup cron scheduled; `cleanup-media` has no caller auth either (any JWT can wipe any submission's media) | `cleanup-media` |
| F13 | Upload failure is swallowed and the submission is still created pointing at a non-existent file | `createNewSubmission` |
| F14 | Report fetch falls back to fixtures for demo IDs even outside DEMO_MODE; rules fall back to hardcoded list | `client.ts` |
| F15 | Status `review` rendered as ready on the dashboard | `Dashboard.tsx` |
| F16 | No run metadata stored: tokens, cost, durations, provider, rulebook_version_id | `analyze` |
| F17 | First registered user automatically becomes admin (trigger) — risky on a public sign-up | migration |
| F18 | `ai_settings` writable by admin but the function prefers env; two sources of truth | migration |
| F19 | Rule sources point to homepages (`gcam.gov.sa`, `mc.gov.sa`) presented as citations; not flagged as illustrative in the UI | seed |

## 5. Code issues
- Duplicated UI: three copies of the demo issue list (`Report.defaultIssues`, `client.ts` fallback,
  `Log.tsx` via import); two Button components; two StatusChip concepts (`v/w/ok` vs DB enums).
- Inline styles in Login, NewCheck, VideoPlayer, Processing.
- Hardcoded strings: ~100% of UI copy in components; i18n dict unused.
- `IssueItem` uses cryptic `type: "v" | "w" | "ok"` instead of the DB `severity` enum.
- `styles.css` mixes legacy global classes with an unused shadcn theme block; tokens not mapped
  into Tailwind; no semantic tokens; no reduced-motion handling.
- `lib/supabase.ts` contains SSR leftovers (`process.env`, server URL rewriting) and a fake local
  anon key fallback that hides misconfiguration.
- Unused: `extractVideoFrames`, `deleteSubmissionMedia`, `use-mobile`, ~25 `components/ui/*`.
- CRLF line endings break lint on Windows.

## 6. Gap list vs. the product prompt

| Area | Exists | Partial | Missing |
|---|---|---|---|
| Routing / auth | Supabase client | Login (password only) | URL routes, guards, sign up, forgot password, sign out, demo user |
| i18n | Dict + provider | — | Wiring, EN/LTR, toggle, localized dates/numbers |
| Design system | Palette vars | Global CSS | Tokens in Tailwind, semantic tokens, type scale, primitives, styleguide |
| Report | Layout | Status band, cards | Real seek/sync, durations, transcript sync, real "fixed" diff, evidence frames |
| New check | Form | Toggles | Validation, preview, drag-drop, text/image flows, license, consent |
| Processing | UI | — | Real progress, cancel, failure + retry |
| Dashboard | List | Filters | Search, pagination, thumbnails, skeleton/empty/error |
| Compliance log | Sheet | — | Real data, verification ID, hash, QR, print CSS, `/verify/:id` |
| Rulebook | List | Search/tabs | Source/date/version detail, admin versions |
| Pipeline | Function skeleton, merge (dedupe/downgrade/status) | Deterministic checks (4 rules) | Frames, OCR, audio extraction, strict schema, retry, resumable steps, cost logging, auth, failure state |
| Media lifecycle | cleanup function, RPC | — | Correct paths, cron, owner check, isolation test |
| Evaluation | `eval_cases` table | — | cases.json, `npm run eval`, admin page |
| Fixtures | — | — | `backend/tests/fixtures/` (the user's Saudi clips are **not in the repo**) |
| Design bundle | — | — | `docs/design/` **does not exist** in the repo |
| Phase 5 features | `profiles.mawthooq_license_no`, `platforms` | — | Settings, archive audit, orgs, sharing, rulebook admin, verify page, notifications, quotas, legal pages |
| Phase 6 | vitest | — | E2E, CI, rate limits, audit log, observability, Lighthouse |

## 7. Blockers / inputs needed from the owner
1. `docs/design/` is missing → Phase 2 uses the token list in the prompt as the baseline (recorded in DECISIONS.md).
2. `backend/tests/fixtures/` is missing → real-clip runs can't happen until the clips are added.
3. Demo account doesn't exist on the hosted project; seeding needs `SUPABASE_SERVICE_ROLE_KEY` in
   `backend/.env` (never committed) or creating the user in the dashboard.
