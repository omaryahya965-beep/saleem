// The application navigation, derived from the permission matrix (lib/permissions.ts) — not a second permission
// system. Visibility only: every action is still enforced by the server (RLS, RPCs, org_can).
import { can, type OrgRole } from "@/lib/permissions";

export type NavKey =
  | "dashboard"
  | "promotions"
  | "new"
  | "queue"
  | "archive"
  | "rules"
  | "companyRules"
  | "claims"
  | "disclaimers"
  | "products"
  | "team"
  | "roles"
  | "features"
  | "analytics"
  | "audit"
  | "ask"
  | "adminMetrics"
  | "adminRules"
  | "adminEval"
  | "adminCalibration";

export interface NavEntry {
  key: NavKey;
  to: string;
  /** Path prefixes that mark the entry active. */
  match: string[];
}
export interface NavGroup {
  key: "work" | "compliance" | "organization" | "support" | "platform";
  items: NavEntry[];
}

export interface NavInput {
  /** Role in the active organisation; null for a personal account (no organisation). */
  role: OrgRole | null;
  orgId: string | null;
  /** Feature flags of the active organisation (org_settings.features). */
  flags: Record<string, boolean>;
  platformAdmin: boolean;
}

const e = (key: NavKey, to: string, ...match: string[]): NavEntry => ({
  key,
  to,
  match: match.length ? match : [to],
});
const EXTERNAL: OrgRole[] = ["external_uploader", "external_reviewer"];

export function buildNav({ role, orgId, flags, platformAdmin }: NavInput): NavGroup[] {
  const personal = role === null;
  const external = role !== null && EXTERNAL.includes(role);
  const internal = role !== null && !external;
  const groups: NavGroup[] = [];

  const work: NavEntry[] = [
    e("dashboard", "/dashboard"),
    e("promotions", "/promotions", "/promotions", "/checks"),
  ];
  // Partners create only through their partner link (matrix: «عبر رابط الشريك فقط»), never from /new.
  if (personal || (internal && can(role, "create_promotion"))) work.push(e("new", "/new"));
  if (can(role, "decide_review") || can(role, "assign_reviewer") || can(role, "legal_opinion"))
    work.push(e("queue", "/queue"));
  // The pre-v2 checks archive belongs to personal (creator) accounts.
  if (personal) work.push(e("archive", "/archive"));
  groups.push({ key: "work", items: work });

  const compliance: NavEntry[] = [e("rules", "/rules")];
  if (internal) {
    if (can(role, "manage_company_rules") && flags["internal_rules"])
      compliance.push(e("companyRules", "/company-rules"));
    // Libraries are readable by every internal member (writes are role-checked on their pages and the server).
    compliance.push(
      e("claims", "/claims"),
      e("disclaimers", "/disclaimers"),
      e("products", "/products"),
    );
  }
  groups.push({ key: "compliance", items: compliance });

  if (internal && orgId) {
    const org: NavEntry[] = [e("team", `/org/${orgId}`, "/org"), e("roles", "/roles")];
    if (can(role, "manage_settings")) org.push(e("features", "/features"));
    if (can(role, "view_analytics") && flags["analytics"]) org.push(e("analytics", "/analytics"));
    if (role !== "creator") org.push(e("audit", "/audit"));
    groups.push({ key: "organization", items: org });
    if (flags["ask_saleem"]) groups.push({ key: "support", items: [e("ask", "/ask")] });
  }

  if (platformAdmin)
    groups.push({
      key: "platform",
      items: [
        e("adminMetrics", "/admin/metrics"),
        e("adminRules", "/admin/rules"),
        e("adminEval", "/admin/eval"),
        e("adminCalibration", "/admin/calibration"),
      ],
    });
  return groups;
}

/** The four destinations in the mobile bottom bar; everything else is in the «القائمة» drawer. */
export function primaryMobile(groups: NavGroup[]): NavEntry[] {
  const all = groups.flatMap((g) => g.items);
  const order: NavKey[] = ["dashboard", "promotions", "new", "queue", "rules"];
  return order
    .map((k) => all.find((i) => i.key === k))
    .filter((x): x is NavEntry => Boolean(x))
    .slice(0, 4);
}
