# Phase 7 — Expansion (P3)

Optional capabilities. Start only after P0–P2 are stable in production and the user picks items.
Autonomous full run: build the items listed in `AUTONOMOUS_RUN.md` §1, each behind a flag (default off);
item 5 stays draft — never activate a regulatory pack.

1. **Self-approval** (`features.self_approval`): org rules by channel, product type, market, people/roles
   and AI requirement (`nothing` is not offered; minimum is "all AI findings answered", default "no
   automated findings"). Eligibility is re-checked inside the RPC at click time; the record shows the
   uploader as approver with a «اعتماد ذاتي» qualifier; uploaders can never conditionally approve their
   own work. Not available for rules packs marked high-risk by the org.
2. **Public API and webhooks**: org API keys (hashed, scoped, expiring, revocable); endpoints to create a
   promotion/version (file upload via signed upload URL), trigger/read analysis, read findings and
   decisions; webhooks `analysis.completed`, `review.submitted`, `review.decided` signed with HMAC,
   retries with backoff, delivery log; rate limit per key.
3. **Integrations**: Slack/Teams notifications; design-tool or cloud-drive import only if users ask.
4. **Ask SALEEM** (read-only assistant): answers about rules, promotions, findings and metrics, executed
   with the caller's JWT so RLS applies; cites links; cannot change anything.
5. **CMA pack activation** after legal review (Annex 5-1 read in full); **insurance pack** after the
   Insurance Authority's current advertising requirements are confirmed.
6. **Calibration report**: per rule — findings, reviewer agreement, dismiss rate, common dismiss reasons;
   suggestions for instruction/lexicon changes that a platform admin must review and publish as a new rule
   version. Never auto-edit rules.
7. **Arabic readability hint** (optional): flags very long sentences or dense footnotes; never a
   compliance finding.

Each item needs its own plan, tests and report, following the master protocol.
