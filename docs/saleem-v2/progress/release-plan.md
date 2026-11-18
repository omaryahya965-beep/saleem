# Release plan: PR #1 + v2 to production (awaiting your approval; nothing deployed)

Date: 2026-11-18 · Source branch: `integrate/pr-1-gemini` (built on `v2/full-run`) · Production: Vercel
`saleem-app.vercel.app` + Supabase `oxspzxtxvtwswdjqfful`.

## 1. What production is today (read-only audit, verified)

| Area | Finding | How it was verified |
|---|---|---|
| Frontend | The **pre-v2 master build**: no promotions, rule packs, roles or company rules | Fetched all 91 JS chunks |
| Bundle | **Ships the old demo passwords publicly** (`demo@`, `agency@`, `admin@saleem.app`) | Strings found in the live bundle |
| Database | v1 schema; every v2 table returns `PGRST205` | Anonymous REST probes |
| v1 tables | rules, rulebook, sample reports and plans respond 200 | Anonymous REST probes |
| Functions | v1 set (`analyze`, `account`, `diagnostics`, `cleanup-media`); the 7 v2 functions return 404 | Unauthenticated POST to each function |
| **Root cause of live failures** | **Analysis fails with `code:provider_invalid_key`.** The last real analysis (2026-11-17) failed; every October analysis succeeded. The production AI key is invalid. The same key in the local env returns OpenAI **401 `expired_secret_key`**. | Read with the publicly listed demo account; nothing written |

The earlier hypothesis ("the v2 frontend calls missing tables") was **wrong**: production runs a consistent v1 frontend
on a v1 database.

## 2. Minimal repair (fixes the live failure without the v2 release)

1. Set a valid AI key as a production secret. Either:
   - `OPENAI_API_KEY` (new, not expired), or
   - `GEMINI_API_KEY` with `LLM_PROVIDER=gemini` and `TRANSCRIPTION_PROVIDER=gemini`. These only work after the v2
     functions from PR #1 are deployed.
2. Rotate or disable the three public demo accounts. Their passwords are in the live bundle.

Both steps change production, so they need your go-ahead. The key itself must come from you.

## 3. Full release (v2 + PR #1 + demo), in order

| Step | Action | Notes |
|---|---|---|
| 0 | Backup: `supabase db dump --linked` → `backups/` (git-ignored) | Stop if it fails |
| 1 | Show pending: `supabase migration list --linked` | Expected: the 35 migrations below; compare before pushing |
| 2 | `supabase db push` | 35 additive migrations, `20261014035900` … `20261118081000`. No existing migration modified. Rollbacks in `backend/supabase/rollbacks/` (25 files); enum values cannot be removed. |
| 3 | Deploy functions | Changed: `analyze`, `diagnostics`. New: `api`, `ask`, `demo-login`, `internal-rules-draft`, `review-notify`, `webhooks-deliver` |
| 4 | Secrets (names only) | `GEMINI_API_KEY` or `OPENAI_API_KEY`, `LLM_PROVIDER`, `TRANSCRIPTION_PROVIDER`, `GEMINI_MODEL` (optional), `EMAIL_*`, `APP_URL`. **Do NOT set `DEMO_MODE` on production.** |
| 5 | Frontend | Vercel build with production `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. **No `VITE_DEMO_LOGIN` on production.** |
| 6 | Smoke | Sign in; text promotion → analysis done; submit → review → decision chain verifies; `/rules` shows drafts as drafts; no demo cards on `/login`; `demo-login` returns 404 |
| 7 | Rollback | Vercel "promote previous deployment"; functions: redeploy the previous commit; DB: restore the dump (last resort) |

**Public demo:** use a separate Supabase project with `DEMO_MODE=true`, `npm run demo:seed`, and a separate Vercel
deployment with `VITE_DEMO_LOGIN=true`. It must never be enabled on the production project.

## 4. Risks
- Live AI is **NOT VERIFIED**: no valid key exists in this environment, for either Gemini or OpenAI.
- PR #1 makes Gemini the default provider. A production deploy without `GEMINI_API_KEY` and without
  `LLM_PROVIDER=openai` would make analysis fail until the key is set.
- The production migration history was not compared directly, because `--linked` needs your approval. Step 1 must
  confirm it.
