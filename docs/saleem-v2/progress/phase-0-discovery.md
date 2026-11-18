# Phase 0 — Discovery

Date: 2026-11-17 · Branch: `v2/full-run` · Base: `master` @ 323e7da

## Environment

| Check | Result |
|---|---|
| `docker info` | `docker: command not found` (no Podman either) |
| `npx supabase@2 start --workdir backend` (one attempt) | `DockerLifecycleInspectError: docker: command not found` → **no local database** |
| Supabase CLI in `node_modules` | not installed (CLI fetched by `npx --yes supabase@2`) |
| `psql` / `pg_ctl` | not on PATH |
| Deno | not installed; `npx --yes deno@2` works (deno 2.9.6) → `deno check` **can run** |
| Node | v22.14.0 |
| Working tree | the whole old `docs/` tree (DECISIONS.md, ARCHITECTURE.md, FINAL_REPORT.md, screenshots, Lighthouse) is **deleted but unstaged** (user change predating this run); `docs/SALEEM_AUDIT.md` (was untracked) is gone too |

## Baseline (before any change)

| Command | Result |
|---|---|
| `npm test` (frontend) | 6 files, 31 passed |
| `npm test` (backend) | 6 files, 93 passed, 7 skipped (`isolation.test.ts`, live creds missing) |
| `npm --workspace frontend exec tsc -- --noEmit -p .` | pass |
| `npm run lint` | **fail**: 1 Prettier error (`ReportView.tsx` img attributes, CRLF formatting), 17 `react-refresh` warnings |
| `deno check` analyze, cleanup-media, account, diagnostics | pass |

## Answers to the 10 questions

1. **`org_members.role`** is enum `public.org_role` with values `owner, admin, reviewer, creator`
   (`migrations/20261014020000_product_features.sql` L60 `create type`, L72 column).
2. **Columns.**
   - `submissions`: id, user_id, is_demo, kind, file_path, audio_path, text_content, caption, platform,
     product_category, is_paid_ad, has_written_contract, ai_used, mawthooq_license_no, parent_id, sha256,
     duration_seconds, status, progress, current_step, overall_status, error_message, thumbnail_path,
     **title**, created_at, analyzed_at, media_deleted_at (schema L150–176) + attempts, heartbeat_at
     (hardening L65) + org_id, campaign_id, batch_id (features L224) + audio_probe (audio migration).
     Platform / paid / product category live **on the submission row**.
   - `findings`: id, run_id, submission_id, rule_code (text, no FK), severity, t_start, t_end,
     evidence_type, evidence_text, evidence_frame_id, explanation_ar/en, **fix_ar/fix_en**, confidence,
     source (schema L282–299).
   - `finding_feedback`: id, finding_id, submission_id, user_id, reason (≤1000), created_at,
     unique(finding_id, user_id) (audio migration L16–24). Insert/select/delete only, no update.
   - `audit_events`: id bigint identity, at, actor, action, target_table, target_id, meta jsonb
     (quality L6–14).
   - `rules`: id uuid, code, rulebook_version_id, category, title_ar/en, description_ar/en, source_name,
     source_url, source_date, check_type, default_severity, llm_instructions, applies_to_categories,
     is_active + legal_status, source_verified, source_name_en (hardening L19). `code` unique **per
     version** (`rules_version_code_key`, features L297).
   - `rulebook_versions`: id, version_label, notes, is_active, created_at + status
     (`draft|legal_review|published|archived`), effective_from, changelog, published_at, created_by.
   - `share_reviews`: id, share_link_id, submission_id, decision, comment, reviewer name, created_at.
   - `notifications`: id, user_id, kind, submission_id, payload, read_at, created_at.
   - `analysis_runs`: id, submission_id, rulebook_version_id, rulebook_version, llm_model, asr_model,
     prompt_version, started_at, finished_at, step_outputs, raw_llm_output, token_usage + status
     (`running|done|failed`), error, llm_provider, asr_provider, durations_ms, cost_usd, frames_count,
     on_screen_text, audio_mode.
3. **RLS helpers:** `has_role(uid, app_role)`, `can_read_submission(sid)` (demo, owner, or org member
   with owner/admin/reviewer — features L233), `owns_submission(sid)`, `org_role_of(org, uid)`,
   `is_org_member(org, roles[])` (features L102–121). All `security definer set search_path = public`.
4. **Rulebook versions:** v1 seeded in `seed.sql` (id `1111…`); admins use RPCs
   `create_rulebook_draft` (copies active rules) and `set_rulebook_status` (publishing archives the
   previous active version) from `features/admin/RulebookAdminPage.tsx`. Rules are writable only while
   their version is `draft|legal_review`.
5. **Batches:** implemented end to end (`batches` table, `submissions.batch_id`, quota trigger,
   `ArchivePages.tsx` batch view). **Comments:** none (only `share_reviews.comment` from brands).
6. **`audit_events`** is generic (actor/action/target_table/target_id/meta) and written by
   `audit_trigger()`; readable by platform admins only; authenticated users have no write grant, but
   nothing enforces append-only for `service_role`. → **M5 decision (D68):** add a dedicated
   `review_events` table (org-scoped RLS, append-only trigger) instead of overloading `audit_events`,
   whose RLS is admin-only and whose shape lacks org scope.
7. **Suggested fix** lives in `findings.fix_ar` / `findings.fix_en`.
8. **pgcrypto:** `extensions.digest(text, 'sha256')` encoded hex (`compute_report_hash`, features L368);
   `seal_compliance_log` updates `compliance_logs.report_hash`.
9. **Docker + Supabase CLI:** not available (see Environment).
10. **Last decision number** in `docs/DECISIONS.md` (as of HEAD): **D66**.

## PROJECT_GUIDE.md claims → verification

| Claim | Result |
|---|---|
| Pipeline in `analyze/index.ts`, `Deno.serve` ~L351, `runPipeline` ~L109, rate limit ~L382 | Verified |
| Rate limit counts created submissions with `>` (allows 31) | Verified (L382–386) |
| `fail_stuck_submissions` writes a literal Arabic message | Verified (quality L59–73) |
| Failed `triggerAnalysis` only `console.warn`s | Verified (`data.ts` L393–398) |
| Cron migration hard-codes the project URL | Verified (hardening L157–172) |
| Isolation tests skipped | Verified — they target the **hosted** project with two real accounts |
| Edge functions import `supabase-js@2.49.1` | Verified (frontend `^2.117.3`) |
| Status values `ready/review/needs_fixes` | Verified |
| "Analysis status `queued → processing → done/failed/cancelled`" (master §4.1) | **Different:** enum is `queued, extracting, transcribing, analyzing, done, failed`; cancel = `failed` + `error_message = 'cancelled_by_user'` |
| Owners can write findings (schema L306 policy) | **Different:** revoked by hardening L72–77; only `service_role` writes results |
| `rules.code` unique | **Different:** unique per rulebook version since features L296 |
| Demo test accounts hidden in production by default | **Different:** `SHOW_TEST_ACCOUNTS = VITE_SHOW_TEST_ACCOUNTS !== "false"` → shown unless explicitly disabled (`auth.tsx` L10) |
| `ai_settings` unused | Verified (no reads in functions or frontend features) |
| `docs/ARCHITECTURE.md`, `roadmap.md` stale | `roadmap.md` present and stale; `docs/ARCHITECTURE.md` deleted in the working tree |
| `docs/SALEEM_AUDIT.md` untracked | **Not found** — no longer on disk |
