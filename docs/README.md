# SALEEM documentation index

Start with the root [`README.md`](../README.md) (product, local setup, tests) and [`PROJECT_GUIDE.md`](../PROJECT_GUIDE.md).
The code wins when a document disagrees with it.

## Current reference

| Topic | Document |
| --- | --- |
| Decision log (every decision, numbered) | [`DECISIONS.md`](DECISIONS.md) |
| Where the work stands | [`saleem-v2/PROGRESS.md`](saleem-v2/PROGRESS.md) |
| Programme rules and hard rules | [`saleem-v2/00_MASTER_PROMPT.md`](saleem-v2/00_MASTER_PROMPT.md) |
| Data model | [`saleem-v2/03_DATA_MODEL.md`](saleem-v2/03_DATA_MODEL.md) |
| AI pipeline | [`saleem-v2/04_AI_PIPELINE.md`](saleem-v2/04_AI_PIPELINE.md), [`GEMINI_INTEGRATION.md`](GEMINI_INTEGRATION.md) |
| Regulatory engine (every authority considered automatically) | [`saleem-v2/REGULATORY_ANALYSIS.md`](saleem-v2/REGULATORY_ANALYSIS.md), [`saleem-v2/02_SAUDI_RULES.md`](saleem-v2/02_SAUDI_RULES.md) |
| Roles, RBAC and the review flow | [`saleem-v2/RBAC.md`](saleem-v2/RBAC.md), [`saleem-v2/ROLES_AND_FLOW.md`](saleem-v2/ROLES_AND_FLOW.md) |
| Personal accounts and the individual demo | [`saleem-v2/PERSONAL_ACCOUNTS.md`](saleem-v2/PERSONAL_ACCOUNTS.md), [`DEMO.md`](DEMO.md) |
| AI Studio and smart correction | [`saleem-v2/AI_STUDIO.md`](saleem-v2/AI_STUDIO.md), [`saleem-v2/SALEEM_FIX_PROVIDERS.md`](saleem-v2/SALEEM_FIX_PROVIDERS.md) |
| Security audit | [`saleem-v2/SECURITY_AUDIT_V2.md`](saleem-v2/SECURITY_AUDIT_V2.md) |
| Release, pending migrations, rollback | [`saleem-v2/RELEASE_PLAN.md`](saleem-v2/RELEASE_PLAN.md) |
| Test plan | [`saleem-v2/06_TEST_PLAN.md`](saleem-v2/06_TEST_PLAN.md) |
| Brand (logo source and how the SVG is built) | [`brand/`](brand/), `scripts/brand/` |

## Regulatory evidence (never delete)

[`saleem-v2/legal/`](saleem-v2/legal/) — source verification register, SAMA/CMA mapping, legal-review checklist,
coverage notes; [`saleem-v2/data/`](saleem-v2/data/) — rule and source datasets and the URL-reachability check.

## Historical record (kept, not maintained)

- [`saleem-v2/progress/`](saleem-v2/progress/) and [`saleem-v2/phases/`](saleem-v2/phases/): per-phase plans and reports
  of the V2 build, and the final reports.
- [`saleem-v2/KICKOFF.md`](saleem-v2/KICKOFF.md), [`saleem-v2/AUTONOMOUS_RUN.md`](saleem-v2/AUTONOMOUS_RUN.md),
  [`saleem-v2/COMPREHENSIVE_UPGRADE.md`](saleem-v2/COMPREHENSIVE_UPGRADE.md),
  [`saleem-v2/01_REFERENCE_PRODUCT.md`](saleem-v2/01_REFERENCE_PRODUCT.md),
  [`saleem-v2/05_UX_SPEC.md`](saleem-v2/05_UX_SPEC.md), [`GEMINI_REVIEW.md`](GEMINI_REVIEW.md).
- [`saleem-v2/samples/`](saleem-v2/samples/): outputs of the authorised live Gemini and Studio runs (evidence).
- [`saleem-v2/screenshots/`](saleem-v2/screenshots/): screenshots taken when those features shipped; later decisions
  (D219–D224) changed the personal home and the rulebook.
- [`SALEEM_DEEP_CLEANUP_REPORT.md`](SALEEM_DEEP_CLEANUP_REPORT.md): the 2026-11-24 codebase cleanup.
