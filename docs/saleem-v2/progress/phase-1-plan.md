# Phase 1 plan — Promotions, versions, context, products

## Discovery
- Submission insert path: `createSubmission` (`data.ts`) inserts the row then fires `triggerAnalysis`.
  One `before insert` trigger (`submissions_initial_state` → `submissions_force_initial_state()`) forces the
  initial state, quota, clip length, batch and org/campaign checks. `submissions_v2_*` sorts after it.
- Context today lives on the submission: `platform`, `is_paid_ad`, `product_category`, `has_written_contract`,
  `ai_used`, `mawthooq_license_no`, `caption`, `title`, `org_id`, `campaign_id`.
- Re-check = `/new?parent=<id>`; the report compares with `parent_id` findings (`fetchReport`, `diffFindings`).
- Demo/seed submissions have `user_id = null` → `promotions.owner_id` must be nullable.
- The shell is a header nav (`SiteShell.tsx`), not a sidebar → add entries there (D79).
- `org_role_of` / `is_org_member` already do what `member_role` would → reused (D78).
- Account deletion deletes sole-owner orgs first → `promotions.org_id` must not be `restrict` (D80).

## Tasks
| # | Slice | Files |
|---|---|---|
| 1 | M1 promotions (done: a3ac8c7) | migration, rollback, `tests/p1_promotions.test.sql`, account fn |
| 2 | M2 products + org_settings, product/org match trigger, `approve_product` RPC | migration, rollback, `tests/p1_products_settings.test.sql` |
| 3 | Types: `types/supabase.ts` (hand-written to match SQL — no local DB to generate, D81); shared `ProductKeyFacts` in `_shared/products/key-facts.ts` + frontend copy with a sync test | types, shared module, tests |
| 4 | Data layer `lib/api/promotions.ts` + hooks | api, tests |
| 5 | `/new` context step (org members: product, channels, communication type, audience, distribution, licence, deadline, reviewer notes; personal: today's form); `?promotion=` adds a version | `NewCheckPage.tsx`, route search |
| 6 | Promotion page `/promotions/$id?v=N` (header, version switcher, tabs الملاحظات/المعلومات, «رفع إصدار جديد», context edit + «أعد التحليل»); `/checks/$id` redirects | feature `promotions/`, routes |
| 7 | Promotions list `/promotions` with filters + search; nav entry | feature, route, SiteShell |
| 8 | Products `/products` (admins edit, members read, approve, new version via `supersedes_id`) | feature, route |
| 9 | Org settings basic (sector, brand aliases) on the org page | `OrgPages.tsx` |
| 10 | i18n (ar/en), gate, report | — |

## Tests
pgTAP: backfill fixture (3 chains + demo re-check), old path, explicit path, lock, RLS (owner/org/outsider/anon),
column privileges; products/org_settings RLS + approval. Vitest: key-facts validation, version switcher,
`/checks/$id` redirect target, product form validation. E2E: new spec with mocked network (D76).

## Risks
- Redirect from `/checks/$id` must keep demo/sample links working for anonymous visitors (anon can read
  demo promotions).
- Orphan empty promotion if the first upload fails → owner may delete an empty draft (policy) and the
  client cleans up.
