# Decisions log

Format: decision — why — alternatives considered.

## Phase 1
- **D1. Add `@playwright/test@1.64.0` (Apache-2.0) as a frontend dev dependency** — required for
  audit screenshots now and E2E in Phase 6. Alt: `npx playwright` ad-hoc (not reproducible).
- **D2. Before-screenshots of mobile nav captured via DOM `dispatchEvent`** — the legacy mobile nav is
  hidden, so real taps are impossible; documented as an audit finding rather than worked around in code.
