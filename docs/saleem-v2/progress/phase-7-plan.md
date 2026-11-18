# Phase 7 plan — Expansion (P3)

Autonomous run (AUTONOMOUS_RUN §1): build items 1, 2, 3 (Slack/Teams only), 4, 6 and 7, each behind an org flag
(default off). For item 5, make sure the CMA and insurance packs exist **as drafts** with a legal-review checklist;
never activate them.

## Discovery
- Flags: `org_feature()` and the flags card from Phase 6 are reused. New flags: `self_approval`, `api`,
  `notifications_chat`, `ask_saleem`, `readability_hint`. Calibration is a platform-admin report and has no org flag.
- Decisions: `write_decision` (sealed). Uploader responses: `finding_responses.actor_role = 'uploader'`.
- Notifications are rows in `notifications` plus `review-notify` (email). Chat webhooks reuse the same events.
- Rule packs: `rule_packs` in the 2026.11-v2 release. CMA and insurance rules are drafts (Phase 2), never active.

## Items
| # | Flag | Slice |
|---|---|---|
| 1 | `self_approval` | `self_approval_rules` (channels, product types, markets, roles, users, AI requirement `no_findings` default / `all_answered`; `nothing` is not offered); `can_self_approve` + `self_approve` re-check at click time; sealed `approve` with `actor_role = 'self_approval'` and «اعتماد ذاتي»; no conditional approval; blocked packs; blocked inside a multi-level flow |
| 2 | `api` | org API keys (hashed, scoped, expiring, revocable, rate-limited); `api` function: create promotion, read promotions, findings, decisions, signed upload URL, trigger analysis; webhooks with HMAC, retries with backoff and a delivery log |
| 3 | `notifications_chat` | Slack / Teams incoming-webhook targets on the same events (the delivery queue from item 2) |
| 4 | `ask_saleem` | read-only `ask` function run with the caller's JWT (RLS applies): retrieves rules, promotions, findings and metrics, answers with links; uses the model only to phrase the answer; cannot write |
| 5 | — | CMA and insurance packs stay drafts; `docs/saleem-v2/legal/LEGAL_REVIEW_CHECKLIST.md` |
| 6 | — | `calibration_report` (platform admins): per rule — findings, reviewer agreement, dismiss rate, common dismiss reasons; suggestions are notes only, never rule edits |
| 7 | `readability_hint` | pure hint (very long sentences, dense footnotes) shown beside the report, never a finding |
