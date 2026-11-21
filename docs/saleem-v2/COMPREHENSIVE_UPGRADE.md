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

---

# V2 completion report (2026-11-21, branch `feature/saleem-v2-completion`)

The original 122 observations are not in the repository. `SALEEM_V2_UPGRADE.md` consolidates them into the
requirements of §4–§33, and the table below maps every consolidated requirement (some cover several observations).
**Not all 122 are complete.** The rows marked P, B or L say what is left. Decisions: D186–D204. Nothing was
deployed, and the hosted database was not touched.

Statuses (spec §24): **V** Implemented and verified · **I** Implemented but not runtime-verified · **P** Partially
implemented · **B** Blocked by external dependency · **L** Requires legal approval · **N/A** Not applicable after
investigation.

Verification: pgTAP = `backend/supabase/tests` on the isolated stack · BT/FT = backend/frontend vitest · E2E =
Playwright (51 tests, 3 projects) · WT = `scripts/browser-walkthrough.mjs` (nine roles + 60 responsive views on
the isolated stack) · NA = `scripts/nada-acceptance.mjs`.

Migrations in this branch: `20261121100000_v2_governance_audit`, `20261121110000_v2_collaboration`,
`20261121120000_v2_workspace`, `20261121130000_v2_fix_media`, `20261121140000_v2_fix_notifications`,
`20261121150000_v2_rule_categories`.

## Correctness, engine and security

| § | Requirement | Before | Now | Files | Migration | Verification | Result | Limitation |
|---|---|---|---|---|---|---|---|---|
| 6 | Header analysis state after completion | V | V | `PromotionPage.tsx` | — | E2E | pass | — |
| 6 | Separate analysis and approval states | V | V | header chips | — | E2E | pass | — |
| 6 | «Partially completed» analysis state | P | P | model only | — | — | — | Header still shows «مكتمل» for partial coverage |
| 6 | No duplicate paid analysis requests | V | V | `analyze` idempotency | — | BT | pass | — |
| 5.1 | Semantic grouping, raw findings kept | V | V | `grouping.ts` | — | FT, E2E sample | pass | — |
| 5.2 | Mawthooq rules not applied to own-channel company ads | V | V | `applicability.ts` | — | BT `mawthooq-applicability` (8) | pass | MAW scope still needs legal confirmation |
| 5.3 | Sector coverage with official sources | P | L | `legal/REGULATORY_VERIFICATION.md`, generator | — | reachability of all 19 cited URLs | 126 ready for legal review · 18 need a primary instrument · 9 unreachable here · 34 SAMA link opens a page, not the PDF | No rule activated; exclusions and effective dates are not in the dataset |
| 5.3 | Cosmetics coverage (Nada) | P | L | `legal/coverage-notes.md` | — | mapping to SA-COS-003/004 and the D188 patterns | therapeutic-claim gap found | Candidate COS-CAND-01 awaits a verified legal reference |
| 5.4 | Applicability reporting | P | P | existing panel | — | — | — | No package-level view |
| 5.5 | AI integrity and honest coverage | P | P | pipeline guards | — | BT | pass | No new red-team suite |
| 14c | AI accuracy evaluation | — | V | `backend/eval/cases.json` (26), `deterministic.ts` | — | `eval --deterministic-only` | recall 0.81, precision 1.0; deterministic-capable 34/34 | Model-only rules need a live run |
| 11 | Submit with unanswered findings per policy | V | V | — | — | pgTAP p3/p9 | pass | — |
| 11 | Request changes without answering all; strict approval | V | V | — | — | pgTAP p9, NA | approval blocked (`confirmed_violations:4`) | — |
| 12.4 | Resubmission to the previous reviewer | V | V | — | — | pgTAP p9 | pass | — |
| 15 | Conditional approval integrity | V | V | — | 100000 | pgTAP p9, p11 | pass | — |
| 17 | Decisions and audit preserved, no duplicate events | V | V | — | — | pgTAP, BT workflows (sealed chain) | pass | — |
| 23 | RBAC from membership role, server-enforced | V | V | — | — | `rbac.test` (15), pgTAP p8, WT | pass | — |
| 25 | Risk acceptance and self-approval re-audit | P | V | `can_self_approve`, `record_lifecycle` | 100000 | pgTAP p11 (negative tests) | bypass fixed (D186) | — |
| 27.6 | Partner single-active-ad bug, configurable limit | V | V | — | — | pgTAP p9 | pass | — |
| 35 / 21c | Security audit incl. direct requests | P | V | `SECURITY_AUDIT_V2.md` | — | pgTAP, rbac, isolation, demo-login, `client-ip` | 5 issues fixed (D186, D187, D189, D198, D204) | Production settings: recommendations only |
| 21c | Demo login abuse (500/h in production) | — | P | `demo-login`, `_shared/http.ts` | 100000 | BT `client-ip` (4), `demo-login` | code default 20/h, spoof fix, shared AI cap | Production env change needs your approval |

## Workflow and UI

| § | Requirement | Before | Now | Files | Migration | Verification | Result | Limitation |
|---|---|---|---|---|---|---|---|---|
| 7 | Four-step new-advertisement flow | V | V | wizard | — | E2E | pass | — |
| 7 | Paid / channel single representation | V | V | — | — | FT | pass | — |
| 7 / 4.3 | Conflicts before analysis | V | V | — | — | FT, E2E | pass | — |
| 7 | Draft recovery | I | I | localStorage | — | — | — | Not browser-tested |
| 8.1 | Advertisement header | V | V | — | — | WT | pass | — |
| 8.1 | Historical version guard | I | I | — | — | — | — | Not browser-tested |
| 8.2 | Role-specific next step | V | V | `NextStep` | — | WT | pass | — |
| 8.3 | Media workspace | V | V | player | — | E2E | pass | — |
| 8.4 | Five consistent tabs | P | V | Comments, History, Information redesigned | 110000, 120000 | FT `comments`, `history`; WT | pass | — |
| 9 | Findings summary and cards | V | V | — | — | E2E | pass | — |
| 10 | Responses inside the cards | V | V | — | — | pgTAP; NA (real RPCs) | pass | — |
| 12.1–12.3 | Queue and direct assignment | V | V | — | — | pgTAP, WT | pass | — |
| 13 | Decision dialog | V | V | — | — | FT | pass | Summary counts not filled from the page |
| 14 | Requested-changes workflow | V | V | — | — | NA (`changes_requested` with reason) | pass | — |
| 15 | Conditions workspace in the browser | I | I | — | — | pgTAP only | — | Not exercised end-to-end in the browser |
| 16 | Version comparison | V | V | — | — | E2E | pass | — |
| 17 / 8c | History timeline | P | V | `HistoryPanel.tsx` | 120000 | FT `history`, WT | pass | — |
| 18 / 3c | Comments: threads, mentions, categories, links | B | V | `CommentsPanel.tsx`, `comments.ts` | 110000 | pgTAP p12, FT `comments` | pass | Attachments are links; no file upload inside comments |
| 19 / 9c | Information tab, Mawthooq manual check | P | V | `InfoSections.tsx`, `LicenseCheck.tsx` | 110000 | pgTAP p12, WT | pass | — |
| 20 / 10c | Role dashboards | P | V | `RoleWorkload.tsx` | — | WT (8 of 9 roles show a workload) | pass | External reviewer sees no data until sharing exists |
| 28 / 17c | Notifications | P | V | `Notifications.tsx` | 110000, 140000 | pgTAP p12, p14 | pass | In-app only; no email delivery |
| 33 | Navigation and accessibility | P | P | — | — | WT | roles matrix overflow fixed | No full accessibility audit |
| 36.5 / 22c | Visual QA 375/768/1024/1440/1920, ar/en | P | V | `browser-walkthrough.mjs` | — | WT: 60 responsive views | see final report | Screenshots are local files, not committed |

## Organisation management

| § | Requirement | Before | Now | Files | Migration | Verification | Result | Limitation |
|---|---|---|---|---|---|---|---|---|
| 4.1–4.2 | Sectors and dynamic product forms | V | V | — | — | FT, pgTAP p9 | pass | — |
| 4.3 | Content-vs-metadata conflicts | P | P | — | — | — | — | Financial product facts only |
| 21 / 4c | Team & Workspace six tabs, owner label | B | V | `OrgPages.tsx`, `WorkspaceOverview.tsx` | 120000 | pgTAP p13, WT | pass (owner-as-admin was a display bug) | — |
| 22 / 5c | Roles & Permissions page | B | V | `RolesPage.tsx`, `catalogue.ts` | 120000 | FT `roles-catalogue`, WT | pass | — |
| 24 / 6c | Features page categories and configuration | B | V | `FeaturesPage.tsx` | 120000 | pgTAP p13, WT | pass | — |
| 26 / 7c | Duplicate internal rules | B | V | `DuplicateWarning.tsx`, `internal-rules-draft` | 120000 | pgTAP p13 | duplicates warned, approval refused | — |
| 26 / 7c | Company Rules categories; internal vs regulatory | B | V | `InternalRulesCard.tsx`, `CompanyRulesPage.tsx` | 150000 | pgTAP p13 | pass | Logo and colour rules are text instructions; no image matching |
| 27.1–27.2 | Partner identity and scoped links | V | V | — | — | pgTAP p6, p9 | pass | — |
| 27.3 | Link origin | V | V | — | — | — | — | — |
| 27.4 / 11c | Partner dashboard and authorised organisations | I | V | `MyPartnerLinks.tsx`, `PartnerOrgs.tsx` | — | WT (partner `/org`, dashboard) | pass | — |
| 27.5 | Partner submission page | I | I | `PartnerPage.tsx` | — | pgTAP | — | No browser submission with a real analysis |
| 27.7–27.8 | Full partner lifecycle and isolation | P | P | — | — | pgTAP p6/p9, rbac | isolation pass | Upload → analysis → revision as a partner not run in the browser |

## SALEEM Fix

| § | Requirement | Before | Now | Files | Migration | Verification | Result | Limitation |
|---|---|---|---|---|---|---|---|---|
| 29.1 | Methods (manual, AI text, media edit, replacement) | P | P | `FixPage.tsx` | 130000 | pgTAP p14 | media edit added | Replacement video needs a provider |
| 29.2–29.4 | Text correction workspace | I | I | `fix` function | — | BT `fix.test` | guards pass | No live Gemini call: the key's free-tier status could not be confirmed |
| 29.5 | On-screen and voiceover correction | B | V | `mediaPlan.ts`, `mediaRender.ts`, `MediaEditor.tsx` | 130000 | FT `media-plan`; browser on the isolated stack | real MP4, 15.4 s, 768×1344, disclosure burnt in | Recorded or uploaded voice only |
| 29.5 | Text-to-speech voices | B | B | `providers.ts`, `SALEEM_FIX_PROVIDERS.md` | — | — | — | Gemini TTS / ElevenLabs / HeyGen need paid API access |
| 29.6 | Replacement video generation | B | B | `providers.ts` | — | — | — | Veo / HeyGen / Runway need paid API access |
| 29.7–29.9 | Preview, acceptance, new version, re-analysis | V | V | `fix.ts` | 130000 | browser + DB (v2 video, job accepted, ad back to draft) | pass | — |
| 29.10 | Cost and quota controls | V | V | — | 120000, 130000 | pgTAP p10 | pass | — |
| 30 / 16c | Nada Cream scenario | B | P | `nada-acceptance.mjs` | — | real run on the isolated stack | v1→v2: MAW-01 resolved, COM-01 5→4; submit, assign, review, changes requested; approval blocked | v3 and the final decision need another analysis run; no evidence invented |

## Public presentation and cross-cutting

| § | Requirement | Before | Now | Files | Migration | Verification | Result | Limitation |
|---|---|---|---|---|---|---|---|---|
| 31 | Landing page | V | V | — | — | E2E | pass | — |
| 32 | Nada sample report | V | V | — | — | E2E | pass | — |
| 34 | Safe migrations | V | V | 6 new migrations, no edits to old ones | all | isolated `db reset` + pgTAP | pass | — |
| 36 | Tests extended | V | V | +p14, +4 BT files, +1 FT file | — | full suite | pass | — |
| 36.1–36.2 | Internal and partner workflow tests | P | P | `workflows.test.ts` | — | 5 pass, 1 skipped | — | Agency case skipped: no partner token on the isolated seed |
| 38 | Documentation | V | V | this file, DECISIONS D186–D204, SECURITY_AUDIT_V2, SALEEM_FIX_PROVIDERS, REGULATORY_VERIFICATION | — | — | — | — |

"c" after a number refers to a section of the V2 completion request rather than `SALEEM_V2_UPGRADE.md`.

**Counts (70 rows, by "Now"):** V 51 · I 5 · P 10 · B 2 · L 2 · N/A 0.
