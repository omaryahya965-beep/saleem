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
