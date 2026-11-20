# SALEEM V2 — Production Deployment & Verification Report

**Deployment Date & Time**: 2026-11-20 17:08 (UTC+2)  
**Live Production URL**: [https://saleem-app.vercel.app](https://saleem-app.vercel.app)  
**Target Backend Project**: `oxspzxtxvtwswdjqfful` (Supabase Production)  
**Production Git Branch**: `master` (synchronized with `origin/master`)

---

## 1. GitHub Status & Merge

- **Integration Branch**: `integrate/pr-1-gemini` (preserved and intact; not deleted).
- **Merge Method**: Fast-forward merge (`git merge integrate/pr-1-gemini --ff-only`).
- **Contributor Attribution**: 100% preserved, including all original commits and PR #1 contributions.
- **Push Status**: Both `integrate/pr-1-gemini` and `master` pushed to `origin`.
- **Final Commit Hash on Master**: `5ed177b`  
  *Message*: `build(functions): add shared deno.json for npm imports resolution`  
  *Head commit of features*: `fefa120` (`docs: V2 upgrade checklist, decisions D170-D185...`)

---

## 2. Supabase Production Database

- **Target Project**: `oxspzxtxvtwswdjqfful` (`saleem` · production in `ap-southeast-2`).
- **Pre-Migration Backups**:
  - `C:\Users\CS NET GAMES\Downloads\saleem\saleem-backups\saleem_data_backup_20261120_164847.sql` (319 KB)
  - `C:\Users\CS NET GAMES\Downloads\saleem\saleem-backups\saleem_schema_backup_20261120.sql` (85 KB)
- **Migrations Status**:
  - Total migrations: **48** (9 initial + 39 V2 migrations).
  - All 39 pending migrations applied with zero errors via `npx supabase db push --remote --include-all`.
  - Verified remote migration table (`npx supabase migration list --remote`) matches local files with zero discrepancy.
- **Data Integrity**: Existing database records remained completely intact; historical submissions were safely backfilled into `promotions` containers.

---

## 3. Supabase Edge Functions & Secrets

- **Deployed Functions (11/11 Active)**:
  1. `account`
  2. `analyze` (Gemini provider engine with structured JSON validation)
  3. `api`
  4. `ask`
  5. `cleanup-media`
  6. `demo-login` (one-click broker for 9 roles)
  7. `diagnostics`
  8. `fix` (SALEEM Fix AI correction planning)
  9. `internal-rules-draft`
  10. `review-notify`
  11. `webhooks-deliver`
- **Edge Function Secrets Configured**:
  - `GEMINI_API_KEY`: Verified active.
  - `GEMINI_MODEL`: `gemini-3.5-flash` (tested and functional with the API key).
  - `GEMINI_FALLBACK_MODEL`: `gemini-3.1-flash-lite` (tested and functional).
  - `DEMO_MODE`: `true`
  - `DEMO_RATE_PER_HOUR`: `500`
  - `LLM_PROVIDER`: `gemini`
  - `TRANSCRIPTION_PROVIDER`: `gemini`
- **Security Safeguards**:
  - Demo authentication strictly confined to registered sandbox organizations (`demo_sandbox_orgs`).
  - Separation of duties enforced in database RPC (`decide_promotion`).
  - Self-approval disabled by default (`self_approval` org feature flag).

---

## 4. Vercel Production Deployment

- **Deployment ID**: `saleem-2sd2gee7m`
- **Status**: ● Ready (Build duration: 20s)
- **Production Alias**: https://saleem-app.vercel.app
- **Environment Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DEMO_MODE` verified configured.
- **Routing & Headers**: SPA rewrites to `/spa.html`, immutable caching for assets, security headers active (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).

---

## 5. Live Production Verification & Smoke Test Results

All smoke tests executed against the live website passed:

| Area | Check | Live Result |
|------|-------|-------------|
| **Public Landing** | Headline «من الإعلان إلى الاعتماد، في مساحة عمل واحدة», RTL direction, CTA | **PASS (HTTP 200)** |
| **Nada Cream Sample** | `/sample` interactive report with 6 consolidated findings, facts, seek sync | **PASS (HTTP 200)** |
| **Video Assets** | `/sample/nada-cream-v1.mp4` (2.8 MB, original violations) | **PASS (HTTP 200)** |
| **Video Assets** | `/sample/nada-cream-v2.mp4` (456 KB, corrected version) | **PASS (HTTP 200)** |
| **Demo Login Broker** | One-click magic link session generation for 9 personas | **PASS (HTTP 200)** |
| **Attacker Mitigation** | Unauthorized persona request to `demo-login` rejected | **PASS (HTTP 400)** |
| **Version Comparison** | Version diff summary tab and side-by-side comparison | **PASS** |
| **New Advertisement** | Multi-step wizard with sector-specific fields | **PASS** |
| **Review Queue** | Role-gated review list and conditional approval flow | **PASS** |
| **Automated Suite** | Playwright test suites (public, promotions, signed-in) | **17/17 PASSED** |

---

## 6. Known Limitations & Remaining Requirements

1. **SALEEM Fix (Video Generation Provider)**: The UI and workflow for text/script correction are complete and functional; automated video generation / media re-rendering is intentionally stubbed with «يتطلب إعداداً» pending external video provider integration.
2. **SAMA/CMA Rule Activation**: The 187 imported draft rules are present in the catalog in `draft` review state (`review_state = 'draft'`), awaiting manual legal review and formal approval per compliance governance before entering enforcement.
3. **Mawthooq Verification Automation**: Automatic scraping of `mawthooq.sa` remains gated by official anti-bot challenges; Mawthooq licenses are verified via manual upload/entry or secondary sources.
