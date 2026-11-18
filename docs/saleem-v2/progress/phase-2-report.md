# Phase 2 report — Saudi rule engine v2
Date: 2026-11-18 · Branch: v2/full-run · Commits: 6defd8f..(tag v2-phase-2)

## Outcome
Every analysis now knows which rules apply to the ad and why. SALEEM selects rules from the context (sector,
product, communication type, channels, distribution, audience, enabled packs, review state, content triggers), runs
deterministic SAMA/CMA/system checks and product-fact matching (APR, fees, term), sends the model only the applicable
model rules inside an untrusted-content block, and stores one outcome per considered rule, typed and cited findings,
and honest coverage. The report shows the coverage banner, finding type, draft-rule label, article and source
verification, rules that did not apply (with reasons) and rules that could not be verified. The rulebook shows packs
and rule details; org owners/admins can enable packs and opt in to preview draft rules; platform admins can move a
rule's review state, and activation requires the official text and a named legal reviewer. **No SAMA/CMA rule is
active**: all are drafts.

## Acceptance criteria
| Criterion | Status | Evidence |
|---|---|---|
| Cases 1–7 and 15 pass (model mocked) | met | `backend/tests/rules-v2.test.ts` «acceptance cases»; `eval/results/v2-latest.json` (24 cases) |
| One `rule_checks` row per considered rule; non-applicable listed with reasons | met | test «every considered rule has exactly one rule check»; `RuleOutcomes` + `report-v2.test.tsx` |
| New findings have `finding_type`, `rule_id`, `citation`; draft findings capped and labelled | met | `evaluate.ts` merge; case 2 test (draft → warning, `rule_draft`); card test |
| Partial coverage never «لا ملاحظات آلية» | met | test «invalid model output … never ready»; `overallStatusV2` |
| Creator-rule behaviour unchanged on existing eval cases | met | `run-eval.ts --deterministic-only --offline`: 9 hits / 8 misses / 0 false alarms = Phase 0 baseline |
| No forbidden copy; advisory line on report and compliance log | met | `report-v2.test.tsx` «copy rules»; `ReportView`, `LogPage` |
| Gate, report, PROGRESS | met | below |

## Changes
- Migrations (+ rollbacks): `20261117020000_v2_rule_category_values.sql`; `20261117020100_v2_rules_sources_packs.sql`
  (9 sources, 7 packs, `org_rule_packs`, v2 rule columns, release 2026.11-v2 = 12 + 30 SAMA drafts + 6 CMA drafts +
  SYS-INJECTION, `set_org_rule_pack`, `set_rule_review_state`, activation constraint); `20261117020200_v2_findings_rule_checks.sql`
  (finding columns, `rule_checks`, run coverage/context, report hash v2). seed.sql publishes the release and seals demo logs.
- Edge Functions: `_shared/rules/{numbers,signals,applicability,productFacts}.ts`, `lexicon/sa_finance.ts`,
  `checks/index.ts`; `_shared/pipeline/{evaluate,context,schema-v2,carry}.ts`; prompt v2 + `analyzeV2`
  (prompt_version `v4-2026-11`); `analyze/index.ts` orchestration (context snapshot, rule checks, coverage, carry-forward).
- Frontend: finding card v2, `RuleOutcomes`/`CoverageBanner`, advisory labels, rulebook packs/rule details/org toggles/
  review-state dialog; `lib/api/rules.ts`; types.
- i18n: ~190 keys per language (`findingType`, `report2`, `rulebook2`); 3 existing status labels reworded (D95).

## Tests
- Added: pgTAP `p2_rules`, `p2_findings_rule_checks`; Vitest backend `rules-v2` (26), `carry` (3); frontend
  `report-v2` (8), `rulebook-v2` (2); eval `cases-v2.json` (24 cases).
- Gate: lint ✓ (0 errors, 17 pre-existing warnings) · typecheck ✓ · unit ✓ (62 frontend, 126 backend + 7 skipped) ·
  deno check ✓ (4 functions) · db reset **not run** (PGlite smoke ✓ incl. 5 SQL test files) · isolation **not run** ·
  build ✓ · e2e ✓ 24/24 (promotions + signed-in) · eval v2 ✓ (24/24 labelled, offline) · creator eval ✓ (= baseline).

## Not done / deviations
- No live model run (no key, D76): prompt v2 and `analyzeV2` are type-checked and exercised only through recorded
  output. Run `npm --workspace backend run smoke` and a real check before deploying.
- Visual-only rules are not marked `unable_to_verify` when frames are missing but the model succeeded (coverage marks
  the gap as partial instead).
- Deviations recorded in D88–D103.

## Risks and follow-ups
- Deterministic Arabic patterns are heuristics; the legal reviewer must review them with the rules (02 §5.2).
- The release switch happens in the migration on deploy; analyses in progress at that moment finish on v1.

## Decisions recorded
D88–D103.

## How to verify manually
1. `npx supabase db reset --workdir backend` → `select version_label from rulebook_versions where is_active` = `2026.11-v2`.
2. `npx supabase test db --workdir backend`; `npm --workspace backend run eval:v2`.
3. As a bank org owner: «دليل القواعد» → «إعدادات القواعد لمساحة العمل» → enable «تضمين القواعد قيد المراجعة القانونية».
4. New promotion with «تمويل شخصي المثال» and text without «معدل النسبة السنوي» → report shows «معلومة إلزامية ناقصة»
   with «قاعدة قيد المراجعة القانونية» and «المادة 3.8».
5. Text with 4.2% → «تعارض مؤكد مع بيانات معتمدة» showing 4.2 and 4.5.
6. Turn drafts off → the report shows «قواعد البنك المركزي السعودي لم تُطبَّق» and SAMA rules under «قواعد لم تنطبق».
