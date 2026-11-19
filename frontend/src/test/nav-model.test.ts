import { describe, expect, it } from "vitest";
import { buildNav, canSeePage, pageForPath, primaryMobile } from "@/components/layout/navModel";
import { ORG_ROLES, can, type OrgRole } from "@/lib/permissions";

const ALL = { internal_rules: true, analytics: true, ask_saleem: true };
const keys = (role: OrgRole | null, flags: Record<string, boolean> = ALL, platformAdmin = false) =>
  buildNav({ role, orgId: role ? "org1" : null, flags, platformAdmin }).flatMap((g) =>
    g.items.map((i) => i.key),
  );
const groups = (role: OrgRole | null) =>
  buildNav({ role, orgId: "org1", flags: ALL, platformAdmin: false }).map((g) => g.key);

// The intended sidebar of every role (D168, least privilege). Any change here is a permission change: review it.
const EXPECTED: Record<OrgRole, string[]> = {
  owner: [
    "dashboard",
    "promotions",
    "new",
    "queue",
    "rules",
    "companyRules",
    "claims",
    "disclaimers",
    "products",
    "team",
    "roles",
    "features",
    "analytics",
    "audit",
    "ask",
  ],
  admin: [
    "dashboard",
    "promotions",
    "new",
    "queue",
    "rules",
    "companyRules",
    "claims",
    "disclaimers",
    "products",
    "team",
    "roles",
    "features",
    "analytics",
    "audit",
    "ask",
  ],
  compliance_lead: [
    "dashboard",
    "promotions",
    "queue",
    "rules",
    "companyRules",
    "claims",
    "disclaimers",
    "products",
    "analytics",
    "audit",
    "ask",
  ],
  reviewer: [
    "dashboard",
    "promotions",
    "queue",
    "rules",
    "claims",
    "disclaimers",
    "products",
    "ask",
  ],
  legal: ["dashboard", "promotions", "queue", "rules", "ask"],
  creator: ["dashboard", "promotions", "new", "rules", "claims", "disclaimers", "products", "ask"],
  external_uploader: ["dashboard", "promotions"],
  external_reviewer: ["dashboard", "promotions"],
  viewer: [
    "dashboard",
    "promotions",
    "rules",
    "companyRules",
    "claims",
    "disclaimers",
    "products",
    "team",
    "roles",
    "analytics",
    "audit",
    "ask",
  ],
};

describe("navigation model (one table for sidebar and route guard)", () => {
  it.each(ORG_ROLES)("%s sees exactly its pages", (r) => {
    expect(keys(r)).toEqual(EXPECTED[r]);
  });

  it("no page is offered for an action the role cannot take", () => {
    for (const r of ORG_ROLES) {
      const k = keys(r);
      if (k.includes("new")) expect(can(r, "create_promotion"), r).toBe(true);
      if (k.includes("features")) expect(can(r, "manage_settings"), r).toBe(true);
      if (k.includes("analytics")) expect(can(r, "view_analytics"), r).toBe(true);
      if (k.includes("queue"))
        expect(
          can(r, "decide_review") || can(r, "assign_reviewer") || can(r, "legal_opinion"),
          r,
        ).toBe(true);
      // Company rules and team: managers act; the viewer only reads (server: RLS read, RPC writes role-checked).
      if (k.includes("companyRules"))
        expect(can(r, "manage_company_rules") || r === "viewer", r).toBe(true);
      if (k.includes("team")) expect(can(r, "manage_members") || r === "viewer", r).toBe(true);
    }
  });

  it("external partners and reviewers get a minimal, isolated navigation", () => {
    for (const r of ["external_uploader", "external_reviewer"] as const)
      expect(groups(r)).toEqual(["work"]);
  });

  it("feature flags hide their pages; platform pages only for platform admins", () => {
    expect(
      keys("owner", {}).filter((x) => ["companyRules", "analytics", "ask"].includes(x)),
    ).toEqual([]);
    expect(keys("owner")).not.toContain("adminMetrics");
    expect(keys("owner", ALL, true)).toContain("adminMetrics");
  });

  it("personal accounts keep the creator journey and the archive", () => {
    expect(keys(null)).toEqual(["dashboard", "promotions", "new", "archive", "rules"]);
  });

  it("the route guard maps every guarded path to its page (detail pages inherit)", () => {
    expect(pageForPath("/queue")).toBe("queue");
    expect(pageForPath("/org/abc")).toBe("team");
    expect(pageForPath("/org")).toBeNull(); // the organisations list / create page is open to every signed-in user
    expect(pageForPath("/admin/rules")).toBe("adminMetrics");
    expect(pageForPath("/promotions/123")).toBeNull(); // record access is decided by RLS (not found)
    expect(pageForPath("/checks/123")).toBeNull();
    expect(pageForPath("/settings")).toBeNull();
    // Typing a hidden URL: the guard refuses exactly what the sidebar hides.
    for (const r of ORG_ROLES)
      for (const [path, key] of [
        ["/new", "new"],
        ["/audit", "audit"],
        ["/features", "features"],
        ["/claims", "claims"],
        ["/org/x", "team"],
      ] as const)
        expect(
          `${r}${path}:${canSeePage(key, { role: r, flags: ALL, platformAdmin: false })}`,
        ).toBe(`${r}${path}:${EXPECTED[r].includes(key)}`);
  });

  it("mobile bottom bar has at most four destinations", () => {
    for (const r of [...ORG_ROLES, null])
      expect(
        primaryMobile(buildNav({ role: r, orgId: "o", flags: ALL, platformAdmin: true })).length,
      ).toBeLessThanOrEqual(4);
  });
});
