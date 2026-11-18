# Phase 1 report — Promotions, versions, context, products
Date: 2026-11-18 · Branch: v2/full-run · Commits: a3ac8c7..(tag v2-phase-1)

## Outcome
Every check now belongs to a promotion (إعلان) with numbered versions V1…Vn. Organisation uploaders describe the ad
(product, channels, communication type, audience, distribution, licence, deadline, reviewer notes); the promotion
page shows each version's existing report with a version switcher, the review status, the advisory automated result
and an editable context with a re-run prompt. Organisations manage products with key facts (approve → read-only, a
new version supersedes) and basic settings (sector, brand names). Old `/checks/$id` links land on the right version.

## Acceptance criteria
| Criterion | Status | Evidence |
|---|---|---|
| Legacy submissions → exactly one promotion, correct `version_no`, no data loss | met on fixtures; real row counts **not run** | `p1_promotions.test.sql` §1: 3 chains + a demo re-check → 4 promotions, v1..n by `created_at`, current = latest, idempotent, no NULL `promotion_id`. On a copy of production: `select count(*) from submissions where promotion_id is null` → 0 |
| Every existing route works; `/checks/$id` lands on the right version | met | e2e `promotions.spec.ts` (redirect), `signed-in.spec.ts` |
| Old creation path still works | met | `p1_promotions.test.sql` §2 (no promotion id; parent_id re-check → V2) |
| Context stored and visible; products created/approved by admins only | met | `p1_products_settings.test.sql`; Info tab; `/products` |
| RLS isolation for new tables; review fields not client-writable | met on PGlite smoke; live **not run** | `p1_promotions.test.sql` §3–4, `p1_products_settings.test.sql` |
| Gate, report, PROGRESS | met | below |

## Changes
- Migrations (+ rollbacks): `20261117010000_v2_promotions.sql` (enums, promotions, version columns, backfill
  function, attach/current triggers, `promotion_locked`, RLS, column privileges); `20261117010100_v2_products_org_settings.sql`
  (products, approve/archive RPCs, read-only guard for approved rows, org-match trigger, org_settings + default rows).
- Edge Functions: `account` removes the user's empty promotions; shared `_shared/products/key-facts.ts`.
- Frontend: `/promotions`, `/promotions/$id?v=N`, `/products`, `/new` context step and `?promotion=`, org settings
  card, nav entries, `lib/api/promotions.ts`, `lib/key-facts.ts`, `/checks/$id` redirect.
- i18n: ~260 keys per language (`promo.*`, `products.*`, `orgSettings.*`, `common.yes/no/none`, `nav.*`).

## Tests
- Added: pgTAP `p1_promotions`, `p1_products_settings`; Vitest `key-facts`, `promotions`, `product-form`;
  Playwright `promotions.spec.ts`.
- Gate: lint ✓ (0 errors, 17 pre-existing warnings) · typecheck ✓ · unit ✓ (52 frontend, 97 backend + 7 skipped) ·
  deno check ✓ (4 functions) · db reset **not run** (PGlite smoke ✓) · isolation **not run** · build ✓ ·
  e2e ✓ 24/24 (promotions + signed-in; ar/en desktop, ar mobile) · public e2e **not run** (needs hosted demo data, D76).

## Not done / deviations
- `/archive` keeps working unchanged (no redirect; the list does not yet cover batches).
- Header nav instead of a sidebar (D79); types extended by hand (D81).

## Risks and follow-ups
- The backfill runs inside the migration: check the size of `submissions` on production first (batch if > 50k).
- «أعد التحليل» on the Info tab is shown to the uploader of the current version only (`rerun_submission` checks
  `user_id`); other admins see the prompt without the button.

## Decisions recorded
D78–D87.

## How to verify manually
1. `npx supabase db reset --workdir backend`, then `npx supabase test db --workdir backend`.
2. As an org owner: «المنتجات» → «إضافة منتج» «تمويل شخصي المثال» (المعدل ٤٫٥ ثابت، 6–60 شهراً) → «اعتماد المنتج».
3. «إعلان جديد» in the organisation → fill «سياق الإعلان» with the product → submit → promotion page, V1.
4. «رفع إصدار جديد» → upload → V2 is selected; switch back with «إ1».
5. «المعلومات» → «تعديل السياق» → change channels → save → banner «تغيّر السياق» with «أعد التحليل».
6. Open an old `/checks/<id>` link → it lands on `/promotions/<id>?v=N`.
