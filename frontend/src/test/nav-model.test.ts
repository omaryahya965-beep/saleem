import { describe, expect, it } from "vitest";
import { buildNav, primaryMobile } from "@/components/layout/navModel";
import { ORG_ROLES, can, type OrgRole } from "@/lib/permissions";

const ALL = { internal_rules: true, analytics: true, ask_saleem: true };
const keys = (role: OrgRole | null, flags: Record<string, boolean> = ALL, platformAdmin = false) =>
  buildNav({ role, orgId: role ? "org1" : null, flags, platformAdmin }).flatMap((g) =>
    g.items.map((i) => i.key),
  );
const groups = (role: OrgRole | null) =>
  buildNav({ role, orgId: "org1", flags: ALL, platformAdmin: false }).map((g) => g.key);

describe("navigation model (derived from the permission matrix)", () => {
  it("never shows an entry whose action the role cannot take", () => {
    for (const r of ORG_ROLES) {
      const k = keys(r);
      if (k.includes("new")) expect(can(r, "create_promotion"), r).toBe(true);
      if (k.includes("features")) expect(can(r, "manage_settings"), r).toBe(true);
      if (k.includes("companyRules")) expect(can(r, "manage_company_rules"), r).toBe(true);
      if (k.includes("analytics")) expect(can(r, "view_analytics"), r).toBe(true);
    }
  });
  it("external partners and reviewers see only their work, no internal organisation data", () => {
    for (const r of ["external_uploader", "external_reviewer"] as const) {
      expect(groups(r)).toEqual(["work", "compliance"]);
      expect(keys(r)).not.toEqual(expect.arrayContaining(["claims"]));
      expect(
        keys(r).filter((k) => ["team", "roles", "audit", "products", "claims", "ask"].includes(k)),
      ).toEqual([]);
    }
    // Partners upload through their partner link, not /new.
    expect(keys("external_uploader")).not.toContain("new");
    expect(keys("external_reviewer")).not.toContain("new");
  });
  it("marketer: create and track; compliance: queue and rules; admin: organisation", () => {
    expect(keys("creator")).toEqual(expect.arrayContaining(["dashboard", "promotions", "new"]));
    expect(keys("creator")).not.toContain("queue");
    expect(keys("compliance_lead")).toEqual(
      expect.arrayContaining(["queue", "rules", "companyRules", "analytics"]),
    );
    expect(keys("compliance_lead")).not.toContain("features");
    expect(keys("admin")).toEqual(expect.arrayContaining(["team", "roles", "features"]));
    expect(keys("legal")).toContain("queue");
  });
  it("viewer is read-only: no create, no queue, no settings", () => {
    const k = keys("viewer");
    expect(k).not.toContain("new");
    expect(k).not.toContain("queue");
    expect(k).not.toContain("features");
    expect(k).toEqual(expect.arrayContaining(["promotions", "audit", "analytics"]));
  });
  it("feature flags hide their pages; platform admin only for platform admins", () => {
    expect(keys("owner", {})).not.toEqual(expect.arrayContaining(["companyRules"]));
    expect(
      keys("owner", {}).filter((x) => ["companyRules", "analytics", "ask"].includes(x)),
    ).toEqual([]);
    expect(keys("owner")).not.toContain("adminMetrics");
    expect(keys("owner", ALL, true)).toContain("adminMetrics");
  });
  it("personal accounts keep the creator journey and the archive", () => {
    expect(keys(null)).toEqual(["dashboard", "promotions", "new", "archive", "rules"]);
  });
  it("mobile bottom bar has at most four destinations", () => {
    for (const r of [...ORG_ROLES, null])
      expect(
        primaryMobile(buildNav({ role: r, orgId: "o", flags: ALL, platformAdmin: true })).length,
      ).toBeLessThanOrEqual(4);
  });
});
