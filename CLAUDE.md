# CLAUDE.md

Read these first (do not duplicate them here):

- `AGENTS.md` — project guidelines.
- `PROJECT_GUIDE.md` — onboarding map (may be out of date; the code wins).
- `docs/saleem-v2/00_MASTER_PROMPT.md` — v2 programme rules (hard rules in §2).
- `docs/saleem-v2/PROGRESS.md` — where the v2 work stands ("Current position").
- `docs/DECISIONS.md` — decision log (continue the numbering).

## Quality gate

```bash
npm run lint
npm --workspace frontend exec tsc -- --noEmit -p .
npm test
npx --yes deno@2 check backend/supabase/functions/*/index.ts
npm run build
npx supabase db reset --workdir backend        # needs Docker
npm --workspace frontend run e2e
npm --workspace backend run eval -- --deterministic-only
```

Never run against the hosted project: no `db push`, `functions deploy`, `secrets`, `--linked`,
`--db-url`, `vercel`, or `git push` without the user's explicit approval.
