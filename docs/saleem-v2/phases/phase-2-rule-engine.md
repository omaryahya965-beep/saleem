# Phase 2 — Saudi rule engine v2 (P0)

**Goal:** the analysis knows which rules apply to this ad and why, checks the SAMA advertising rules
(draft pack) with deterministic and model checks, compares numbers with approved product facts, types
and cites every finding, records an outcome for every rule, and reports coverage honestly.

**User problem:** a bank compliance officer needs findings tied to the exact article, no noise from rules
that do not apply, and certainty about what was not checked.

**Preconditions:** Phase 1 accepted. Read `02_SAUDI_RULES.md` (all), `03_DATA_MODEL.md` M3–M4,
`04_AI_PIPELINE.md` (all), `05_UX_SPEC.md` §2.1 and §6, `06_TEST_PLAN.md` cases 1–7, 15.

## 2.1 Discovery

- Read `seed.sql` (rulebook v1, 12 rules, demo reports) and the rulebook admin feature.
- Read `_shared/rules/{arabic,deterministic,speech}.ts`, `pipeline/{merge,schema}.ts`,
  `providers/{prompt,openai,index,types}.ts`, `analyze/index.ts` `runPipeline`, the eval runner and
  `cases.json`, and `backend/tests/pipeline.test.ts`.
- List what the model currently returns (schema v1) and where OCR text is stored (`frames.ocr_text`).

## 2.2 Tasks

1. **Migration M3** (`v2_rules_sources_packs`) + rollback + seeds:
   - `regulatory_sources` rows from `02_SAUDI_RULES.md` §2;
   - `rule_packs` from §3, plus `sa-system` (authority `INTERNAL`, always enabled) for `SYS-INJECTION`
     (and later `SYS-CLAIMS`);
   - existing 12 rules mapped to packs/sources without changing their codes, instructions or severities
     (cap `AI-01` at warning only if recorded in DECISIONS);
   - SAMA draft rules from §5 (codes, titles, summaries, applicability, triggers, check types,
     deterministic keys, finding types, severities, model instructions, `review_state = 'draft'`,
     `source_verified = false`, `official_text_ar = null`);
   - CMA draft rules from §6 with the pack disabled by default;
   - publish through the existing rulebook-version mechanism (new release containing old + new rows) so
     `analysis_runs.rulebook_version_id` stays meaningful.
   - `org_rule_packs` defaults: orgs with financial sector get `sa-sama-advertising` enabled with
     `include_draft_rules = true` **only if** the org admin opts in (default false) — show a call to action
     in the rulebook page.
2. **Migration M4** (`v2_findings_rule_checks`) + rollback.
3. **Pure modules + tests** in `_shared/rules/`: `numbers.ts`, `signals.ts`, `applicability.ts`,
   `lexicon/sa_finance.ts`, `checks/index.ts` (registry) with one file per deterministic key,
   `productFacts.ts`. Use the synthetic examples (`02_SAUDI_RULES.md` §5.3) and add dialect variants.
4. **Prompt v2 and schema v2** (`providers/prompt.ts`, `pipeline/schema.ts`, `providers/openai.ts`):
   context block, only applicable model rules, untrusted-content delimiters, output per
   `04_AI_PIPELINE.md` §6.3, one retry on invalid JSON, then `unable_to_verify`. Keep model names and
   batching (32 frames) as they are. Bump `prompt_version`.
5. **Merge v2, coverage, rule checks, overall status** per `04_AI_PIPELINE.md` §7–10.
6. **Pipeline orchestration** in `analyze/index.ts`: build and store `context_snapshot`; select rules;
   signals/numbers after extraction; run checks; persist `rule_checks` and `coverage`; resumable step
   outputs; carry-forward groundwork (§11) — persist matches even though the compare UI comes in Phase 4.
7. **Report UI v2** (`ReportView`, `model.ts`, new components in `features/reports/`): coverage banner,
   type grouping, finding card anatomy (`05_UX_SPEC.md` §2.1), draft-rule label, verification badge,
   «قواعد لم تنطبق» and «تعذّر التحقق» sections, new labels for `overall_status`, advisory line on the
   report **and** the printable compliance log. Legacy findings render with the legacy label.
8. **Rulebook UI**: packs list, rule detail (summary, applicability rendered in Arabic, check type,
   deterministic key, model instruction for admins, article + source + verification + review state);
   org admin toggles: enable pack, «تضمين القواعد قيد المراجعة القانونية». Platform admin: move rule
   `draft → legal_review → active` with the activation guard (official text + reviewer name required).
9. **Eval**: add ≥ 20 labelled financial cases (text) covering cases 1–7 and 15 plus negatives for each
   deterministic check; extend metrics (citation accuracy, applicability accuracy, unable-to-verify
   rate); `--deterministic-only` covers every deterministic key.
10. **Compliance log seal**: confirm `compute_report_hash` still covers findings; include `finding_type`
    and `rule_id` if the hash input is built from findings (new migration replacing the function, old
    seals must still verify — version the hash input or keep the old input for old logs).

## 2.3 Tests

- Unit: every deterministic key (pass, fail, dialect, Arabic-Indic digits); applicability matrix (sector,
  product type, audience exclusion, `any_of`, drafts excluded/included, workflow rules); product facts
  (APR equal/different, fees «بدون رسوم» vs approved fee, term out of range, draft product →
  `unable_to_verify`); merge precedence; coverage partial cases; `SAMA-ADV-05-3` not firing on the
  supervision sentence.
- Pipeline integration (mocked providers): cases 1–7 and 15; invalid model JSON → `unable_to_verify` +
  partial coverage; schema v1 output on a resumed run still merges. Test fixtures set
  `include_draft_rules = true` for `org_bank`, because every SAMA rule is a draft until legal review.
- Drafts off: the same ad for an org that did not opt in shows the SAMA rules as `not_applicable`
  (`draft_excluded`) and a call to action in the report, not an empty "no findings" result.
- DB: `rule_checks` RLS; findings new columns readable by the same users as before.
- UI: finding card snapshot (ar/en), advisory line present, no forbidden words (grep test on `ar.json`
  and `en.json`: «متوافق 100», "compliant", «معتمد من البنك المركزي»).

## 2.4 Acceptance criteria

- [ ] Cases 1–7 and 15 pass in tests/eval with model calls mocked in CI.
- [ ] Every run writes one `rule_checks` row per considered rule; the report lists non-applicable rules
      with reasons.
- [ ] Every new finding has `finding_type`, `rule_id`, `citation`; draft-rule findings are capped and
      labelled.
- [ ] Partial coverage can never produce «لا ملاحظات آلية».
- [ ] Existing creator-rule behaviour unchanged on the existing eval cases (compare before/after).
- [ ] No forbidden copy anywhere; advisory line on report and compliance log.
- [ ] Gate checks pass; report written; PROGRESS updated.

## 2.5 Out of scope

Claims and disclaimers libraries (Phase 5), PDF (Phase 4), human review (Phase 3), activating any draft
rule (requires a legal reviewer).
