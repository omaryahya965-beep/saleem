# سَليم | SALEEM — Pre-Publish Compliance Checker for Saudi Creators

منصة «سَليم»: فحص الامتثال الإعلاني والنظامي للمحتوى الرقمي لصنّاع المحتوى في المملكة العربية السعودية قبل النشر وفق لوائح الهيئة العامة لتنظيم الإعلام (GCAM)، منصة موثوق، وزارة التجارة، وهيئة الغذاء والدواء (SFDA).

---

## 📁 Project Structure

```text
saleem/
├── frontend/                  # React 19 + TypeScript SPA (Vite, TanStack Router — no SSR)
│   ├── index.html             # SPA entry point (served by Vite dev server and production build)
│   ├── src/
│   │   ├── app/               # Router and Root application shell
│   │   ├── features/          # Feature screens (auth, submissions, reports, etc.)
│   │   ├── components/        # Reusable UI components and primitives
│   │   ├── lib/               # Supabase client, typed API, and utilities
│   │   ├── i18n/              # Arabic/English dictionary and localization
│   │   ├── styles/            # Tailwind CSS styling and theme tokens
│   │   └── types/             # Frontend application and Supabase DB types
│   ├── package.json           # Frontend dependencies and scripts
│   └── vite.config.ts         # Vite build configuration (envDir: "../backend")
│
├── backend/                   # Backend Workspace & Environment Center
│   ├── .env.example           # Shared app & client environment template
│   ├── supabase/
│   │   ├── config.toml        # Supabase project definitions
│   │   ├── migrations/        # PostgreSQL DDL migrations and RLS policies
│   │   ├── seed.sql           # Regulatory rules catalog & demo seed data
│   │   └── functions/         # Edge Functions (analyze pipeline, media cleanup)
│   │       └── .env.example   # Functions environment template
│   ├── scripts/               # Seed demo user credentials
│   ├── tests/                 # Pipeline calibration and verification tests
│   └── package.json           # Backend test runners and provisioning scripts
│
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md        # Technical architecture, data flow, and pipeline
│   ├── CLEANUP_PLAN.md        # Migration and cleanup plan
│   ├── CLEANUP_REPORT.md      # Record of removed files and refactorings
│   └── PARITY_CHECKLIST.md    # 33-point parity verification checklist
│
├── package.json               # Root monorepo workspace configuration
├── .editorconfig              # Code formatting rules
└── .gitignore                 # Version control exclusions (all .env files ignored)
```

---

## 🛠️ Prerequisites

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **Supabase CLI**: Runs automatically via `npx supabase`

---

## 🚀 Getting Started

### Path A: Hosted Supabase (Recommended — No Docker Required)

If using a free-tier hosted project on [supabase.com](https://supabase.com):

#### 1. Configure Backend Environment
Navigate to `backend/` and copy the environment template:
```bash
cd backend
cp .env.example .env
```
Fill in your project details in `backend/.env`:
```ini
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-or-publishable-key>
SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_DEMO_MODE=false
```

#### 2. Link Project & Push Schema
```bash
# Authenticate CLI
npx supabase login

# Link your remote project (from backend/)
npx supabase link --project-ref <your-project-ref>

# Push migrations to the hosted database
npx supabase db push
```

#### 3. Seed Rulebook Catalog
Apply the 12 regulatory rules and demo reports in your remote database via the Supabase Dashboard SQL Editor or:
```bash
npx supabase db execute --file supabase/seed.sql
```

#### 4. Configure Edge Functions & Secrets
Create `backend/supabase/functions/.env` from its template:
```bash
cp supabase/functions/.env.example supabase/functions/.env
```
Set secrets on your hosted project:
```bash
# Run from backend/
npx supabase secrets set --env-file supabase/functions/.env
```
Deploy the functions server-side via API (no Docker needed):
```bash
npx supabase functions deploy --use-api analyze
npx supabase functions deploy --use-api cleanup-media
```

#### 5. Launch the Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). Vite automatically loads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `backend/.env`.

---

### Path B: Local Supabase (Requires Docker Desktop)

If you have Docker Desktop running locally:

```bash
cd backend

# Copy environment template
cp .env.example .env

# Start local Supabase containers (Postgres, Auth, Storage, Studio)
npx supabase start

# Apply database migrations and seed regulatory rules & demo reports
npx supabase db reset

# Seed local demo user (demo@saleem.app / demo123456)
npm run seed

# Serve Supabase Edge Functions locally
npx supabase functions serve --env-file supabase/functions/.env
```

- **Studio Dashboard**: [http://localhost:54323](http://localhost:54323)
- **API URL**: `http://127.0.0.1:54321`

In a second terminal:
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Environment Variables Structure

**All environment files reside strictly inside `backend/`:**

1. **`backend/.env`** (Shared for both frontend client and backend scripts):
   - `VITE_SUPABASE_URL`: Your Supabase API URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon or publishable key.
   - `SUPABASE_URL`: Server-side API URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: *(Optional)* Service role key for admin scripts.
   - `VITE_DEMO_MODE`: `false` (default) for live Supabase, `true` for offline fixtures.

2. **`backend/supabase/functions/.env`** (Edge Functions secrets):
   - `OPENAI_API_KEY`: Key for Whisper ASR and GPT-4o analysis.
   - `TRANSCRIPTION_PROVIDER`: `openai`
   - `LLM_PROVIDER`: `openai`
   - `VIDEO_PROVIDER`: `frames`

> ⚠️ **Security**: All `.env` and `.env.*` files are strictly ignored by `.gitignore`. Never commit real secrets.

---

## 🛠️ Root Monorepo Commands

Run commands across workspaces from the repository root:

```bash
# Launch frontend dev server
npm run dev

# Run production build
npm run build

# Run test suites (frontend & backend)
npm test

# Run frontend tests only
npm run test:frontend

# Run backend pipeline tests only
npm run test:backend
```

---

## 🔄 Regenerating TypeScript Types

Whenever database tables or migrations change:

```bash
# Run from repository root or backend/
npx supabase gen types typescript --project-id <your-ref> > frontend/src/types/supabase.ts
```
