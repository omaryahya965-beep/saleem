# Phase 2 plan — Saudi rule engine v2

## Discovery
- `rules.check_type` already exists as enum `public.check_type` (`audio|visual|text|metadata|hybrid`) and
  `rules.title_ar` exists → the v2 check kind goes into a new column **`check_kind`** (`deterministic|llm|hybrid|workflow`) (D88).
- `findings` already has `evidence_text`, `explanation_ar/en`, `fix_ar/en` → reuse `fix_ar` as the suggested fix.
- `normalizeArabic` keeps «ة» (does not map to «ه») and maps Arabic-Indic digits → patterns use `[ةه]`.
- Model v1 output: `{findings[], on_screen_text[]}` (`pipeline/schema.ts`); OCR stored on `frames.ocr_text` and
  `analysis_runs.on_screen_text`.
- seed.sql runs after migrations, so on a fresh reset the v1 rules exist only after the seed. The new release is built
  by an idempotent function `v2_publish_rulebook()` called by the migration **and** at the end of seed.sql (D89).
- `runPipeline` lives in the Deno entry file (esm.sh imports) → the new logic goes into a pure
  `_shared/pipeline/evaluate.ts` that Vitest can run end to end with a mocked model output (D90).

## Slices
1. M3 `v2_rules_sources_packs`: sources, packs (+ `sa-system`), `org_rule_packs`, new rule columns, release
   `2026.11-v2` = 12 existing rules (mapped to packs/sources, unchanged) + 24 SAMA drafts + 6 CMA drafts + `SYS-INJECTION`;
   RPCs `set_org_rule_pack`, `set_rule_review_state` (activation guard). pgTAP test.
2. M4 `v2_findings_rule_checks`: finding columns, `rule_checks`, `analysis_runs.coverage/context_snapshot`,
   compliance-log hash v2 (`hash_version`, old seals keep verifying). pgTAP test.
3. Pure modules + tests: `numbers.ts`, `signals.ts`, `applicability.ts`, `lexicon/sa_finance.ts`,
   `checks/` (registry; SAMA checks grouped in one module — D91), `productFacts.ts`, `coverage.ts`.
4. Schema v2 + prompt v2 (+ v1 compatibility), `PROMPT_VERSION = v4-2026-11`.
5. `evaluate.ts` (selection → signals → checks → facts → merge v2 → coverage → rule checks → overall) +
   carry-forward; tests for cases 1–7 and 15 with mocked model output.
6. `analyze/index.ts` orchestration (context snapshot, rule checks, coverage, carry-forward, step outputs).
7. Report UI v2 (coverage banner, type grouping, card anatomy, draft label, citation, «قواعد لم تنطبق»,
   «تعذّر التحقق», advisory on report + compliance log); forbidden-copy grep test.
8. Rulebook UI: packs, rule detail, org toggles (+ include drafts), platform-admin state change with guard.
9. Eval: ≥ 20 financial cases, v2 metrics, offline deterministic run.
10. Gate, report.

## Risks
- Prompt/schema change cannot be exercised against the real model here (no key, D76): only mocked.
- Draft rules never activate; tests opt in with `include_draft_rules = true` fixtures only.
