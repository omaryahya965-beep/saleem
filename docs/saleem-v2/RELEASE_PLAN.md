# SALEEM V2 + AI Studio — production release plan (D210)

Prepared 2026-11-22 for the person who runs the production release. Nothing here has been run against the hosted
project. Every step marked **[hosted]** changes or reads production and needs the owner's explicit approval at the
time it is run. Everything else was verified locally on the isolated stack (`scripts/isolated-stack.mjs`, project
`saleem_iso`). The development database was never reset or written.

- Source: branch `feature/saleem-v2-completion`, compared with `origin/master` at `85716c7` (assumed to be what is
  deployed; step 1.3 confirms it).
- Hotfix: `hotfix/wizard-video-upload` (`6119624`, from master) fixes the wizard video-upload bug on its own. Merge it
  only if master has to ship **before** this branch. The branch already contains the same fix (`30ee60d`).

## 1. Before anything: fresh backup and current state

1. **[hosted]** Make a note of the latest automatic backup in the Supabase dashboard (Database → Backups), if the plan
   has backups. Then take a logical dump into a folder outside git (it contains personal data):
   ```bash
   npx supabase db dump --linked --workdir backend --role-only        -f ../saleem-backups/2026-11-XX-roles.sql
   npx supabase db dump --linked --workdir backend                    -f ../saleem-backups/2026-11-XX-schema.sql
   npx supabase db dump --linked --workdir backend --data-only --use-copy -f ../saleem-backups/2026-11-XX-data.sql
   ```
2. Storage objects (bucket `media`) are not part of the dump. No pending migration touches storage or cron (checked),
   so the objects are not at risk from this release. Copy them only if you want a full point-in-time copy.
3. **[hosted]** `npx supabase migration list --linked --workdir backend`. Expected: the remote has exactly the 48
   migrations of master, the last one being `20261120110000_v2_saleem_fix`. **If the remote differs (missing or extra
   versions), stop.** Reconcile first. The list in §2 assumes master's 48 are deployed.
4. Recommended: restore the three dump files into the isolated stack and run `npx supabase migration up --local
   --workdir .iso` on that copy. This repeats §4 on real production data, still locally.

## 2. Every pending migration (8)

Computed with `git diff --name-status origin/master..HEAD -- backend/supabase/migrations`. All 8 are new files and
none of master's files were modified. The first six come from the V2 completion work and the last two from AI Studio.

| # | Migration | What it does | Data impact | Rollback |
| - | --- | --- | --- | --- |
| 1 | `20261121100000_v2_governance_audit` | Adds 3 functions and replaces 2 (`record_lifecycle`: publication only after a final approval; self-approval defaults; demo AI counter) | None | `rollbacks/…_v2_governance_audit.down.sql` |
| 2 | `20261121110000_v2_collaboration` | Comment kinds widened, comment attachment links, `add_comment` gets an extra optional `_links` (old signature dropped), notification kinds widened, `distribution` gains `agency`, manual Mawthooq licence columns on `promotions` | 5 new columns, all `not null default` or nullable (no rewrite) | `…_v2_collaboration.down.sql` |
| 3 | `20261121120000_v2_workspace` | Adds 7 functions and replaces 1 (workspace overview, Fix monthly limit, internal-rule duplicates, approval of internal rules) | None | `…_v2_workspace.down.sql` |
| 4 | `20261121130000_v2_fix_media` | Replaces 2 SALEEM Fix functions (media corrections) | None | `…_v2_fix_media.down.sql` |
| 5 | `20261121140000_v2_fix_notifications` | Adds the `correction_job_notify` function and trigger | None | `…_v2_fix_notifications.down.sql` |
| 6 | `20261121150000_v2_rule_categories` | `internal_rules.category` (default `compliance_policy`), `internal_rule_versions.category`, 4 functions, 2 triggers | Existing rules get the default category | `…_v2_rule_categories.down.sql` |
| 7 | `20261121170000_v2_ai_studio` | New tables `studio_drafts` and `ai_usage` (RLS on, owner/admin policies), 6 functions, 3 indexes on the new tables | New tables only | `…_v2_ai_studio.down.sql` |
| 8 | `20261121180000_v2_approval_requires_analysis` | `approval_blockers` adds `analysis_not_done` | **Behaviour change**, see §3 | `…_v2_approval_requires_analysis.down.sql` |

Separately, master's three most recent migrations (`20261119110000`, `20261120100000`, `20261120110000`) have no
rollback files. That gap predates this branch and is out of scope here.

## 3. Migration safety audit

- **No destructive statements.** There is no `drop table`, `drop column`, `truncate`, column type change or `set not
  null` on existing data. No data statements run at the top level: every insert or update is inside a function body.
- **Constraint drops are re-adds with a wider set.**
  - `comments_kind_check` adds `question`, `reviewer_feedback`, `legal_opinion` and `evidence`.
  - `notifications_kind_check` adds `comment_reply` and `correction_ready`.
  - `promotions_distribution_check` adds `agency`.

  Existing rows always pass. The re-check scans `comments`, `notifications` and `promotions` under a short exclusive
  lock, so run it at low traffic.
- **New columns use constant defaults.** On PostgreSQL 11+ that is a metadata-only change, with no table rewrite.
  The new indexes are only on the new, empty tables.
- **The old frontend keeps working during the switch-over.** `add_comment`'s new `_links` parameter has a default, so
  the frontend deployed today still resolves the call by name. The new tables and columns are unused by the old code.
- **RLS:** both new tables have RLS enabled, with policies only `to authenticated`; `ai_usage` writes are revoked.
  `anon` keeps Supabase's default table grants, the same as every existing table. Probed through the REST API as
  `anon` with a row present:
  - select returns `[]`
  - insert is refused (401)
  - update and delete affect 0 rows

  The pgTAP file `p15_ai_studio.test.sql`
  covers:
  - a draft is private to its creator; another member cannot see or accept it
  - reviewers and viewers cannot create drafts
  - acceptance checks
  - quotas set by the owner
- **Regulatory rules:** no migration activates a rule or changes a rule's status. Unverified rules stay inactive.
- **Behaviour change (migration 8):** approving an advertisement now requires a completed analysis of its current
  version. Requesting changes and rejecting stay possible. Count the affected advertisements **[hosted, read-only]**
  before release and tell their reviewers:
  ```sql
  select p.id, p.title, p.review_status, s.status as current_version_status
  from public.promotions p left join public.submissions s on s.id = p.current_version_id
  where p.review_status in ('pending_review', 'in_review', 'escalated', 'reviewing_risk', 'conditionally_approved')
    and s.status is distinct from 'done';
  ```

## 4. Dry run (done on the isolated stack, 2026-11-22)

| Check | Result |
| --- | --- |
| Isolated stack reset to **master's** 48 migrations and seed, then demo data (7 promotions, 8 submissions, 12 findings, notifications) plus a comment, an internal rule and an `influencer` promotion | OK |
| `npx supabase migration up --local` (the production path, pending versions only) | 8 applied in 4.3 s, no errors |
| Data after upgrade | All rows kept. Defaults filled: `attachment_links = {}`, `category = compliance_policy`, `creator_license_status = unverified` |
| pgTAP on the upgraded database | 26 files, 278 tests, PASS |
| Upgraded schema compared with a fresh install of all 56 migrations (`pg_dump --schema-only`, public + storage, with grants and policies) | Identical: 8,776 lines, 0 differences |
| All 8 rollbacks applied newest first, then compared with master's schema | Identical, except the three widened CHECKs, which come back as `NOT VALID` on purpose (below) |
| Rollback after writing new-value data (`agency`, a `question` comment, a `correction_ready` notification, a Studio draft) | Succeeds. Those rows are kept and the Studio tables are dropped |
| Rollbacks applied to a database that never had the migrations | No-ops, no errors (idempotent) |

The rollbacks were generated from a catalog diff of each migration (`scripts/rollback-from-catalog.mjs`), then
reviewed. They restore master's function bodies and grants, and recreate the old `add_comment` signature with its
grants. Each runs in a single transaction. Narrower CHECKs come back `NOT VALID`: new rows are checked, but rows written
after the upgrade with the new values do not block the rollback.

## 5. Edge Functions

Deploy **all 12** functions. `_shared/http.ts` changed and every function imports it.

| Function | Change |
| --- | --- |
| `studio` | **New.** Gemini script and text correction for AI Studio, demo AI cap, `ai_usage` metering. `config.toml` adds `[functions.studio] verify_jwt = true` |
| `analyze` | Fails fast with `provider_not_configured` when no model is configured (no more 10-minute stuck state). Demo daily AI cap |
| `fix` | Demo daily AI cap, media correction plan |
| `demo-login` | Rate limit per hashed IP, `DEMO_IP_SALT`, client IP order (D204) |
| `internal-rules-draft` | Rule categories |
| `_shared/*` | `fix.ts`, `http.ts`, `rules/deterministic.ts`, `types.ts` changed; `studio.ts` is new |
| `account`, `api`, `ask`, `cleanup-media`, `diagnostics`, `review-notify`, `webhooks-deliver` | Unchanged code, redeployed for the shared modules |

**[hosted]** `npx supabase functions deploy --workdir backend --project-ref <ref>`. Run it after the migrations:
`studio` needs the new tables.

## 6. Server configuration (secrets) — **[hosted]** `npx supabase secrets set …`

| Secret | Value for production | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Existing key | Without it, Studio uses the free deterministic template and `analyze` returns `provider_not_configured`. Never put it in the frontend |
| `GEMINI_MODEL` | Unset (defaults to `gemini-3.8-flash`) | Confirmed by `models.list` on 2026-11-22: available, supports `generateContent`, 1,048,576 input tokens |
| `GEMINI_FALLBACK_MODEL`, `GEMINI_THINKING_LEVEL` | Optional (`LOW` default) | The fallback is only used when the primary model returns 503 |
| `DEMO_MODE` | `true` only if the public demo is wanted | Otherwise `demo-login` refuses |
| `DEMO_AI_DAILY_LIMIT` | **New.** Set explicitly. On the free tier: `5` | One shared daily cap for all demo accounts, across analyze, fix and studio. Defaults to 40 if unset, which is more than the free tier's 20 requests per model per day can serve (one video analysis is 2–3 requests) |
| `DEMO_RATE_PER_HOUR` | `10` | Demo sessions per hashed IP per hour. Defaults to 20; `SECURITY_AUDIT_V2.md` recommends 10–20 |
| `DEMO_IP_SALT` | **Required:** a random secret, e.g. `openssl rand -hex 32` | The fallback `saleem-demo` is public in the repo, which would make IP hashes reversible by brute force. Rotating it only resets the hourly counters |
| `APP_URL` | The production URL | Used in links from `analyze`, `review-notify` and `webhooks-deliver` |

- **Gemini billing:** decision D164 records the key on the free tier (20 requests/day per model). That is not enough
  for production use. Enabling billing is the owner's decision; this plan does not do it.
- **Studio providers:** the local Arabic/English voice needs no secret. Fully generated footage and virtual presenters
  have no provider configured and stay unavailable, and the public pages say so (D209).
- **Organisation AI limits:** set per organisation with `set_ai_limit` (owner/admin). Studio access is limited to
  organisation owner, admin and creator roles (`can_use_studio`).

## 7. Frontend on Vercel

- **Environment:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DEMO_MODE`. These are unchanged from
  master, with no new variables.
- **Headers (`frontend/vercel.json`):** `Permissions-Policy: camera=(), microphone=(self), geolocation=()`. The
  microphone is needed to record a voiceover. Verified in Chromium with a fake device: `microphone=()` → `NotAllowedError`, `microphone=(self)`
  → allowed. Camera and geolocation stay blocked.
- **CSP:** Vercel currently sends no CSP. `frontend/public/_headers` (Netlify/Cloudflare) carries one with
  `'wasm-unsafe-eval'` and `connect-src` for `huggingface.co`, `*.hf.co`, `cdnjs.cloudflare.com` and
  `cdn.jsdelivr.net`. The local voice downloads its Piper model (about 63 MB, cached in OPFS), the ONNX runtime and the
  phonemizer from those hosts. If a CSP is ever added to Vercel, copy that one or the voice stops working. The voiced
  text never leaves the device; only the model files are downloaded.
- **[hosted]** Deploy a preview first (`vercel` from `frontend/`), run the smoke checks in §9 on the preview URL, then
  promote it to production.

## 8. Browser media compatibility (probed 2026-11-22, Playwright engines against the production build)

| Engine | Recorder output | Canvas capture + Web Audio | OPFS | WASM | Microphone API | 1.2 s test recording |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium 156 (Chrome, Edge) | **MP4** (H.264/AAC) | yes | yes | yes | yes | 40.8 KB MP4 |
| Firefox 157 | **WebM** (no MP4 recorder) | yes | yes | yes | yes | 25.2 KB WebM |
| WebKit 27.2 (Playwright build for Windows) | none | no | no | yes | no | the app shows `recorder_unsupported` |

- Firefox output is WebM. Upload, the `media` bucket and analysis accept it, but platforms such as Snapchat and TikTok
  expect MP4. Recommend Chrome or Edge for producing final files.
- Real Safari (macOS and iOS) was **not** tested. The Windows WebKit build is not Safari. Check Studio rendering and
  the voiceover by hand on Safari before claiming Safari support.

## 9. Release sequence

1. Approve and merge the PR into master (optionally the hotfix first, see the top).
2. Freeze changes. Take the backup and migration list (§1). Run the pre-flight query (§3).
3. **[hosted]** `npx supabase db push --workdir backend`. Then `migration list --linked` must show 56 migrations.
4. **[hosted]** Set the secrets (§6).
5. **[hosted]** Deploy the functions (§5).
6. **[hosted]** Vercel preview, then smoke checks, then promote.
7. Smoke checks on production:
   - sign in
   - **upload a video through the four-step wizard** (the D208 bug) and confirm it lands on `/checks/…`
   - an analysis finishes, or fails at once with `provider_not_configured`
   - Studio: a template script, a local voice and an MP4 saved as a draft
   - a partner uploads a version of their own advertisement
   - approving an unanalysed version is blocked
   - demo login is refused after `DEMO_RATE_PER_HOUR`
8. Watch function logs, the `ai_usage` table and Gemini quota for the first day.

## 10. Rollback (reverse order: frontend, then functions, then database)

1. **Frontend:** use Vercel instant rollback to the previous production deployment. This is safe on its own: the old
   frontend works with the new schema (§3), so try it first.
2. **Functions [hosted]:** check out `origin/master` in a separate worktree and run `npx supabase functions deploy`
   from it. `studio` can stay; nothing in the old frontend calls it. Or remove it with `npx supabase functions delete
   studio`.
3. **Database (only if needed) [hosted]:**
   - Export `studio_drafts`, `ai_usage` and the new columns (`promotions.creator_license_*`,
     `comments.attachment_links`, `internal_rules.category`). The rollback drops them.
   - Run the 8 `backend/supabase/rollbacks/2026112118…` → `…100000` files **newest first** in the SQL editor or psql.
   - Then `npx supabase migration repair --status reverted <version> --linked` for each of the 8 versions.
4. **Last resort:** restore the §1 backup (or point-in-time recovery if the plan has it).

## 11. Readiness and open items

| Item | Status |
| --- | --- |
| Code, tests, schema upgrade and rollback | Ready: verified locally (§4) |
| Hosted migration state | Not verified. Needs `migration list --linked` (§1.3) |
| Live Gemini journeys (Studio script, correction of the original Nada video, re-analysis) | **Not run.** Waiting on confirmation that the Google project has no billing account linked (free tier) |
| Gemini capacity for production | Blocker: the free tier is 20 requests/day per model. A billing decision is needed (owner) |
| `DEMO_IP_SALT`, `DEMO_AI_DAILY_LIMIT`, `DEMO_RATE_PER_HOUR` | Must be set before enabling the demo (§6) |
| Safari | Not verified (§8) |
| Rollback files for master's three latest migrations | Missing; predates this branch |
