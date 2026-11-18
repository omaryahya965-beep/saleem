# SALEEM v2 — final report (autonomous full run)
Branch `v2/full-run` · tags `v2-phase-0` … `v2-phase-7` · 2026-11-17 → 2026-11-18 · nothing was deployed or pushed.

## 1. Phases
| Phase | Status | Built | Gate | Deviations |
|---|---|---|---|---|
| 0 Baseline | done | Discovery; fixed the broken fresh `db reset` (D71); cron reads the project URL from Vault; eval baseline | green; db reset **not run** | D67–D77 |
| 1 Promotions | done | Promotions with versions, products (key facts, versions), org settings, list and detail | green; db **not run** (PGlite ✓) | D78–D87 |
| 2 Rule engine | done | Sources, packs, applicability, finding types, `rule_checks`, release `2026.11-v2` (SAMA and CMA rules as **drafts**), v2 schema, eval v2 (24 cases) | green; live model **not run** | D88–D103 |
| 3 Review | done | Review state machine, separation of duties, hash-chained sealed decisions, finding responses, legal escalation, queue, audit, notifications | green | D104–D112 |
| 4 Collaboration + PDF | done | Pinned comments, change requests carried forward, Compare tab, PDF (up to 30 pages) | green; PDF browser path **manual** | D113–D118 |
| 5 Libraries | done | Claims library (six classes), disclaimers, linked claims, fix from a finding, dashboard summary, saved views, CSV, org overrides | green | D119–D122 |
| 6 Enterprise (P2) | done | Multi-level approval, risk acceptance, partners, variations, lifecycle, analytics, internal policies | green; e2e per flag **not run** | D123–D131; external reviewer and carousel not built |
| 7 Expansion (P3) | done | Self-approval, API keys and read-only API, webhooks, Slack/Teams, Ask SALEEM, calibration, readability hint; CMA and insurance packs stay drafts | green; live deliveries **not run** | D132–D137; API write endpoints not built |

Every phase passed lint (0 errors), typecheck, unit tests (85 frontend + 144 backend), `deno check` (10 functions),
build, offline e2e (33 tests), creator eval at baseline (9/8/0) and eval v2 (24/24). **Not run in this environment
(no Docker):** `supabase db reset`, `supabase test db`, `isolation.test.ts`, the 12 `public.spec` e2e tests, live
model runs and outbound deliveries. Every migration, the seed and all 18 pgTAP files were run on a PGlite smoke
harness and passed.

## 2. Feature flags
Every flag lives in `org_settings.features` and is off unless it is exactly `true`. To turn one on, an owner or admin
opens the workspace page (`/org/{id}`), goes to «مسارات العمل المتقدمة», and ticks the box.

| Flag | Enables |
|---|---|
| `multi_level_approval` | Approval presets (sequential or parallel), auto-apply, step decisions, carry-forward |
| `risk_acceptance` | Risk acceptors; «قبول مخاطر — ليس اعتماداً من الالتزام» |
| `partners` | Partner links, `/partner/{token}`, pending partner access, isolation |
| `upload_types` | Variations and bulk submit |
| `lifecycle` | Evergreen re-review, lifecycle dates, «طلب سحب» deadline |
| `analytics` | `/analytics` (`org_metrics`) |
| `internal_rules` | Brand guidelines → drafted INT-* rules → edit, approve → «سياسة داخلية» findings |
| `self_approval` | Self-approval rules and «اعتماد ذاتي» |
| `api` | API keys (read-only API v1) and signed webhooks |
| `notifications_chat` | Slack / Teams incoming webhooks |
| `ask_saleem` | `/ask` read-only assistant |
| `readability_hint` | Readability hints beside the report |

## 3. Decisions and assumptions to confirm
All decisions are in `docs/DECISIONS.md`, D67–D137. The ones to confirm are listed under "Assumptions to confirm"
in `docs/saleem-v2/PROGRESS.md`. The main ones:
- D67: your deletion of the old `docs/` tree is left uncommitted.
- D70: test accounts are shown on sign-in by default.
- D118: there are npm audit highs in build tooling.
- D121: saved views exist on the promotions list only.
- D127: partners use their own plan quota; there is no external reviewer.
- D128: carousel is not built.
- D129: holidays can only be set in SQL; a Thursday or Friday notice is due on Sunday.
- D131: when no model key is configured, internal-rule drafts are built from directive sentences in the guideline.
- D132: blocked packs for self-approval can only be set in SQL.
- D133: the API is read-only.

## 4. Verify before deploy (local)
```bash
git checkout v2/full-run
npm ci
npx supabase start --workdir backend                 # needs Docker
npx supabase db reset --workdir backend              # every migration + seed (not run here)
npx supabase test db --workdir backend               # 18 pgTAP files (not run here)
SUPABASE_LOCAL_URL=http://127.0.0.1:54321 SUPABASE_LOCAL_ANON_KEY=<local anon> SUPABASE_LOCAL_SERVICE_ROLE_KEY=<local service> \
  npm --workspace backend test -- isolation                     # skipped unless these local variables are set
npm run lint && npm --workspace frontend exec tsc -- --noEmit -p . && npm test
npx --yes deno@2 check backend/supabase/functions/*/index.ts
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm run build
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npm --workspace frontend run e2e   # incl. public.spec
npm --workspace backend run eval -- --deterministic-only && npm --workspace backend run eval:v2
# Optional, paid: one live analysis with OPENAI_API_KEY set locally (supabase functions serve).
```
Then turn each flag on in a local workspace and follow §7.

## 5. Deployment runbook (for you, not executed)
1. **Back up** the production database: a dashboard backup, or `pg_dump`.
2. **Migrations:** from `20261117000100_v2_p0_cron_vault_url.sql` to `20261118070600_v2_calibration.sql`
   (`npx supabase db push` after reviewing the diff). They are additive only. Rollbacks are in
   `backend/supabase/rollbacks/`; enum values added in M9 can't be removed.
3. **Functions:** `analyze`, `review-notify`, `cleanup-media`, `account`, `diagnostics`, `internal-rules-draft`,
   `api`, `webhooks-deliver`, `ask`. Their `verify_jwt` settings are in `backend/supabase/config.toml`: `api`,
   `webhooks-deliver` and `cleanup-media` are false.
4. **Secrets (names only):** `OPENAI_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_REASONING_EFFORT`,
   `TRANSCRIPTION_PROVIDER`, `TRANSCRIPTION_MODEL`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `APP_URL`,
   `ANALYZE_RATE_LIMIT_PER_HOUR`. The Supabase-provided keys are `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY`. **Vault:** `project_url`, `cleanup_cron_secret`. These are used by the cron jobs
   `saleem-cleanup-media`, `saleem-claims-reminders`, `saleem-lifecycle` and `saleem-webhooks`.
5. **Auth:** for partners, enable email OTP with a production SMTP sender.
6. **Frontend:** build with the production `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Set
   `VITE_SHOW_TEST_ACCOUNTS=false`.
7. **Smoke tests:** sign in; create a promotion and upload a text version → analysis finishes; submit → a reviewer
   decides → `verify_decision_chain` is valid; `/rules` shows the drafts labelled as drafts; with every flag still
   off, none of the Phase 6/7 cards or pages show for real organisations.

## 6. Legal review
`docs/saleem-v2/legal/LEGAL_REVIEW_CHECKLIST.md` lists each draft rule (30 SAMA, 6 CMA) with its source article, the
checks to make and a decision column. The insurance pack has no rules until the Insurance Authority's current
requirements are confirmed. Nothing becomes active without this review and a new release published by a platform
admin.

## 7. Manual test script (Arabic)
1. سجّل الدخول بحساب المالك، وافتح المساحة، وأضف منتجاً «تمويل شخصي» بمعدل نسبة سنوي.
2. «إعلان جديد» ← نص يذكر معدلاً مختلفاً ← انتظر الفحص ← تظهر «معلومة لا تطابق بيانات المنتج».
3. أجب عن كل ملاحظة كرافع، ثم «إرسال للمراجعة».
4. بحساب المراجع: «فتح المراجعة» ← أجب عن الملاحظات ← «طلب تعديل» مع سبب.
5. كرافع: ارفع إصداراً ثانياً ← تبويب «المقارنة» يبيّن ما أُصلح وما بقي ← أعد الإرسال.
6. كمراجع: «اعتماد» ← شهادة الاعتماد ← «التحقق من السجل» سليم.
7. «مكتبة الادعاءات»: أضف ادعاءً بإثبات ← اعتمده ← ارفع إعلاناً يعيد صياغته ← لا ملاحظة ادعاء.
8. فعّل «الاعتماد متعدد المراحل» ← قالب متتالٍ (مراجع ← مدير) ← أرسل ← اعتمد المرحلتين بشخصين مختلفين.
9. فعّل «قبول المخاطر» ← ارفض إعلاناً ← «طلب قبول المخاطر» ← اقبل ← تظهر «ليس اعتماداً من الالتزام».
10. فعّل «الشركاء الخارجيون» ← أنشئ رابطاً ← افتحه في نافذة خاصة ← رمز البريد ← أرسل إعلاناً ← لا يرى الشريك غير إرسالاته.
11. فعّل «دورة حياة الإعلان» ← إعلان دائم بلا تاريخ لا يُعتمد ← «طلب سحب» بإشعار يوم خميس ← الموعد الأحد.
12. فعّل «التحليلات» ← افتح /analytics ← الأرقام تطابق القرارات.
13. فعّل «سياسات داخلية» ← الصق دليل الهوية ← «اقتراح قواعد» ← حرّر واعتمد ← تظهر ملاحظة «سياسة داخلية».
14. فعّل «واجهة برمجية» ← أنشئ مفتاح قراءة ← `curl -H "Authorization: Bearer slm_…" <URL>/functions/v1/api/v1/promotions`.
15. افتح «القواعد»: كل قواعد البنك المركزي وهيئة السوق المالية «مسودة» ولا شيء مفعّل منها.
