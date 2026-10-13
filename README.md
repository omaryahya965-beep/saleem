# «سَليم | SALEEM» — Pre-Publish Compliance Checker for Saudi Creators

منصة «سَليم»: فحص الامتثال الإعلاني والنظامي للمحتوى الرقمي لصنّاع المحتوى في المملكة العربية السعودية قبل النشر.

---

## ⚡ Quickstart (Fresh Machine in ≤ 10 Commands)

Run these commands from the repository root:

```bash
# 1. Copy environment variable templates
cp .env.example .env
cp supabase/functions/.env.example supabase/functions/.env

# 2. Start local Supabase containers (PostgreSQL, Auth, Storage, Studio)
npx supabase start

# 3. Apply schema migrations and seed rulebook + demo reports
npx supabase db reset

# 4. Provision local demo user (demo@saleem.app / demo123456)
npx tsx scripts/seed-demo-user.ts

# 5. Serve Supabase Edge Functions locally
npx supabase functions serve --env-file supabase/functions/.env

# 6. Install frontend dependencies & launch Vite dev server
npm install
npm run dev

# 7. Run automated end-to-end verification tests
npx tsx scripts/verify-flow.ts
```

Open [http://localhost:3000](http://localhost:3000) (or the port displayed in terminal) to interact with SALEEM.

---

## Architecture & Technology Stack

- **Frontend**: React 19, TypeScript, TanStack Router & Query, Tailwind CSS, Lucide icons, shadcn/ui.
- **Backend & Database**: Local Supabase (`PostgreSQL 17`, GoTrue Auth, Storage API, Realtime).
- **Edge Functions & AI Pipeline**: Deno/TypeScript in `supabase/functions/`:
  - `analyze`: Resumable pipeline orchestrating audio transcription, deterministic checks, and multi-modal LLM reasoning.
  - `cleanup-media`: 24-hour scheduled media deletion and on-demand user media removal preserving findings, transcripts, and cryptographic hashes.
- **Direct AI Providers**:
  - LLM: Anthropic Claude (`claude-3-5-sonnet-20241022` default) & OpenAI (`gpt-4o`).
  - ASR: OpenAI Whisper (`whisper-1`).
  - Zero-config demo fallback when API keys are omitted.

---

## Local URLs & Services

Once `npx supabase start` is running:
- **Application Web UI**: [http://localhost:3000](http://localhost:3000)
- **Supabase Studio Dashboard**: [http://localhost:54323](http://localhost:54323)
- **API URL**: `http://localhost:54321`
- **PostgreSQL Connection**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **Inbucket Local Email Testing**: [http://localhost:54324](http://localhost:54324)

---

## Credentials

- **Demo User Email**: `demo@saleem.app`
- **Demo User Password**: `demo123456`
- Or click **"جرّب الحساب التجريبي"** on the login screen for instant demo access.

---

## Verification & Testing

To run the end-to-end automated verification flow testing demo reports, video timestamp seeking, new check submission, pipeline calibration, re-check flow, and printable compliance certificates:
```bash
npx tsx scripts/verify-flow.ts
```

---

## Going Online: Deploying to Hosted Supabase

When ready to publish to a hosted Supabase project:

```bash
# 1. Login to Supabase CLI
npx supabase login

# 2. Link repository to your hosted project
npx supabase link --project-ref <your-hosted-project-id>

# 3. Push database schema migrations to remote database
npx supabase db push

# 4. Set provider secrets in hosted project
npx supabase secrets set ANTHROPIC_API_KEY=your-key OPENAI_API_KEY=your-key

# 5. Deploy Edge Functions
npx supabase functions deploy analyze
npx supabase functions deploy cleanup-media

# 6. Configure hosted project storage
# Create private bucket 'media' if not already created by migrations.

# 7. Update frontend production environment variables
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your hosted project credentials.
```
