# Phase 1 — Promotions, versions, context, products (P0)

**Goal:** introduce the Promotion container with immutable, numbered versions and a formal ad context,
plus a minimal product library and org settings — without breaking any existing flow or link.

**User problem:** today a "check" is a single analysis. Compliance teams think in *advertisements* that go
through V1, V2, V3 until approved, and the rules that apply depend on the product, channel and audience.

**Preconditions:** Phase 0 accepted. Read `03_DATA_MODEL.md` M1–M2 and `05_UX_SPEC.md` §1–3.

## 1.1 Discovery

- Re-read `submissions` DDL and every trigger on it (`submissions_force_initial_state`, quota, clip
  length, org membership).
- Read `lib/api/data.ts` `createSubmission` (~L292), `triggerAnalysis` (~L393), `fetchReport` (~L161),
  `hooks.ts`, `NewCheckPage.tsx`, `CheckPage.tsx`, `ReportView.tsx`, `model.ts`, archive feature, routes.
- Find where platform / paid / product category are stored and how the report shows the parent
  comparison («ما أُصلح وما بقي»).

## 1.2 Tasks

1. **Migration M1** (`v2_promotions`) with rollback: enums, `promotions`, `submissions.promotion_id/
   version_no`, backfill (chains → promotions), `submissions_v2_attach_promotion` and
   `submissions_v2_set_current` triggers, `member_role`/`can_read_promotion` helpers (reuse existing ones if
   equivalent), RLS, column privileges, indexes. Extend submission read access via promotion membership
   without weakening existing rules.
2. **Migration M2** (`v2_products_org_settings`) with rollback: `products`, `org_settings` (+ default row
   per org and trigger for new orgs), FK `promotions.product_id`.
3. **Types:** regenerate `frontend/src/types/supabase.ts`; add shared TS types for `ProductKeyFacts`
   (one module imported by frontend and functions, or duplicated with a sync test).
4. **Data layer** (`frontend/src/lib/api/promotions.ts`, keep `data.ts` working):
   `listPromotions(filters)`, `getPromotion(id)` (promotion + versions summary), `createPromotion(context,
   firstFile)` (inserts the promotion, then reuses the existing upload + `createSubmission` path with
   `promotion_id`), `addVersion(promotionId, file)`, `updatePromotionContext(id, patch)`,
   `listProducts`, `upsertProduct`, `approveProduct`. React Query hooks with keys `['promotion', id]`,
   `['promotions', filters]`, `['products', orgId]`.
5. **New promotion flow** (evolve `NewCheckPage`): upload step unchanged; context step per
   `05_UX_SPEC.md` §3. Personal creators: today's short form; their promotions default to
   `communication_type = 'creator_sponsored'`. Org members: product select (approved + draft, marked),
   channels, communication type (default `financial_promotion` when org sector is financial), audience,
   paid, distribution, Mawthooq licence when influencer, deadline, caption, reviewer notes.
6. **Promotion page** `/promotions/$id?v=N`: header with version switcher (V1…Vn, "Latest"), the existing
   report for the selected version inside the new layout (asset viewer + side panel with «الملاحظات» and
   «المعلومات» tabs for now), «رفع إصدار جديد» action. `/checks/$id` redirects to the promotion page with
   the right `v`.
7. **Promotions list** `/promotions` with filters (status, product, channel, communication type) and
   search; sidebar entry; archive route redirects or keeps working.
8. **Products page** `/products` (admins edit, members read): key facts form with validation; status
   draft → approved by admin (records `approved_by/at`); approved products become read-only (edit = new
   version row with `supersedes_id`).
9. **Org settings (basic)**: sector and brand aliases in org settings UI.
10. **Context change after analysis**: editing context on a draft promotion shows «تغيّر السياق — أعد
    التحليل لتطبيق القواعد المناسبة» with a button that triggers a re-run for the current version (use
    the existing re-run mechanism; add a `rerun` flag to `analyze` if needed, idempotent).
11. **i18n** for every new string (ar/en).

## 1.3 Tests

- Backfill on a fixture: three chains (1, 2 and 3 versions) → three promotions; version numbers 1..n by
  `created_at`; `current_version_id` = latest; nothing else changed in `submissions`.
- Insert without `promotion_id` (old path) creates a promotion and version 1; insert with `parent_id`
  continues numbering; concurrent inserts do not duplicate `version_no`.
- Adding a version to an `approved` promotion → `code:promotion_locked` (status can be set in the test via
  service role).
- RLS: owner, org member, outsider for `promotions`, `products`, `org_settings`; column privilege —
  updating `review_status` as authenticated fails.
- Frontend: version switcher, redirect from `/checks/$id`, product form validation.
- E2E (ar + en): create promotion with context → analysis completes (mocked) → add version → V2 shown.

## 1.4 Acceptance criteria

- [ ] All legacy submissions belong to exactly one promotion with correct `version_no`; no data loss
      (row counts before/after recorded in the report).
- [ ] Every existing route still works; `/checks/$id` lands on the right version.
- [ ] The old creation path (no promotion id) still works.
- [ ] Promotion context is stored and visible; products can be created and approved by admins only.
- [ ] RLS isolation passes for new tables; review fields cannot be changed from the client.
- [ ] Gate checks pass; report written; PROGRESS updated.

## 1.5 Out of scope

Rule changes, review workflow, comments, PDF.

## 1.6 Risks

Trigger ordering with existing submission triggers (test it); backfill on large tables (batch if > 50k
rows); share links and the compliance log keyed by submission id (keep them per version).
