# SALEEM — Cleanup & Restructuring Plan

> Generated during **Phase 0 – Audit (no changes)**.  
> Branch: `cleanup-structure`

---

## 1. Inventory of Every Legacy Platform Trace

We conducted a case-insensitive audit across every file, hidden directory, lockfile, and config in the repository for proprietary generator tokens:
`l-o-v-a-b-l-e`, `g-p-t-e-n-g-i-n-e-e-r`, `g-p-t-e-n-g`, taggers, and associated legacy endpoints.

### 1.1 Package Dependencies & Scripts (`package.json`)

- **Dependency**: Legacy `@vite-tanstack-config` plugin in `devDependencies`.
  - _Action_: Remove package dependency; replace with standard `@vitejs/plugin-react`, `@tanstack/router-plugin`, and `tailwindcss` in `vite.config.ts`.
- **Overrides**: `"rolldown": "1.2.1"` (Legacy-injected build override).
  - _Action_: Remove override.

### 1.2 Vite Configuration (`vite.config.ts`)

- **Plugin import & wrapper**:
  - Legacy configuration wrapper.
  - _Action_: Replace with standard `defineConfig` from `vite` using `@vitejs/plugin-react`, `@tanstack/router-plugin/vite`, and `@tailwindcss/vite`.

### 1.3 HTML & Meta Tags (`src/routes/__root.tsx`)

- Line 14: Error telemetry reporting import.
- Line 42: Error reporting invocation.
- Line 88: Third-party twitter tag.
  - _Action_:
    - Replace twitter tag with `{ name: "twitter:site", content: "@SaleemApp" }`.
    - Remove proprietary error reporting import and calls.
    - Ensure title «سَليم | SALEEM», description in Arabic, and `lang="ar"` `dir="rtl"` are retained.

### 1.4 Runtime Files & Error Telemetry

- **`src/lib/error-reporting (legacy)`**:
  - Contains proprietary window telemetry hooks.
  - _Action_: Delete file completely. Replace error boundary reporting with standard `console.error`.
- **`src/integrations/supabase/previewAuthStorage.ts`**:
  - Contains iframe postMessage communication to legacy preview zones.
  - _Action_: Delete file completely.
- **`src/integrations/supabase/cron-auth.ts`**:
  - References legacy cron secrets.
  - _Action_: Delete file completely.

### 1.5 Drizzle & Cloud DB Config

- **`drizzle.config.ts`**:
  - References legacy cloud migration URL.
- **`drizzle/schema.ts`** and **`drizzle/migrations/0000_migration.sql`**:
  - Created specifically for legacy cloud database synchronization.
  - _Action_: Delete `drizzle.config.ts` and `drizzle/` directory (schema is fully codified in `supabase/migrations/`).

### 1.6 Hidden Directories & Sync Notes

- **`.legacy-config/`**:
  - `plan.md` & `project.json`: Legacy platform project metadata.
  - _Action_: Delete directory completely.
- **`AGENTS.md`**:
  - Contains legacy platform sync notices.
  - _Action_: Replaced with clean SALEEM project guidelines.

### 1.7 Package Manager Files

- **`bunfig.toml`** & **`bun.lock`**:
  - Contains cache URLs pointing to legacy preview registries.
  - _Action_: Delete `bunfig.toml` and `bun.lock`. Standardize exclusively on `npm` and `package-lock.json`.

---

## 2. Leftover Backend & Server Code That No Longer Runs

The app originally contained TanStack Start Nitro SSR server entrypoints and service-role SDK files that are no longer used since migrating to local Supabase and Edge Functions:

| File                                           | Original Purpose in Legacy Stack                           | Current Status                                                         | Verdict    |
| :--------------------------------------------- | :--------------------------------------------------------- | :--------------------------------------------------------------------- | :--------- |
| `src/server.ts`                                | Nitro/h3 SSR server entry wrapper with error normalization | Unused (app runs as Vite SPA/client with Edge Functions)               | **Delete** |
| `src/start.ts`                                 | TanStack Start SSR middleware registry                     | Unused (middleware now in Edge Functions and frontend client)          | **Delete** |
| `src/lib/error-capture.ts`                     | Global console/error hook for Nitro server                 | Unused                                                                 | **Delete** |
| `src/lib/error-page.ts`                        | Static HTML error template for SSR 500 responses           | Unused                                                                 | **Delete** |
| `src/integrations/supabase/client.server.ts`   | Server-side Supabase client with service role key          | Unused in frontend bundle (Edge Functions have their own admin client) | **Delete** |
| `src/integrations/supabase/auth-middleware.ts` | Server-side RPC authentication middleware                  | Unused                                                                 | **Delete** |
| `src/integrations/supabase/auth-attacher.ts`   | Client middleware attaching JWT to server functions        | Unused                                                                 | **Delete** |

---

## 3. Unused Components, Assets & Dependencies Audit

### 3.1 Unused Files in `src/components/ui/`

The project includes 46 shadcn/ui components:

- **Audit Result**: `src/routes/index.tsx` does not import any component from `src/components/ui/`. The UI was implemented directly using semantic HTML and custom CSS classes defined in `src/styles.css`.
- **Verdict**:
  - Keep essential UI primitives that align with future extensions (`button.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `progress.tsx`, `select.tsx`, `tabs.tsx`, `textarea.tsx`, `tooltip.tsx`).
  - Delete unused complex components (`calendar`, `chart`, `drawer`, `menubar`, `sidebar`, `carousel`, `context-menu`, `resizable`, `input-otp`).

### 3.2 Unused Dependencies Audit (`depcheck` & `knip`)

Dependencies identified as unused:

- `@hookform/resolvers`: Unused (form handling is state-driven).
- `date-fns`: Unused (dates formatted with native Intl or static strings).
- `zod`: Unused in frontend bundle (Edge Functions use TypeScript interfaces).
- `drizzle-orm`, `drizzle-kit`, `postgres`: Unused (schema managed by Supabase migrations).
- `tw-animate-css`: Unused.
- `embla-carousel-react`: Unused.
- `recharts`: Unused.
- `cmdk`: Unused.

**Recommendation**: Remove confirmed unused dependencies in Phase 3 after confirming `npm run build` succeeds.

---

## 4. Package Manager Duplicates

- **Found**:
  - `package.json`
  - `bun.lock`
  - `bunfig.toml`
- **Recommendation**:
  - Keep **`npm`** as the single, authoritative package manager.
  - Delete `bun.lock` and `bunfig.toml`.
  - Use `package-lock.json` generated by `npm install`.

---

## 5. Secrets Audit (Current Tree & Git History)

We inspected all commits in git history for committed secrets:

1. **Initial Commit (`bad9512`)**:
   - Committed `.env` containing legacy anon key and project ID.
   - **No private service keys, Anthropic keys, OpenAI keys, or database passwords were ever committed.**
2. **Current Tree**:
   - `.env` and `supabase/functions/.env` contain only local development placeholders (`http://127.0.0.1:54321`, `local-anon-key-placeholder`).
   - `.gitignore` properly excludes `.env`, `.env.*.local`, and keys.

---

## 6. Proposed Final Structure & File Move Map

### 6.1 Target Directory Layout

```text
saleem/
  frontend/
    index.html
    package.json
    vite.config.ts
    tsconfig.json
    .env.example
    public/
      favicon.ico
      robots.txt
    src/
      app/
        root.tsx
        router.tsx
      features/
        auth/
          Login.tsx
        submissions/
          NewCheck.tsx
          Processing.tsx
          Dashboard.tsx
        reports/
          Report.tsx
          ReadyReport.tsx
          VideoPlayer.tsx
        rulebook/
          Rulebook.tsx
        compliance-log/
          Log.tsx
        landing/
          Landing.tsx
      components/
        ui/
        Header.tsx
        StatusChip.tsx
        Disclaimer.tsx
      lib/
        supabase.ts
        api/
          client.ts
          types.ts
        utils.ts
        media.ts
      hooks/
        use-mobile.tsx
      i18n/
        index.tsx
      styles/
        globals.css
      types/
        supabase.ts
        app.ts
  backend/
    supabase/
      config.toml
      migrations/
        20261013000000_saleem_schema.sql
      seed.sql
      functions/
        _shared/
          providers/
          rules/
          pipeline/
          types.ts
        analyze/
          index.ts
        cleanup-media/
          index.ts
        .env.example
    scripts/
      seed-demo-user.ts
    tests/
      pipeline.test.ts
      verify-flow.ts
  docs/
    ARCHITECTURE.md
    CLEANUP_PLAN.md
    CLEANUP_REPORT.md
    PARITY_CHECKLIST.md
  README.md
  .gitignore
  .editorconfig
```

### 6.2 Detailed File-by-File Move Map

| Current Path                                      | Planned Action | Target Path                                                 | Rationale                           |
| :------------------------------------------------ | :------------: | :---------------------------------------------------------- | :---------------------------------- |
| `supabase/config.toml`                            |    `git mv`    | `backend/supabase/config.toml`                              | Backend structure                   |
| `supabase/migrations/*`                           |    `git mv`    | `backend/supabase/migrations/*`                             | Backend migrations                  |
| `supabase/seed.sql`                               |    `git mv`    | `backend/supabase/seed.sql`                                 | Backend seed                        |
| `supabase/functions/*`                            |    `git mv`    | `backend/supabase/functions/*`                              | Backend Edge Functions              |
| `scripts/seed-demo-user.ts`                       |    `git mv`    | `backend/scripts/seed-demo-user.ts`                         | Backend provisioning                |
| `scripts/verify-flow.ts`                          |    `git mv`    | `backend/tests/verify-flow.ts`                              | Backend end-to-end test             |
| `src/test/pipeline.test.ts`                       |    `git mv`    | `backend/tests/pipeline.test.ts`                            | Backend pipeline unit tests         |
| `src/integrations/supabase/types.ts`              |    `git mv`    | `frontend/src/types/supabase.ts`                            | Generated frontend types            |
| `src/integrations/supabase/client.ts`             |    `git mv`    | `frontend/src/lib/supabase.ts`                              | Frontend Supabase client            |
| `src/lib/api/*`                                   |    `git mv`    | `frontend/src/lib/api/*`                                    | Frontend data API                   |
| `src/lib/utils.ts`                                |    `git mv`    | `frontend/src/lib/utils.ts`                                 | Classname utilities                 |
| `src/lib/i18n.tsx`                                |    `git mv`    | `frontend/src/i18n/index.tsx`                               | Arabic/English dictionary           |
| `src/hooks/use-mobile.tsx`                        |    `git mv`    | `frontend/src/hooks/use-mobile.tsx`                         | Media query hook                    |
| `src/styles.css`                                  |    `git mv`    | `frontend/src/styles/globals.css`                           | Global styling & tokens             |
| `src/routes/__root.tsx`                           |    `git mv`    | `frontend/src/app/root.tsx`                                 | Cleaned app root shell              |
| `src/router.tsx`                                  |    `git mv`    | `frontend/src/app/router.tsx`                               | Router initialization               |
| `src/routes/index.tsx`                            |    Refactor    | `frontend/src/routes/index.tsx` + `frontend/src/features/*` | Feature-based screen organization   |
| `public/*`                                        |    `git mv`    | `frontend/public/*`                                         | Static assets                       |
| `package.json`                                    |  Move & clean  | `frontend/package.json`                                     | Frontend package configuration      |
| `vite.config.ts`                                  |  Move & clean  | `frontend/vite.config.ts`                                   | Standard Vite configuration         |
| `tsconfig.json`                                   | Move & update  | `frontend/tsconfig.json`                                    | TypeScript configuration            |
| `.env.example`                                    |      Move      | `frontend/.env.example`                                     | Frontend environment template       |
| `.legacy-config/*`                                |     Delete     | _Deleted_                                                   | Proprietary legacy config           |
| `AGENTS.md`                                       |  Clean/Update  | `AGENTS.md`                                                 | Remove legacy sync warnings         |
| `bun.lock`                                        |     Delete     | _Deleted_                                                   | Duplicate lockfile                  |
| `bunfig.toml`                                     |     Delete     | _Deleted_                                                   | Bun config with legacy registries   |
| `drizzle.config.ts`                               |     Delete     | _Deleted_                                                   | Dead cloud Drizzle config           |
| `drizzle/*`                                       |     Delete     | _Deleted_                                                   | Replaced by Supabase migrations     |
| `src/lib/legacy-error-reporting.ts`               |     Delete     | _Deleted_                                                   | Proprietary telemetry               |
| `src/integrations/supabase/previewAuthStorage.ts` |     Delete     | _Deleted_                                                   | Proprietary iframe auth             |
| `src/integrations/supabase/cron-auth.ts`          |     Delete     | _Deleted_                                                   | Unused legacy cron auth             |
| `src/integrations/supabase/auth-middleware.ts`    |     Delete     | _Deleted_                                                   | Unused SSR middleware               |
| `src/integrations/supabase/auth-attacher.ts`      |     Delete     | _Deleted_                                                   | Unused SSR middleware               |
| `src/integrations/supabase/client.server.ts`      |     Delete     | _Deleted_                                                   | Unused server client                |
| `src/server.ts`                                   |     Delete     | _Deleted_                                                   | Unused Nitro SSR server wrapper     |
| `src/start.ts`                                    |     Delete     | _Deleted_                                                   | Unused TanStack Start server config |
| `src/lib/error-capture.ts`                        |     Delete     | _Deleted_                                                   | Unused SSR error capture            |
| `src/lib/error-page.ts`                           |     Delete     | _Deleted_                                                   | Unused SSR static error HTML        |
