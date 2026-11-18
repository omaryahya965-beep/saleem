# UX pass: navigation, broken pages, demo personas, cleanup

Date: 2026-11-18 · Branch `v2/full-run`. Nothing was deployed or pushed, and no commit was squashed. Decisions:
D150–D155.

## Verified results (local Docker)

| Check | Result |
|---|---|
| Lint | 0 errors |
| Typecheck | ✓ |
| Frontend tests | 112 ✓ |
| Backend tests | 165 ✓, incl. 6 real workflows; 2 skipped (need `functions serve`) |
| `deno check` | ✓ |
| `db reset` | ✓ |
| pgTAP | 19 files ✓ |
| Build | ✓ |
| e2e | 48/48 ✓ (one full run had 2 timeouts under load, see D155) |
| Route audit (`scripts/route-audit.mjs`) | 7 personas × 19 routes |
| Persona check (`scripts/check-demo-personas.mjs`) | 5/5 ✓ |

## NOT VERIFIED
- **Real AI analysis:** the local functions env holds a model key the provider rejects (`provider_invalid_key`).
  The pipeline correctly marked the ads failed and created no findings.
- **Production:** not touched. The "backend unavailable" cause there is inferred (D151).
