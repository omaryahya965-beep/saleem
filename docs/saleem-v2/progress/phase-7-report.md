# Phase 7 report — Expansion (P3)
Date: 2026-11-18 · Branch: v2/full-run · Commits: 6a024c3..52ce4a2 (tag v2-phase-7)

## Outcome
| # | Item | Flag | Built | Not built |
|---|---|---|---|---|
| 1 | Self-approval | `self_approval` | Org rules (channels, markets, roles; the RPC also takes product types and named users), with an AI requirement of `no_findings` (default) or `all_answered`; "nothing" is not offered. Eligibility is re-checked inside the RPC. The decision is a sealed `approve` with `actor_role = self_approval` and «اعتماد ذاتي». No conditional self-approval. Blocked by high-risk packs and by live flows. | A UI for the blocked packs: `org_settings.self_approval_blocked_packs` can only be set in SQL. (D132) |
| 2 | Public API + webhooks | `api` | API keys: hashed, scoped, expiring, revocable, 60 requests a minute, shown once. Read-only API v1 (promotions, findings, sealed decisions). Webhooks for `analysis.completed`, `review.submitted` and `review.decided`, signed with HMAC-SHA256, with retries and backoff and a delivery log. | Write endpoints: creating a promotion or version, upload URL, triggering analysis. (D133) |
| 3 | Slack / Teams | `notifications_chat` | Incoming-webhook targets on the same events: one Arabic line with a link, no finding text. | Design-tool and cloud-drive import (not requested). |
| 4 | Ask SALEEM | `ask_saleem` | A read-only `ask` function that runs with the caller's JWT (RLS applies). It searches rules, promotions and findings and returns numbered sources with links. The configured model only rephrases from those sources; without a key, the raw results are shown. | Metrics questions (use `/analytics`). (D135) |
| 5 | CMA / insurance packs | — | They stay **drafts**. `docs/saleem-v2/legal/LEGAL_REVIEW_CHECKLIST.md` lists all 36 draft SAMA/CMA rules with their sources and the checks to do. The insurance pack has no rules until the Insurance Authority's current requirements are confirmed. | Activation (needs a human legal review). |
| 6 | Calibration report | platform admins | `/admin/calibration` shows per rule: findings, reviewer agreement, dismiss rate and the top dismiss reasons. Suggestions are notes only and never edit a rule. | — |
| 7 | Readability hint | `readability_hint` | Flags very long sentences (> 35 words) and dense footnotes, shown beside the report as a hint and never as a finding. | Transcript text (only caption and text are checked). (D136) |

## Tests
- pgTAP: `p7_self_approval`, `p7_api_webhooks`, `p7_calibration`. Vitest: backend `webhooks` (HMAC against
  node:crypto), `ask`; frontend readability.
- Gate: lint ✓ (0 errors) · typecheck ✓ · unit ✓ (85 frontend + 144 backend) · deno check ✓ (10 functions) ·
  build ✓ · db reset **not run** (PGlite ✓: every migration, the seed and 18 pgTAP files) · e2e ✓ 33 offline; the 12
  `public.spec` cases need a live database · creator eval = baseline 9/8/0 · eval v2 ✓ 24/24.
- **Not run:** live webhook delivery, Slack/Teams delivery, the API against a deployed function, and Ask with a
  model. All of them need a running Supabase and outbound network.

## Deviations
D132–D137.
