# Release plan: PR #2 (v2 + Gemini) to production — awaiting approval; nothing deployed

Updated 2026-11-19 · Source: `integrate/pr-1-gemini` · Production: Vercel `saleem-app.vercel.app` + Supabase
`oxspzxtxvtwswdjqfful`. Every production command below changes production and needs the owner's explicit go-ahead.

## 1. Production today (2026-11-18 read-only audit)

Production runs the **pre-v2 `master` build** on a v1 database (9 migrations). Analyses fail with
`code:provider_invalid_key`: the v1 build calls OpenAI with an expired key (D157, D163). The v1 bundle also ships
old demo passwords (`demo@`, `agency@`, `admin@saleem.app`) — rotate or disable those accounts at release.

## 2. Verified locally (2026-11-19)

| Check | Result |
|---|---|
| Upgrade rehearsal: `master` schema + v1 data → 34 v2 migrations with `migration up --include-all` | All applied, no errors (44 total) |
| Existing rows (submissions, findings, transcripts, compliance-log hashes) | **Byte-identical** before/after (md5 fingerprints) |
| Compliance-log seals | Same verification result before and after for every log; the v1 hash formula is preserved |
| pgTAP on the upgraded DB | 18/19 files, 269 assertions pass; the one failure is a seed-data precondition that is already false on the `master` baseline before migrating |
| Rulebook after migrating | v1 `2026.10-a` archived (rows kept), v2 `2026.11-v2` published (238 rules) |
| Live Gemini (local stack) | Text, image, video + Arabic ASR, Try Rule passed on `gemini-3.5-flash`; **`gemini-3.8-flash` not yet exercised** (D164) |

**The migrations are not purely additive** (correcting the 2026-11-18 note): they backfill existing rows (`update`
on promotions, products, rules — 44 rule-mapping updates — claims, findings, org_members), rewrite RLS policies and
revoke column grants. Data changes cannot be reversed by `backend/supabase/rollbacks/`; only a restore can.
`20261014035900` is dated before already-applied migrations, hence `--include-all` (D71).

**Compatibility gap:** after step 3 and before step 6 the live v1 frontend runs on the v2 schema (policies and
grants changed). Do steps 3–6 in one short window and announce a brief maintenance period.

## 3. Release sequence

| Step | Action | Gate |
|---|---|---|
| 0 | Gemini **billing enabled** (Free Tier = 20 requests/day/model) and a real run on `gemini-3.8-flash` passes | Owner |
| 1 | Vercel: confirm Production Branch, auto-deploy on `master`, env var names per environment | Owner (dashboard or `vercel project inspect saleem`) |
| 2 | Backup: Supabase dashboard → confirm a recent daily backup/PITR **and** `npx supabase db dump --linked -f backups/pre-v2.sql` (+ `--data-only` dump) | Stop if either fails |
| 3 | `npx supabase migration list --linked --workdir backend` → expect exactly the 35 v2 migrations pending; then `npx supabase db push --include-all --workdir backend` | Compare list first |
| 4 | Secrets (names only): `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.8-flash`, optional `GEMINI_THINKING_LEVEL=LOW`, `APP_URL`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `ANALYZE_RATE_LIMIT_PER_HOUR`. Remove `OPENAI_API_KEY`, `LLM_PROVIDER`, `TRANSCRIPTION_PROVIDER` (ignored now). **Never `DEMO_MODE` on production.** | `supabase secrets list --linked` shows names |
| 5 | Functions: `analyze`, `diagnostics`, `ask`, `internal-rules-draft`, `api`, `review-notify`, `webhooks-deliver`, `cleanup-media`, `account`. **Do not deploy `demo-login` to production.** | All return non-404 |
| 6 | Frontend: merge PR #2 (Vercel builds `master` if auto-deploy is on) with production `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; **no `VITE_DEMO_LOGIN`** (opt-in since 2026-11-19) | Build green |
| 7 | Smoke: sign in; text ad → done with findings; image; short Arabic video (transcript + timestamps); Try Rule; `/verify/<id>` shows authentic; `/rules` shows drafts as drafts; no demo cards on `/login`; admin AI card shows model, tokens, cost | Each passes |
| 8 | Monitor 24 h: `pipeline_failed` codes (`insufficient_quota`, `rate_limited`, `provider_down`), token use and cost per run | — |

## 4. Rollback

1. Frontend: Vercel "Promote" the previous production deployment (instant).
2. Functions: redeploy them from the previous `master` commit.
3. Database: schema rollbacks in `backend/supabase/rollbacks/` cover structure only; backfilled rows and enum values
   need the step-2 dump/PITR restore. A restore loses rows written after step 3 — keep the window short.

## 5. Public demo

A separate Supabase project with `DEMO_MODE=true` + `npm run demo:seed`, and a separate Vercel deployment with
`VITE_DEMO_LOGIN=true`. Never on the production project.
