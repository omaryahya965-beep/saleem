# Phase 5 — Claims, disclaimers, product facts, dashboard (P1)

**Goal:** organisations maintain approved claims (with substantiation), approved disclaimers and product
facts; the analysis checks ads against them; reviewers fix library gaps from the finding itself; users
get a role-aware dashboard, saved views and exports.

**User problem:** most real issues in financial ads are numbers and claims ("lowest rate", "0 fees",
"50,000 customers") that are true or false only relative to what the institution has approved.

**Preconditions:** Phase 4 accepted. Read `01_REFERENCE_PRODUCT.md` §G–H, `03_DATA_MODEL.md` M8,
`04_AI_PIPELINE.md` §6.4.

## 5.1 Tasks

1. **Migration M8** + rollback: `pg_trgm`; `claims`, `promotion_claims`, `disclaimers`, `saved_views`,
   `org_rule_overrides`; private storage bucket `evidence` with RLS by `{org_id}/...`; reminder cron for
   `claims.next_review_at` (7 days before and on the day, via notifications) and expiry
   (`expires_at` passed → `expired`).
2. **Claims library UI** `/claims`: list (status, products, next review), detail with versions, create
   (name, Arabic text, English text optional, products, channels, communication types, substantiation
   files/URLs — at least one required to submit, next review date), submit for review, reviewer
   approve/reject/request changes with reasons (`rejection_reasons.kind = 'claim'`), new version from an
   approved claim, archive (admin). Normalised text and numbers computed server-side (RPC or trigger).
3. **Claim matching** in `analyze` (`_shared/claims/match.ts`): schema v2 gets `claims_detected[]`
   (quote + location) from the model; deterministic candidates add sentences containing numbers or
   superlatives; matching per `04_AI_PIPELINE.md` §6.4; findings under `SYS-CLAIMS` with class in
   `citation.claim_class` and the matched claim id/version.
4. **Fix from the finding** (RPCs with permission checks): `claim_review_from_finding` (approve matching
   unapproved claim), `claim_compare_and_approve` (similar wording), `claim_extend_scope` (new version with
   the promotion's product/channel/communication type added), `claim_add_from_finding` (prefilled draft;
   substantiation required). On success: link claim to promotion (`finding_fix`), resolve every finding of
   the promotion pointing to that claim, event. Creators without review rights get «أُرسل للاعتماد» and
   the finding shows «بانتظار اعتماد الادعاء».
5. **Manual linking**: link approved claims to a promotion in the Info tab; linked claims are always
   checked.
6. **Disclaimers library** `/disclaimers` (admins): versions, scope, `required_by_rule_codes`, prominence
   flag; platform templates (org_id null) for SAMA statements — supervision statement and exchange-rate
   statement — **as editable templates marked «صيغة مقترحة — راجعها قانونياً»**, not official text.
   Disclaimer check in `analyze` per `04_AI_PIPELINE.md` §6.4.
7. **Product facts UI polish**: show which facts were used in the last analysis of each promotion.
8. **Org rule overrides**: org admins narrow a rule's scope with a reason (e.g., exclude a channel);
   overrides are audited, shown on the rule page, applied in `selectRules`.
9. **Dashboard** `/`: for creators — my promotions needing action (responses missing, changes requested,
   conditional); for reviewers — assigned to me, unassigned in scope, overdue; for admins — counts by
   status, overdue, items waiting on legal, claims due for review. All counts link to filtered lists.
10. **Saved views + CSV export** for promotions (columns + status history from events), queue and claims.

## 5.2 Tests

- Claim normalisation and matching: exact, Arabic variants (hamza/taa marbuta/digits), similar wording
  below/above threshold, number mismatch («50 ألف عميل» vs approved «45,000»), out-of-scope product,
  expired claim.
- Fix RPC permissions (review+create, review-only, create-only) and the "one fix resolves all findings
  for the same claim" rule; resolved findings stay resolved after later claim changes.
- Disclaimer presence (exact, minor variations, missing) and prominence labelling.
- RLS for all new tables and the `evidence` bucket.
- E2E: case 4 end-to-end — ad claims «الأقل تكلفة في المملكة» → `SYS-CLAIMS` `needs_evidence` → reviewer
  adds claim with substantiation and approves → finding resolved → re-analysis passes the claim check.

## 5.3 Acceptance criteria

- [ ] Claims and disclaimers have versions, review and audit; substantiation files are private.
- [ ] Analysis raises the six claim classes correctly on labelled cases; numbers compared after
      normalisation.
- [ ] Reviewers can resolve library gaps without sending the ad back to marketing.
- [ ] Dashboard, saved views and exports work for each role.
- [ ] Gate checks pass; report written; PROGRESS updated.
