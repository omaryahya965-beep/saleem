import { describe, expect, it } from "vitest";
import { ORG_ROLES } from "@/lib/permissions";
import {
  ADVANCED_ROLES,
  canDisableRole,
  DEFAULT_WORKSPACE_ROLES,
  ESSENTIAL_ROLES,
  getEnabledRoles,
  IMMUTABLE_ROLES,
} from "@/lib/roleConfig";

describe("roleConfig — organization role management and grouping", () => {
  it("divides the 9 roles into exactly 4 essential and 5 advanced roles", () => {
    expect(ESSENTIAL_ROLES).toEqual(["admin", "creator", "reviewer", "external_uploader"]);
    expect(ADVANCED_ROLES).toEqual([
      "owner",
      "compliance_lead",
      "legal",
      "external_reviewer",
      "viewer",
    ]);
    expect([...ESSENTIAL_ROLES, ...ADVANCED_ROLES].sort()).toEqual([...ORG_ROLES].sort());
  });

  it("recommends default workspace roles including owner and essential roles", () => {
    expect(DEFAULT_WORKSPACE_ROLES).toContain("owner");
    for (const r of ESSENTIAL_ROLES) {
      expect(DEFAULT_WORKSPACE_ROLES).toContain(r);
    }
  });

  it("getEnabledRoles returns all roles by default when no configuration is set", () => {
    const roles = getEnabledRoles(null, []);
    expect(roles).toEqual([...ORG_ROLES]);
  });

  it("getEnabledRoles always protects owner and admin", () => {
    const roles = getEnabledRoles({ enabled_roles: ["creator"] }, []);
    expect(roles).toContain("owner");
    expect(roles).toContain("admin");
    expect(roles).toContain("creator");
    expect(roles).not.toContain("legal");
  });

  it("getEnabledRoles never hides or orphans a role currently held by an active member", () => {
    const members = [{ role: "legal" as const, user_id: "u1" }];
    const roles = getEnabledRoles({ enabled_roles: ["creator"] }, members);
    expect(roles).toContain("legal");
  });

  it("canDisableRole prevents disabling core admin and owner roles", () => {
    for (const role of IMMUTABLE_ROLES) {
      const res = canDisableRole(role, []);
      expect(res.canDisable).toBe(false);
      expect(res.reason_ar).toBeDefined();
    }
  });

  it("canDisableRole prevents disabling roles currently held by active members", () => {
    const members = [
      { role: "reviewer" as const, user_id: "u1" },
      { role: "reviewer" as const, user_id: "u2" },
    ];
    const res = canDisableRole("reviewer", members);
    expect(res.canDisable).toBe(false);
    expect(res.memberCount).toBe(2);
    expect(res.reason_ar).toContain("2");
  });

  it("canDisableRole allows disabling optional roles with zero active members", () => {
    const members = [{ role: "creator" as const, user_id: "u1" }];
    const res = canDisableRole("external_reviewer", members);
    expect(res.canDisable).toBe(true);
    expect(res.memberCount).toBe(0);
  });
});
