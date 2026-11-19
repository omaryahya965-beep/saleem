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

const INTERNAL: OrgRole[] = [
  "owner",
  "admin",
  "compliance_lead",
  "reviewer",
  "legal",
  "creator",
  "viewer",
];
/**
 * Which organisation roles see each page (sidebar + direct URL). Least privilege per role (D168): a page is listed
 * only where the role has work to do on it. Data on every page is still filtered by RLS/RPCs; this table only
 * decides navigation and the route guard. Pages tied to an action use the matrix (lib/permissions.ts).
 */
export const PAGE_ROLES: Partial<Record<NavKey, (role: OrgRole) => boolean>> = {
  dashboard: () => true,
  promotions: () => true,
  // Partners create only through their partner link (matrix: «عبر رابط الشريك فقط»), never from /new.
  new: (r) => INTERNAL.includes(r) && can(r, "create_promotion"),
  queue: (r) => can(r, "decide_review") || can(r, "assign_reviewer") || can(r, "legal_opinion"),
  rules: (r) => INTERNAL.includes(r),
  // Managers edit; the viewer (auditor) reads. RLS internal_rules_read matches.
  companyRules: (r) => can(r, "manage_company_rules") || r === "viewer",
  // Reference libraries for the people who write, review or audit advertisements (not legal, not externals).
  claims: (r) => ["owner", "admin", "compliance_lead", "reviewer", "creator", "viewer"].includes(r),
  disclaimers: (r) =>
    ["owner", "admin", "compliance_lead", "reviewer", "creator", "viewer"].includes(r),
  products: (r) =>
    ["owner", "admin", "compliance_lead", "reviewer", "creator", "viewer"].includes(r),
  // Organisation administration: managers act, the viewer audits read-only.
  team: (r) => can(r, "manage_members") || r === "viewer",
  roles: (r) => can(r, "manage_members") || r === "viewer",
  features: (r) => can(r, "manage_settings"),
  analytics: (r) => can(r, "view_analytics"),
  audit: (r) => ["owner", "admin", "compliance_lead", "viewer"].includes(r),
  ask: (r) => INTERNAL.includes(r),
};
/** Pages that also need an organisation feature flag. */
const PAGE_FLAG: Partial<Record<NavKey, string>> = {
  companyRules: "internal_rules",
  analytics: "analytics",
  ask: "ask_saleem",
};

/** Whether the signed-in user may see a page (sidebar entry and direct URL). */
export function canSeePage(
  key: NavKey,
  { role, flags, platformAdmin }: Omit<NavInput, "orgId">,
): boolean {
  if (key.startsWith("admin")) return platformAdmin;
  const flag = PAGE_FLAG[key];
  if (flag && !flags[flag]) return false;
  if (role === null) return ["dashboard", "promotions", "new", "archive", "rules"].includes(key);
  if (key === "archive") return false; // the pre-v2 archive belongs to personal accounts
  return PAGE_ROLES[key]?.(role) ?? false;
}

/** The page a path belongs to, for the route guard (detail pages inherit their list page). */
export function pageForPath(pathname: string): NavKey | null {
  const table: [NavKey, string][] = [
    ["new", "/new"],
    ["queue", "/queue"],
    ["archive", "/archive"],
    ["companyRules", "/company-rules"],
    ["claims", "/claims"],
    ["disclaimers", "/disclaimers"],
    ["products", "/products"],
    ["team", "/org"],
    ["roles", "/roles"],
    ["features", "/features"],
    ["analytics", "/analytics"],
    ["audit", "/audit"],
    ["ask", "/ask"],
    ["adminMetrics", "/admin"],
  ];
  // «/org» alone lists the user's organisations (and creates one); only an organisation's own page is «team».
  if (pathname === "/org") return null;
  return table.find(([, p]) => pathname === p || pathname.startsWith(`${p}/`))?.[0] ?? null;
}

export function buildNav(input: NavInput): NavGroup[] {
  const { orgId } = input;
  const see = (k: NavKey) => canSeePage(k, input);
  const groups: NavGroup[] = [];
  const push = (key: NavGroup["key"], items: (NavEntry | false)[]) => {
    const list = items.filter((i): i is NavEntry => Boolean(i));
    if (list.length) groups.push({ key, items: list });
  };
  push("work", [
    see("dashboard") && e("dashboard", "/dashboard"),
    see("promotions") && e("promotions", "/promotions", "/promotions", "/checks"),
    see("new") && e("new", "/new"),
    see("queue") && e("queue", "/queue"),
    see("archive") && e("archive", "/archive"),
  ]);
  push("compliance", [
    see("rules") && e("rules", "/rules"),
    see("companyRules") && e("companyRules", "/company-rules"),
    see("claims") && e("claims", "/claims"),
    see("disclaimers") && e("disclaimers", "/disclaimers"),
    see("products") && e("products", "/products"),
  ]);
  if (orgId)
    push("organization", [
      see("team") && e("team", `/org/${orgId}`, "/org"),
      see("roles") && e("roles", "/roles"),
      see("features") && e("features", "/features"),
      see("analytics") && e("analytics", "/analytics"),
      see("audit") && e("audit", "/audit"),
    ]);
  if (orgId) push("support", [see("ask") && e("ask", "/ask")]);
  push("platform", [
    see("adminMetrics") && e("adminMetrics", "/admin/metrics"),
    see("adminRules") && e("adminRules", "/admin/rules"),
    see("adminEval") && e("adminEval", "/admin/eval"),
    see("adminCalibration") && e("adminCalibration", "/admin/calibration"),
  ]);
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
