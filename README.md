# «سَليم | SALEEM» — Pre-Publish Compliance Checker for Saudi Creators

منصة «سَليم»: فحص الامتثال الإعلاني والنظامي للمحتوى الرقمي لصنّاع المحتوى في المملكة العربية السعودية قبل النشر.

---

## Architecture & Technology Stack

- **Frontend**: React 19, TypeScript, TanStack Router & Query, Tailwind CSS, shadcn/ui.
- **Backend & Database**: Local Supabase (`PostgreSQL 17`, GoTrue Auth, Storage API, Realtime).
- **Edge Functions & AI Pipeline**: Deno/TypeScript in `supabase/functions/` integrating Anthropic Claude (`claude-3-5-sonnet-20241022`) and OpenAI (`whisper-1` / `gpt-4o`).

---

## Local Setup & Quickstart

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v20+
- [Docker Desktop](https://www.docker.com/) (required to run local Supabase containers)
- Supabase CLI (accessible via `npx supabase`)

### 2. Start Local Supabase
From the repository root:
```bash
# 1. Start all Supabase services (PostgreSQL, Auth, Storage, Studio)
npx supabase start

# 2. Reset database and load migrations + seed data
npx supabase db reset
```

The database reset automatically executes:
- Schema migrations: `supabase/migrations/20261013000000_saleem_schema.sql`
- Rulebook & Demo seed data: `supabase/seed.sql`

### 3. Provision the Demo User Account
Run the automated provisioning script using the Supabase Admin API:
```bash
npx tsx scripts/seed-demo-user.ts
```
Default credentials:
- **Email**: `demo@saleem.app`
- **Password**: `demo123456`

### 4. Supabase Local URLs & Studio
Once `supabase start` is running:
- **Supabase Studio Dashboard**: [http://localhost:54323](http://localhost:54323)
- **API URL**: `http://localhost:54321`
- **PostgreSQL Connection**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### 5. Frontend Application Setup
```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or the port displayed in terminal) to interact with SALEEM.
