# SALEEM roles and permissions (D168, 2026-11-19)

One model for every organisation and every user. Permissions come from the user's **membership role in the active
organisation**, never from an email or account. Sources of truth:

- **Actions:** `frontend/src/lib/permissions.ts` (UI `can()`), mirrored in SQL `org_role_can` / `org_can`;
  `backend/supabase/tests/p8_roles_matrix.test.sql` is generated from it and fails if they differ.
- **Pages (sidebar + route guard):** `PAGE_ROLES` in `frontend/src/components/layout/navModel.ts`.
- **Data:** RLS policies and SECURITY DEFINER RPCs. Hiding a page is never the security boundary.

## Pages per role

| Page | Owner | Admin | Comp. lead | Reviewer | Legal | Marketer | Partner | Ext. reviewer | Viewer |
|---|---|---|---|---|---|---|---|---|---|
| الرئيسية Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| الإعلانات Advertisements | all | all | all | all | all | own/shared | own | shared | all (read) |
| فحص جديد New | ✓ | ✓ | – | – | – | ✓ | partner link only | – | – |
| طابور المراجعة Review queue | ✓ | ✓ | ✓ | ✓ | escalations | – | – | – | – |
| الدليل التنظيمي Rulebook | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | public page, not in menu | public page, not in menu | ✓ |
| قواعد الشركة Company rules¹ | manage | manage | manage | – | – | – | – | – | read |
| الادعاءات / الإفصاحات / المنتجات Libraries | manage | manage | read² | read² | – | read² | – | – | read |
| الفريق والمساحة Team | manage | manage³ | – | – | – | – | – | – | read |
| الأدوار والصلاحيات Roles | manage | manage³ | – | – | – | – | – | – | read |
| الميزات Features | ✓ | ✓ | – | – | – | – | – | – | – |
| التحليلات Analytics¹ | ✓ | ✓ | ✓ | – | – | – | – | – | ✓ |
| سجل التدقيق Audit log | ✓ | ✓ | ✓ | – | – | – | – | – | ✓ |
| اسأل سليم Ask¹ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ |

¹ Also needs the organisation feature flag. ² Claims: these roles may draft/propose; disclaimers and products are
managed by owner/admin only. ³ Never grants or removes the Owner role (`set_org_member_role`).
A hidden page opened by URL shows «هذه الصفحة ليست ضمن صلاحيات دورك».

## Actions (server-enforced)

| Action | Who | Enforced by |
|---|---|---|
| Create advertisement | owner, admin, marketer; partner via link | `promotions_insert`, `partner_create_promotion` |
| Submit for review | own advertisements | `can_submit` |
| Assign reviewer | owner, admin, lead; reviewer **self only** | `assign_reviewer` |
| Decide (approve / request changes) | owner, admin, lead, reviewer — **never the uploader** | `can_decide` (`separation_of_duties`) |
| Legal opinion | legal only — never an approval | `respond_escalation` |
| Members / roles | owner; admin except Owner role | `set_org_member_role`, `create_org_invite` |
| Company rules | owner, admin, lead write; approval by a **second** manager | `save_internal_rule`, `approve_internal_rule` |
| Claims library writes | owner, admin, lead, reviewer, marketer | `save_claim`, `new_claim_version`, `submit_claim`, `claim_add_from_finding` |
| Organisation analytics | owner, admin, lead, viewer | `org_metrics` → `org_can('view_analytics')` |
| Viewer | read-only everywhere | every write RPC / RLS (tested) |

## Verified by

`backend/tests/rbac.test.ts` (local stack): a new organisation with a new user per role (invite flow), a second
organisation, multi-org users, role changes, viewer and external writes, separation of duties, cross-org access.
`frontend/src/test/nav-model.test.ts`: exact sidebar per role and the route guard.

## Known, accepted

- The audit page reads `review_events`, which members may already read per advertisement (its history tab); hiding
  the page for reviewer/legal/marketer is navigation scope, not extra secrecy.
- `/rules` is a public page (also signed out); externals simply do not get it in their menu.
- Claims/disclaimers/products remain readable through the API by legal (internal reference data); legal has no menu
  entry for them.
