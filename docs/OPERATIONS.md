# SALEEM — Operations & deployment

Audience: whoever deploys and runs SALEEM. Everything here is a recommendation; nothing below was
purchased or signed up for.

## 1. Environments

| | Staging | Production |
|---|---|---|
| Supabase project | separate project (e.g. `saleem-staging`) | the current hosted project |
| Frontend | preview/staging site on the chosen host | `app.<domain>` |
| OpenAI key | separate key with a low monthly budget | production key with budget alerts |
| Email | `EMAIL_PROVIDER=console` | `EMAIL_PROVIDER=resend` |
| Data | synthetic + demo seed only | real users |

Promote by applying the same migrations (`npx supabase db push`) and deploying the same function code
to each project. Never point staging at production data.

## 2. Configuration per environment

Frontend (build-time, public — safe in the browser), `backend/.env`:

| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable (anon) key |
| `VITE_DEMO_MODE` | `false` in every real environment |

Edge Function secrets (`npx supabase secrets set --env-file backend/supabase/functions/.env`):

| Secret | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | yes | never in the frontend |
| `LLM_MODEL`, `LLM_PROVIDER`, `LLM_REASONING_EFFORT` | no | defaults `gpt-6.1-sol`, `openai`, `medium` |
| `TRANSCRIPTION_MODEL`, `TRANSCRIPTION_PROVIDER` | no | defaults `whisper-1`, `openai` |
| `ANALYZE_RATE_LIMIT_PER_HOUR` | no | default 30 analyses / user / hour |
| `APP_URL` | yes for email | used in email links, e.g. `https://app.saleem.sa` |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | for email | see §6 |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase into functions automatically.
The service-role key must never be placed in `backend/.env` for the frontend build or committed.

## 3. Deploying

```bash
npm ci
npx supabase link --project-ref <ref>            # once per machine
npx supabase db push                             # migrations (additive)
npx supabase functions deploy analyze account
npx supabase functions deploy cleanup-media --no-verify-jwt   # cron caller has no JWT; verified in code
npm --workspace frontend run build               # vite build + prerender → frontend/dist
```

### Frontend hosting options

| Option | Fit | Notes |
|---|---|---|
| **Vercel** | simplest | `frontend/vercel.json` included (SPA rewrite to `spa.html`, cache + security headers) |
| **Cloudflare Pages** | edge in Middle East (Jeddah/Riyadh POPs), cheap | `public/_headers` + `public/_redirects` included |
| **Netlify** | equivalent | same `_headers` / `_redirects` |
| Supabase Storage + CDN | possible | no rewrites → not recommended for an SPA |

Rewrite rule that every host needs: **real files first** (assets and prerendered `index.html` pages),
**every other path → `/spa.html`** (never the prerendered landing page).

Add the production origin to Supabase Auth → URL configuration (Site URL + redirect URLs for
`/dashboard` and `/reset-password`).

## 4. Scheduled jobs (pg_cron, in the database)

| Job | Schedule | What |
|---|---|---|
| `saleem-cleanup-media` | hourly :17 | deletes media 24 h after analysis + orphan uploads (calls `cleanup-media` with a Vault secret) |
| `saleem-fail-stuck` | every 5 min | marks checks with a stale worker heartbeat (> 10 min) as failed so users can retry |

Check runs: Supabase dashboard → Database → Cron → job runs; function logs → `cleanup_run` events.
The cron URL in migration `20261014000000` points at the current project; for another project, update
it with a new migration.

## 5. Backups & data

- Enable **Point-in-Time Recovery** on the production project (Pro plan add-on); daily backups exist by default.
- Media is intentionally ephemeral (24 h) and is not backed up.
- Restore drills: restore to a staging project quarterly; verify `/verify/:id` still validates sealed logs.
- Account deletion is self-service (Settings → Delete account); data export is self-service JSON.

## 6. Email (not configured)

Recommended: **Resend** (simple API, good deliverability, Arabic content fine). Steps:
1. Create a Resend account, verify the sending domain (SPF/DKIM DNS records).
2. `npx supabase secrets set EMAIL_PROVIDER=resend RESEND_API_KEY=... EMAIL_FROM="سَليم <no-reply@<domain>>" APP_URL=https://app.<domain>`
3. Optionally configure Supabase Auth SMTP with the same provider for confirmation/reset emails.

Alternatives: Amazon SES (cheapest at volume), Postmark. Implement another `EmailProvider` in
`backend/supabase/functions/_shared/notify.ts`.

## 7. Observability

- **Edge Functions**: one JSON log line per event (`pipeline_start`, `step_done` with ms, `pipeline_done`
  with cost, `pipeline_failed`, `schema_retry`, `transcription_fallback`, `cleanup_run`, …). Never logs
  tokens, emails or media.
- **Admin metrics page** `/admin/metrics`: checks, failures, p50/p95 duration, cost (total, per check,
  per model), daily volume, recent errors (RPC `admin_metrics`, admin-only).
- **Accuracy** `/admin/eval` + `npm --workspace backend run eval -- --upload`.
- **Audit log** `audit_events`: share links, org members/invites, organizations, roles, rulebook
  versions, submission deletion / media deletion (admin read only).
- **Client errors**: `frontend/src/lib/telemetry.ts` reports uncaught errors + route errors to the
  console. Recommended tracker: **Sentry** (`@sentry/react`, EU/US region): implement `ErrorReporter`,
  call `setErrorReporter()` in `main.tsx`, set a DSN as a public env var, scrub emails/URLs with tokens.
- **Alerts** to set up once a tracker exists: function error rate > 5 %/h, `pipeline_failed` spikes,
  OpenAI spend over budget (OpenAI dashboard usage limits), cron job failures.

### AI provider health check

`node scripts/run-diagnostics.mjs` (as an admin account) calls the admin-only `diagnostics` function, which uses the
**deployed** secret and reports only: key present / length / `sk-` prefix / whitespace, HTTP status + error type for
the models list and each configured model, and a real 2-second transcription. Run it after rotating keys or
changing models. If it reports 401, the hosted `OPENAI_API_KEY` is wrong:
`npx supabase secrets set --env-file backend/supabase/functions/.env --workdir backend` with a real key in that file.

## 8. Security checklist

- RLS on every table; results tables are service-role-write only (owners can't forge reports).
- Quotas, scoping and initial state enforced by database triggers; status changes via SECURITY DEFINER RPCs.
- Functions verify the JWT and ownership (`analyze`, `account`, owner path of `cleanup-media`); cron path
  uses a Vault-only secret.
- Rate limits: analyses/user/hour (function), brand reviews 20/link/hour (RPC).
- Headers: CSP, HSTS, frame-ancestors none (see `_headers` / `vercel.json`).
- `npm audit`: 0 known vulnerabilities at the time of writing (CI fails on high severity).
- Live RLS/storage isolation tests: `backend/tests/isolation.test.ts` — add `TEST_USER_A_*`, `TEST_USER_B_*`
  (two confirmed test accounts on staging) to `backend/.env` and run `npm --workspace backend test`.

## 9. Domain

`saleem.sa` (or `.com.sa`) via a SaudiNIC-accredited registrar; `app.` for the app, apex for marketing
(can be the same deployment — landing is prerendered). Point DNS to the chosen host, enable HTTPS,
add the origin in Supabase Auth settings and `APP_URL`.

## 10. Saudi data residency (future work)

Today: Supabase project region and OpenAI processing are outside the Kingdom (document in the privacy
policy as cross-border transfer under PDPL with safeguards). Path to in-Kingdom residency:
1. Self-host Supabase (Postgres, Auth, Storage, Edge Runtime) on a Saudi cloud region
   (e.g. a hyperscaler's Saudi region or a local provider).
2. Replace OpenAI with an in-Kingdom model endpoint behind the existing provider interface
   (`_shared/providers`) — Arabic ASR + vision model hosted locally.
3. Keep media ephemeral (24 h) and minimise data sent to any processor (frames ≤ 768 px, mono 16 kHz audio).
4. Re-run the evaluation harness on the new providers before switching.
