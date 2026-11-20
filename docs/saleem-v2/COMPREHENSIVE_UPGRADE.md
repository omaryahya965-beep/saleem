# SALEEM V2 comprehensive upgrade — implementation checklist (2026-11-20)

Source: `SALEEM_V2_UPGRADE.md` (40 sections). The 122 original observations are not in the repository; the spec
consolidates them into the requirements below, so this checklist maps every consolidated requirement. Decisions:
D170–D185 in `docs/DECISIONS.md`. Branch `integrate/pr-1-gemini`; nothing deployed, hosted DB untouched.

Statuses: **V** implemented and verified · **I** implemented, not runtime-verified · **P** partially implemented ·
**B** blocked / not reached in this run · **N/A** not applicable after investigation.

Verification legend: pgTAP = `backend/supabase/tests/*`, BT = backend vitest, FT = frontend vitest, E2E = Playwright,
SS = browser screenshot pass (local stack, 375–1920 px, no overflow, no page errors).

## P0 — correctness and security

| § | Requirement | Status | Evidence / note |
|---|---|---|---|
| 6 | Header shows «جارٍ التحليل» after the report is complete | V | Root cause: header read a stale bundle. Live status + one refresh on terminal state (D177). SS shows «مكتمل». |
| 6 | Separate automated-analysis and human-approval states | V | Two chips in the header (`analysis-status`, `review-status`); E2E. |
| 6 | «Partially completed» analysis state | P | State exists in the model; the header does not yet read coverage, so it shows «مكتمل». |
| 6 | No duplicate / repeated paid analysis requests | V | Existing idempotent `analyze`; the new refresh never re-triggers analysis; Fix makes ≤1 call per explicit click. |
| 5.1 | Semantic finding grouping, raw findings preserved, stable across versions | V | `grouping.ts`, FT (Nada V1: 9 → 6, two COM-01 claims), SS. |
| 5.2 | MAW-03/04 not applied to own-channel corporate ads; uncertainty marked | V | D171, BT `upgrade-engine`, pgTAP p9. Legal confirmation still pending. |
| 5.3 | Sector rule coverage with official sources | P | Cosmetics/food/tourism draft packs now default to their sectors; no rule activated (drafts stay non-binding). SFDA claims standard SFDA.CO/GSO 2528 identified, official text not verified here. |
| 5.4 | Applicability reporting (enabled / evaluated / excluded / unverified / passed / failed) | P | Existing «القواعد والحزم المطبقة ولماذا» kept; summary tiles add passed / manual counts. No new package-level view. |
| 5.5 | AI integrity, prompt injection, honest coverage | P | Existing pipeline guards + coverage banner; Fix rejects invented licences/approvals/evidence (BT). |
| 11 | Submit with unanswered findings (explanation per policy) | V | D172, pgTAP p3/p9, FT. |
| 11 | Request changes / reject without answering every finding; approval stays strict | V | D173, pgTAP p9, FT. |
| 12.4 | Resubmission returns to the eligible previous reviewer; no duplicate assignment events | V | pgTAP p9. |
| 15 | Conditional approval integrity (conditions required, separate final decision, hash chain) | V | D175, pgTAP p9. |
| 17 | Decisions and audit records preserved; no duplicate events from no-op operations | V | Immutable tables untouched; idempotent responses / assignment / submit conditions (pgTAP). |
| 23 | RBAC from membership role only, server-enforced | V | No email checks added; rbac.test (15) + pgTAP. |
| 27.6 | Partner single-active-ad bug; configurable atomic limit; blocking ads named | V | D174, pgTAP p9. |

## P1 — core workflow and UI/UX

| § | Requirement | Status | Evidence / note |
|---|---|---|---|
| 7 | Four-step new-advertisement flow, file kept between steps, one primary action | V | E2E (3 viewports), SS. |
| 7 | One representation for paid / platform–channel; product-driven defaults | V | FT `wizard.test`. |
| 7 / 4.3 | Conflicts explained before analysis | V | FT, E2E (channel required). |
| 7 | Draft recovery without duplicate ads | I | localStorage fields only; not browser-tested. |
| 8.1 | Header: title, version, latest, product, campaign, creator, reviewer, deadlines, states | V | SS. «Organisation» shown via the workspace switcher, not in the header. |
| 8.1 | Historical version guard | I | Banner + actions only on latest; not browser-tested. |
| 8.2 | Role-specific next step, server-backed actions only | V | SS (marketer); logic per role in `NextStep`. |
| 8.3 | Media workspace: markers, clickable timestamps, transcript sync, fullscreen | V | Existing player + group timestamp buttons; E2E (seek 00:12). |
| 8.4 | Five tabs with consistent language | P | Analysis, Information, Compare redesigned; Comments and History not redesigned (§17, §18). |
| 9 | Compact result summary, finding cards, filters, classification | V | SS, FT. Frame thumbnails when the run stored them. |
| 10 | Responses inside each card, saved state, progress, next unanswered, history | V | SS, pgTAP (idempotency). Old bottom panel no longer rendered (component kept). |
| 12.1–12.3 | Queue: role default, counters, rich cards, direct assignment with workload | V | SS (admin, 1920 px), pgTAP `eligible_reviewers`. |
| 13 | Decision dialog: no default, summary, reasons, conditions, consequences | V | FT. Summary of confirmed/resolved counts available but not populated from the page yet. |
| 14 | Requested-changes summary, checklist, unified upload button, notification link | V | SS (workspace); notifications link to ad + version (I). |
| 15 | Conditions workspace (fulfil, evidence, submit, verify, final) | I | UI built; DB flow pgTAP-verified; not exercised in the browser. |
| 16 | Comparison: summary, side-by-side media, sentence panels, grouped findings, no % | V | E2E (sample compare), SS. |
| 17 | History timeline redesign | P | New events recorded (conditions, corrections, unassignment); the timeline UI is unchanged. |
| 18 | Comments: threads, @mention search, categories | B | Not reached in this run; existing comments panel unchanged. |
| 19 | Information tab sections, editable vs snapshot | P | Sections done; per-version declarations (AI, agreement) are not shown in the tab. |
| 20 | Role dashboards | P | RLS-scoped workload tiles per role + existing role home; no reviewer-workload chart or activity feed. |

## P2 — organisation management

| § | Requirement | Status | Evidence / note |
|---|---|---|---|
| 4.1–4.2 | Multi-industry sectors, dynamic product forms, no fictional values required | V | FT `product-sectors`, pgTAP p9 (constraint). Form UI not screenshot-tested (I). |
| 4.3 | Content-vs-metadata conflicts after analysis | P | Existing financial product-fact checks only. |
| 21 | Team & Workspace tabs (Overview, Campaigns, Members, Invitations, Partners, Settings) | B | Not reached. Label «مساحة الوكالة» → «مساحة العمل» done. Owner-label investigation not done. |
| 22 | Roles & permissions page redesign | B | Existing page unchanged; RBAC.md updated with the new actions. |
| 24 | Features page categories | B | `saleem_fix` flag added to the list; no categorisation yet. |
| 25 | Risk acceptance / self-approval review | P | Unchanged and still separate from approval. Not re-audited: whether `self_approve` honours the new approval blockers must be checked. |
| 26 | Internal policy duplicates and Company Rules page | B | Not reached. |
| 27.1–27.2 | Partner identity, scoped links (campaign, products, channels, types, instructions, expiry, limit), rotation, usage | V | pgTAP p9; admin UI (I). |
| 27.3 | Link origin from the running app | V | `window.location.origin` (no hard-coded port). |
| 27.4 | Partner dashboard with available links | I | `my_partner_links` + dashboard card; restricted partner navigation unchanged. |
| 27.5 | Submission page shows scope, instructions, safe default type | I | Built; pgTAP covers the server rules. |
| 27.7–27.8 | Full partner lifecycle and isolation | P | DB lifecycle + isolation pgTAP (p6, p9); no end-to-end browser run. |
| 28 | Notifications for the workflow events, links, no duplicates | P | Decision/condition/partner texts and links; analysis completion pre-existing; recipients authorised by RLS. |

## P3 — SALEEM Fix

| § | Requirement | Status | Evidence / note |
|---|---|---|---|
| 29.1 | Manual / AI-assisted / replacement methods | P | Manual and AI text correction available; replacement shows «يتطلب إعداداً». |
| 29.2–29.4 | Wizard, preferences, plan per finding, side-by-side editable text | I | Built; BT for guards; no live Gemini call made (paid, not authorised). |
| 29.5–29.6 | Voice-over / on-screen / video generation | B | No authorised provider configured; abstraction reports not configured. Nothing simulated. |
| 29.7–29.9 | Preview, explicit acceptance, new version, no inherited approval, mandatory re-analysis | V | pgTAP p10 (version created, original kept, submit blocked until analysed). |
| 29.10 | Cost estimate, quota, no auto-retry, duplicate prevention, failures | V | pgTAP p10 (quota, idempotency), Edge Function design; estimate shown before calling. |
| 30 | Nada Cream acceptance run of SALEEM Fix | B | Needs a paid Gemini call; not run. |

## P4 — public presentation

| § | Requirement | Status | Evidence / note |
|---|---|---|---|
| 31 | Landing redesign, navigation, journey, capabilities, roles, trust, responsive, ar/en | V | E2E, SS (375/768/1440, ar/en). |
| 32 | Nada Cream sample (both videos, findings, timestamps, comparison, workflow, read-only, CTA) | V | E2E, SS. Original V1 video recovered from the local storage volume. |

## Cross-cutting

| § | Requirement | Status | Evidence / note |
|---|---|---|---|
| 33 | Navigation, keyboard, contrast, no colour-only status | P | New components use buttons/roles/labels and text tags for diffs; no full accessibility audit. |
| 34 | Safe new migrations, RLS, transaction safety | V | 2 migrations; fresh `db reset` + 21 pgTAP suites pass. |
| 35 | Security validation with negative direct requests | P | pgTAP negatives for every new RPC; mentions / external-reviewer paths not re-tested. |
| 36 | Tests extended, not reduced | V | +4 FT files, +2 BT files, +2 pgTAP suites; changed tests explain the new requirement. |
| 36.1–36.2 | Full internal / partner workflow tests | P | Covered at database level (pgTAP p9) with fixture analyses, not through the UI with real analysis. |
| 36.5 | Visual checks at 375–1920 px, before/after | P | After screenshots for landing, sample, workspace, wizard, queue, Fix; no "before" set kept. |
| 38 | Documentation | V | This file, D170–D185, RBAC.md, PROGRESS.md. |

## New migrations

- `20261120100000_v2_upgrade_workflow.sql` — sectors, MAW scope, response actions/statuses, submission and decision
  rules, `approval_conditions` + RPCs + storage policies, partner link scope/limit/rotation/stats, assignment no-op,
  `eligible_reviewers`, notification kinds.
- `20261120110000_v2_saleem_fix.sql` — `correction_jobs`, `submissions.correction_job_id`, Fix RPCs.

## Local development and demo

- `npm run demo:seed`, then `node scripts/demo-env.mjs node scripts/local-nada-fixture.mjs` creates «كريم ندى — بيانات
  اختبار محلية» in the demo organisation (fixture analysis rows, labelled `fixture`; local stack only).
- SALEEM Fix: enable `saleem_fix` in the workspace features; set `GEMINI_API_KEY` for the `fix` function; optional
  `saleem_fix_monthly_limit` in `org_settings.features`.

## Known limitations

- MAW-03/04 scope and SFDA cosmetics rules need legal confirmation (no draft rule activated).
- No live Gemini run of SALEEM Fix or of the Nada Cream V1/V2 analysis in this run.
- Sections marked B above were not reached and remain as before.
- The local manual-test database was wiped by a `db reset` during this run; only the uploaded media survived.
