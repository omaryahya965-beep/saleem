# Phase 6 — Enterprise workflows (P2)

All features here are behind `org_settings.features` flags and default to off. Build them one at a time;
each sub-feature is shippable alone. Ask the user which order matters most before starting (autonomous
full run: build 6.1 → 6.7 in file order without asking; see `AUTONOMOUS_RUN.md`).

**Preconditions:** Phase 5 accepted. Read `01_REFERENCE_PRODUCT.md` §B, §F, §I, §J and
`03_DATA_MODEL.md` M9.

## 6.1 Multi-level approval (`features.multi_level_approval`)

- Presets per org: sequential or parallel; steps by role or named users; one default preset; auto-apply
  by market and optionally product type (locked in the submit form with «مطلوب حسب إعدادات المنظمة»).
- A person cannot act on two steps of the same flow; nobody acts on their own upload.
- Tables from `03_DATA_MODEL.md` M9: `approval_presets`, `approval_preset_steps` (template) and
  `promotion_review_steps` (the live copy for one submission).
- Step decisions reuse `decide_promotion` with a `step_id` (= `promotion_review_steps.id`); the promotion becomes `approved` only when
  all required steps approve (parallel) or the last step approves (sequential). Reject or request changes
  at any step stops the flow. Conditional approval and escalation are not available inside multi-level
  flows (keep it simple; document).
- Resubmission: the submitter chooses which approved steps to carry forward unless the preset changed or a
  reviewer required a fresh review; sequential flows resume at the first non-carried step.
- Editing a live flow (admins): replacing the preset discards recorded step decisions (event + warning).
- Tests: sequential, parallel, carry-forward, SoD, preset change discards.

## 6.2 Risk acceptance (`features.risk_acceptance`)

- `org_members.can_accept_risk`. From `rejected` or `changes_requested`, the uploader may escalate to a
  risk acceptor → `reviewing_risk`; the acceptor accepts (→ `risk_accepted`, decision row with reason) or
  declines (→ back to the previous status). Risk acceptance is labelled «قبول مخاطر — ليس اعتماداً من
  الالتزام» everywhere and is excluded from approval metrics.

## 6.3 External partners (`features.partners`)

- `partner_links` (token stored hashed), public submission page: one promotion at a time, terms
  acceptance, allowed products/channels, intro text and logo of the org.
- First submission creates an `external_uploader` member (email OTP sign-in via Supabase Auth) and notifies
  admins to approve access. Partners see only their own promotions («إرسالاتي»: status, deadline, decision,
  comments unless `hide_comments_from_external`).
- `external_reviewer`: named assignment only, scoped queue, cannot reassign or edit flows.
- Keep the existing brand share link working; offer migration of an existing share flow to partner links.
- Isolation tests for every external path.

## 6.4 Upload types (`features.upload_types`)

- Verify the existing batch feature first; extend it so each item becomes its own promotion.
- Carousel: several assets in one version (`submission_assets`), analysed together (disclaimer on any
  frame counts), one decision. Case 8.
- Variations: a group of linked promotions sharing context, each decided separately; bulk submit.

## 6.5 Evergreen and lifecycle (`features.lifecycle`)

- Approving an evergreen promotion requires `next_review_at` in the future; a daily cron moves due items
  to `due_for_rereview` (back into the queue) and notifies.
- Lifecycle dates in the Info tab: published, taken down, withdrawn with reason. «طلب سحب» for
  regulator-requested withdrawals: record when SAMA's notification was received and set
  `withdrawal_due_at` to one business day after it (SAMA Art. 17; Sun–Thu working week plus an optional
  org holiday list), with reminders to the owner and admins. Show it as a deadline, never as legal advice.

## 6.6 Analytics (`features.analytics`)

Compute only from events/decisions (RPC `org_metrics(_org, _from, _to, _filters jsonb)`), Saudi business
days (Sun–Thu) for SLA, filters: product, channel, communication type, uploader, reviewer, tags.

| Metric | Definition |
|---|---|
| Promotions submitted | promotions with a `submitted` event in range (drafts excluded) |
| Versions submitted | `submitted` events in range |
| Average versions | versions submitted ÷ promotions submitted (min 1.0) |
| Early requests | submissions whose deadline is sooner than the SLA ÷ submissions |
| SLA compliance | reviews decided within SLA business days ÷ reviews decided (0 when none) |
| First-time approval | promotions whose first decision is `approve` ÷ promotions with a first decision (created in range) |
| Approval time | first `submitted` → first `approve` (mean, median) |
| First response time | first `submitted` → first reviewer action (response, comment or decision) |
| Iterations | submissions before approval (first = 0), mean and median |
| Reasons | count of each reason on reject/request-changes decisions (each reason counts) |
| Workload | decisions per reviewer; open items per reviewer |
| Volume | promotions by product, channel, communication type, status |

Charts with the existing UI stack; every number links to the filtered list. Fixture tests compare RPC
output with hand-computed values.

## 6.7 Brand-guideline pack (`features.internal_rules`)

Org admins upload brand guidelines; SALEEM drafts internal rules (model-assisted) that an admin must edit
and approve before they run; labelled «سياسة داخلية». Case 9.

## 6.8 Acceptance

Each enabled sub-feature has: RLS/permission tests, e2e in Arabic, fixture-checked metrics where relevant,
and an entry in the phase report. No sub-feature weakens P0/P1 guarantees (human approval, SoD, sealed
decisions, honest coverage).
