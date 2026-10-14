# سَليم | SALEEM — افحص قبل أن تنشر

Pre-publish compliance checker for Saudi creators, agencies and brands. Upload a short video, image or
text before publishing; SALEEM analyses Saudi-dialect speech, frames, on-screen text and caption against
an illustrative rulebook (Mawthooq, media content rules, AI disclosure, consumer-protection ad rules) and
returns timed findings with sources and suggested fixes, a re-check flow, and a verifiable compliance log.

> تنبيهات استرشادية وليست موافقة رسمية. القرار النهائي لك. — Rules are illustrative and pending legal review.

## Run it (≤ 10 commands)

Prerequisites: Node 22, a Supabase project (hosted), an OpenAI API key.

```bash
npm ci                                                        # 1  install
cp backend/.env.example backend/.env                          # 2  then fill VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
cp backend/supabase/functions/.env.example backend/supabase/functions/.env   # 3  then fill OPENAI_API_KEY
npx supabase login && npx supabase link --project-ref <ref> --workdir backend   # 4  link
npx supabase db push --workdir backend                        # 5  migrations (schema, RLS, rulebook, cron)
npx supabase secrets set --env-file backend/supabase/functions/.env --workdir backend   # 6  function secrets
npx supabase functions deploy analyze account --workdir backend && npx supabase functions deploy cleanup-media --no-verify-jwt --workdir backend   # 7  functions
npm run dev                                                   # 8  http://localhost:3000
npm test && npm --workspace frontend run e2e                  # 9  unit + E2E (AR/EN, desktop/mobile)
```

Seed demo data (rulebook + sample reports) is in `backend/supabase/seed.sql`; the demo login
(`demo@saleem.app`) is created with `npm run seed:backend` (needs `SUPABASE_SERVICE_ROLE_KEY` in your
shell, never committed) or in the dashboard. Grant an admin with
`insert into user_roles (user_id, role) values ('<uuid>', 'admin');`.

## Useful scripts

| Command | What |
|---|---|
| `npm run dev` / `npm run build` | Vite dev server / production build + prerender of public pages |
| `npm run lint`, `npm test` | ESLint + Prettier, Vitest (frontend + backend) |
| `npm --workspace frontend run e2e` | Playwright E2E (Arabic + English, desktop + mobile) |
| `npm --workspace backend run eval` | accuracy evaluation on `backend/eval/cases.json` (live model) |
| `npm --workspace backend run clips` | run real clips from `backend/tests/fixtures/` end-to-end → `docs/demo/CLIPS.md` |
| `npm --workspace backend run smoke` | live provider smoke test (TTS → ASR → vision → merge) |

## Layout

```text
frontend/   React 19 + TypeScript SPA — Vite, TanStack Router/Query, Tailwind v4
  src/components/ui   design-system primitives (see /styleguide in dev)
  src/features/       screens (reports, submissions, archive, org, share, verify, admin, legal…)
  src/i18n/           ar.json (source of truth) + en.json, typed keys, plural rules
  src/lib/            Supabase data layer, browser media extraction, telemetry
  e2e/                Playwright specs
backend/
  supabase/migrations  schema, RLS, RPCs, cron (additive migrations)
  supabase/functions   analyze (pipeline), cleanup-media (cron + owner), account (deletion)
  supabase/functions/_shared   providers (OpenAI; Gemini/Anthropic disabled), deterministic Arabic rules, schema, merge, cost
  eval/                evaluation harness, clip runner, provider smoke test
  tests/               Vitest unit tests (Arabic fixtures) + live isolation tests
docs/       AUDIT, DECISIONS, PROGRESS, DESIGN_SYSTEM, OPERATIONS, FINAL_REPORT, screenshots
scripts/    screenshot, prerender, mock-auth, synthetic fixtures
```

## Docs

- `docs/FINAL_REPORT.md` — what was built, evidence, open issues, manual steps
- `docs/DECISIONS.md` — every decision with reasons and alternatives
- `docs/OPERATIONS.md` — environments, hosting, secrets, cron, backups, observability, data residency
- `docs/DESIGN_SYSTEM.md` — tokens, contrast, type, primitives
