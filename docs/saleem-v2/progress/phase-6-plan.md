# Phase 6 plan — Enterprise workflows (P2)

## Discovery
- Flags live in `org_settings.features` (jsonb object, default `{}`). Nothing reads them yet. A new SQL helper,
  `org_feature(_org, _key)`, returns `false` unless the flag is exactly `true`. The UI reads the same object.
- The review state machine (`submit_promotion`, `can_decide`, `decide_promotion`, `write_decision`) is in
  `20261117030100_v2_review.sql`. A new migration replaces those function bodies (same signatures); applied
  migrations are never edited.
- `review_decisions.decision` has a check constraint. It is widened, not replaced: it adds `risk_accept` and
  `risk_decline`, plus a nullable `step_id`.
- New enum values go in their own migration: `promotion_review_status` gets `reviewing_risk`, `risk_accepted` and
  `due_for_rereview`; `org_role` gets `external_uploader` and `external_reviewer`. Values added to an enum
  can't be used in the same transaction that adds them.

## Order and scope (file order, each behind its flag, default off)
| # | Flag | Slice |
|---|---|---|
| 6.1 | `multi_level_approval` | presets, preset steps, auto-apply, live steps; `submit_promotion` creates the flow; `decide_promotion_step` (D123); `can_decide` blocks single decisions while a flow is live; carry-forward; preset replacement discards decisions; settings UI + step panel |
| 6.2 | `risk_acceptance` | `can_accept_risk`; `request_risk_acceptance` / `decide_risk`; label «قبول مخاطر — ليس اعتماداً من الالتزام» |
| 6.3 | `partners` | `partner_links` (hashed token), partner submission RPC, external roles, «إرسالاتي», isolation tests |
| 6.4 | `upload_types` | `submission_assets`, carousel analysed together, variations group |
| 6.5 | `lifecycle` | evergreen + `next_review_at`, re-review cron, lifecycle dates, withdrawal request with one Saudi business day |
| 6.6 | `analytics` | `org_metrics` RPC from events/decisions, business-day SLA, page with linked numbers, fixture test |
| 6.7 | `internal_rules` | brand-guideline upload, model-assisted draft (mocked locally), admin edits and approves, «سياسة داخلية» |

## RLS
- Presets and steps: org members read them; owners and admins write them through RPCs only.
- `promotion_review_steps`: readable when `can_read_promotion`; writes through RPCs only.
- `partner_links`: owners and admins read them, without the hash column; the public path goes only through a
  security-definer RPC that takes the raw token.
- External users see only the promotions they submitted (uploader) or were assigned (reviewer).
  `can_read_promotion` is extended for this, and each path has a pgTAP isolation test.

## Rules kept
Human approval only. Separation of duties: nobody decides on their own upload, and nobody acts on two steps.
Decisions are sealed. Risk acceptance is never counted as approval. Coverage stays honest. A sub-feature that is
still red after three attempts is reverted and reported as "not done".
