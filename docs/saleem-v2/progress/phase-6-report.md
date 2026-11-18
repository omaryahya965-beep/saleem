# Phase 6 report — Enterprise workflows (P2)
Date: 2026-11-18 · Branch: v2/full-run · Commits: 7fb1a85..d6017b8 (tag v2-phase-6)

## Outcome
All seven sub-features are built. Each sits behind its own `org_settings.features` flag and is off by default.
An owner or admin turns a flag on in the workspace page under «مسارات العمل المتقدمة». That card lists only flags
whose feature works.

| # | Flag | Built | Not built |
|---|---|---|---|
| 6.1 | `multi_level_approval` | Presets (sequential or parallel; steps by role or named users; a default preset; auto-apply by market and product type, shown as «مطلوب حسب إعدادات المنظمة»). Live steps per submission. Step decisions are sealed in the hash chain. Separation of duties: nobody acts on their own upload or on two steps. Carry-forward on resubmission, blocked by a preset change or a "fresh review" request. Replacing the preset discards recorded step decisions and logs it. Conditional approval and escalation are blocked inside a flow. | — |
| 6.2 | `risk_acceptance` | Owners/admins designate acceptors (audited). An uploader can request acceptance from `rejected` or `changes_requested`. The acceptor accepts or declines, with a reason, as a sealed decision. Acceptance never sets `approved_at` and is labelled «قبول مخاطر — ليس اعتماداً من الالتزام». Declining restores the previous status. | — |
| 6.3 | `partners` | Partner links: the token is stored hashed and shown once. A public `/partner/$token` page covers email-code sign-in, terms, one promotion at a time, allowed products and channels, a pending membership that admins approve, and «إرسالاتي». **Deny-by-default isolation**: external roles never count as members. Comments are hidden from partners when `hide_comments_from_external` is set. | `external_reviewer` (the role value exists but grants nothing). An offer to migrate share links. (D127) |
| 6.4 | `upload_types` | Variations: shared context, a separate decision for each, and a bulk submit that skips items that aren't ready. Batch upload was checked: it already creates one promotion per item. | Carousel analysis. The schema (`submission_assets`, `frames.asset_id`) is in place. (D128) |
| 6.5 | `lifecycle` | An evergreen promotion can only be approved with a future re-review date (a trigger enforces this on every approval path). A daily `saleem-lifecycle` job moves due items to `due_for_rereview`, which reviewers re-review as a sealed decision. Published, taken-down and withdrawn dates. «طلب سحب» sets a deadline one Saudi business day after the notice (Sun–Thu plus org holidays), shown as a deadline only, with reminders. | A UI to edit holidays: `business_holidays` can only be set in SQL for now. (D129) |
| 6.6 | `analytics` | `org_metrics` is computed only from events and sealed decisions, with SLA counted in business days. It covers every metric in the spec table, with filters. An `/analytics` page shows tiles and bars whose numbers link to lists. Risk acceptance is excluded from approvals. | Charts beyond simple bars (no chart library). (D130) |
| 6.7 | `internal_rules` | Brand guidelines. Drafting uses the configured model, or, without a key, draft rules made from the guideline's directive sentences ("must…", "do not…") and marked as such. An owner or admin must edit and approve each draft. Active `INT-*` rules run in analysis and are labelled «سياسة داخلية», never as regulation (case 9, mocked model). | — |

## Acceptance (6.8)
| Criterion | Status | Evidence |
|---|---|---|
| RLS / permission tests per sub-feature | met (PGlite) | `p6_flows`, `p6_risk`, `p6_partners` (isolation), `p6_upload_types`, `p6_lifecycle`, `p6_analytics`, `p6_internal_rules` |
| e2e in Arabic per enabled sub-feature | **not run** | needs a local Supabase with the flags enabled (no Docker) |
| Metrics checked against fixtures | met | `p6_analytics.test.sql` (values worked out by hand) |
| No weakening of P0/P1 guarantees | met | SoD on steps and re-review, sealed step, risk and re-review decisions (`verify_decision_chain`), risk ≠ approval, evergreen guard, coverage unchanged |

## Tests
- Added pgTAP: 7 files (above). Vitest: `enterprise` (3), backend `internal-rules` (4). Updated `no-cron-dependency`
  (adds `saleem-lifecycle`).
- Gate: lint ✓ (0 errors; the 17 warnings were already there) · typecheck ✓ · unit ✓ (84 frontend + 139 backend) ·
  deno check ✓ (7 functions) · build ✓ · db reset **not run** (no Docker; PGlite smoke ✓ for every migration, the
  seed and all 15 pgTAP files) · e2e ✓ 33 offline; the 12 `public.spec` cases need a live database (**not run**) ·
  creator eval = baseline (9/8/0) · eval v2 ✓ 24/24.
- Rollbacks were written for every migration but not exercised (no local database).

## Deviations
- D123–D131.

## How to verify manually (after `supabase start` + `db reset`)
1. Workspace → «مسارات العمل المتقدمة» → enable «الاعتماد متعدد المراحل» → create a sequential preset (reviewer → admin)
   → submit a promotion → the reviewer approves step 1 → the admin approves step 2 → «معتمد».
2. Enable «قبول المخاطر» → designate an acceptor → reject a promotion → the uploader clicks «طلب قبول المخاطر» → accept → the
   status shows «قبول مخاطر — ليس اعتماداً من الالتزام».
3. Enable «الشركاء الخارجيون» → «رابط جديد» → open the link in a private window → email code (Inbucket) → terms →
   submit → it appears in «إرسالاتي»; the partner cannot open any other page's data.
4. Enable «أنواع الرفع» → «إضافة نسخة» → «إرسال كل النسخ الجاهزة».
5. Enable «دورة حياة الإعلان» → mark evergreen without a date → approval is blocked → set a date → approve →
   «طلب سحب» with a Thursday notice → the deadline is Sunday.
6. Enable «التحليلات» → /analytics → the numbers match the queue and decisions.
7. Enable «سياسات داخلية» → paste a guideline → «اقتراح قواعد» → edit → «اعتماد» → upload an ad with a stretched
   logo → a finding labelled «سياسة داخلية».
