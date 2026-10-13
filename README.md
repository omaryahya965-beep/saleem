# سَليم | SALEEM — Pre-Publish Compliance Checker for Saudi Creators

منصة «سَليم»: فحص الامتثال الإعلاني والنظامي للمحتوى الرقمي لصنّاع المحتوى في المملكة العربية السعودية قبل النشر وفق لوائح الهيئة العامة لتنظيم الإعلام (GCAM)، منصة موثوق، وزارة التجارة، وهيئة الغذاء والدواء (SFDA).

---

## 📁 Project Structure

```text
saleem/
├── frontend/                  # React 19 + TypeScript Client (Vite, TanStack Router)
│   ├── src/
│   │   ├── app/               # Router and Root application shell
│   │   ├── features/          # Feature screens (auth, submissions, reports, etc.)
│   │   ├── components/        # Reusable UI components and primitives
│   │   ├── lib/               # Supabase client, typed API, and utilities
│   │   ├── i18n/              # Arabic/English dictionary and localization
│   │   ├── styles/            # Tailwind CSS styling and theme tokens
│   │   └── types/             # Frontend application and Supabase DB types
│   ├── package.json           # Frontend dependencies and scripts
│   ├── vite.config.ts         # Standard Vite build configuration
│   └── .env.example           # Frontend environment template
│
├── backend/                   # Supabase Local Backend Workspace
│   ├── supabase/
│   │   ├── config.toml        # Local Supabase service definitions
│   │   ├── migrations/        # PostgreSQL DDL migrations and RLS policies
│   │   ├── seed.sql           # Regulatory rules catalog & demo seed data
│   │   └── functions/         # Edge Functions (analyze pipeline, media cleanup)
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
└── .gitignore                 # Version control exclusions
```

---

## 🛠️ Prerequisites

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **Docker Desktop**: Required to run local Supabase containers (PostgreSQL, Storage, Auth)
- **Supabase CLI**: Install via `npm install -g supabase` or use `npx supabase`

---

## 🚀 Getting Started

### 1. Backend Setup (Local Supabase)

> 💡 **Prerequisite**: Make sure **Docker Desktop** (or Podman) is running before starting Supabase containers.  
> You can use `npx supabase` without installing Supabase CLI globally, or install globally via `npm install -g supabase`.

Open a terminal and navigate to the backend directory:

```bash
cd backend

# Start local Supabase containers (Postgres, Auth, Storage, Studio)
npx supabase start

# Apply database migrations and seed regulatory rules & demo reports
npx supabase db reset

# Seed local demo user (demo@saleem.app / demo123456)
npm run seed

# Serve Supabase Edge Functions locally
npx supabase functions serve --env-file supabase/functions/.env
```

> **Studio Dashboard**: View the database UI locally at [http://localhost:54323](http://localhost:54323).  
> **API URL**: `http://127.0.0.1:54321`

---

### 2. Frontend Setup (React Application)

Open a second terminal and navigate to the frontend directory:

```bash
cd frontend

# Copy local environment template
cp .env.example .env

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port shown in your terminal) to start using SALEEM.

---

### 3. Root Monorepo Commands

You can also run commands for both workspaces directly from the repository root:

```bash
# Run dev server
npm run dev

# Run full production build
npm run build

# Run both frontend and backend tests
npm test

# Run frontend tests only
npm run test:frontend

# Run backend pipeline tests only
npm run test:backend

# Run automated end-to-end flow verification
npm run verify:backend
```

---

## 🔑 Environment Variables

### Frontend (`frontend/.env`)

```ini
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=http://127.0.0.1:54321
```

### Backend (`backend/supabase/functions/.env`)

```ini
# External AI Providers (Optional — demo mode runs automatically if omitted)
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key

# Pipeline defaults
LLM_MODEL=claude-3-5-sonnet-20241022
ASR_MODEL=whisper-1
DEMO_MODE=true
```

---

## 🔄 Regenerating TypeScript Types

Whenever you modify database tables or migrations in `backend/supabase/migrations/`:

```bash
# From repository root or backend/
npx supabase gen types typescript --local > frontend/src/types/supabase.ts
```

---

## 🧪 Testing & Verification

1. **Unit & Pipeline Tests**:
   ```bash
   npm test
   ```
2. **End-to-End Verification**:
   ```bash
   npm run verify:backend
   ```
3. **Parity Checklist**:
   Check [docs/PARITY_CHECKLIST.md](docs/PARITY_CHECKLIST.md) for detailed verification across all 11 user journeys.

---

## 🚢 Production Deployment (Hosted Supabase)

When deploying to a live Supabase project:

```bash
# 1. Link to hosted project
npx supabase link --project-ref <your-project-id>

# 2. Push database schema migrations
npx supabase db push

# 3. Set remote secrets
npx supabase secrets set ANTHROPIC_API_KEY=... OPENAI_API_KEY=...

# 4. Deploy Edge Functions
npx supabase functions deploy analyze
npx supabase functions deploy cleanup-media

# 5. Build and deploy frontend
cd frontend
npm run build
# Deploy dist/ to Vercel, Cloudflare Pages, or Netlify
```
