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
