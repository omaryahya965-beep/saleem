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
