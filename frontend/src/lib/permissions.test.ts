import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIONS, ORG_ROLES, can, cell, conditionOf, type Action } from "./permissions";

const actions = Object.keys(ACTIONS) as Action[];

describe("permission matrix", () => {
  it("defines every role for every action", () => {
    for (const a of actions)
      expect(Object.keys(ACTIONS[a].cells).sort()).toEqual([...ORG_ROLES].sort());
  });
  it("explains every conditional action in Arabic", () => {
    for (const a of actions)
      if (ORG_ROLES.some((r) => ACTIONS[a].cells[r] === "cond"))
        expect(conditionOf(a)).toMatch(/[؀-ۿ]/);
  });
  it("viewer writes nothing and reads promotions and analytics", () => {
    const writes = actions.filter((a) => !a.startsWith("view_"));
    for (const a of writes) expect(can("viewer", a), a).toBe(false);
    expect(can("viewer", "view_promotions")).toBe(true);
    expect(can("viewer", "view_analytics")).toBe(true);
  });
  it("only legal gives a legal opinion; nobody outside the org decides", () => {
    expect(ORG_ROLES.filter((r) => can(r, "legal_opinion"))).toEqual(["legal"]);
    for (const r of [
      "external_uploader",
      "external_reviewer",
      "legal",
      "creator",
      "viewer",
    ] as const)
      expect(cell(r, "decide_review")).toBe("no");
  });
  it("no role or null gets anything", () => {
    for (const a of actions) expect(can(null, a)).toBe(false);
  });
  it("the generated pgTAP matrix test is in sync (run backend/scripts/gen-permission-tests.mjs)", () => {
    const sql = readFileSync(
      resolve(__dirname, "../../../backend/supabase/tests/p8_roles_matrix.test.sql"),
      "utf8",
    );
    for (const a of actions)
      for (const r of ORG_ROLES)
        expect(sql, `${a}/${r}`).toContain(
          `org_role_can('${r}', '${a}'), '${ACTIONS[a].cells[r]}'`,
        );
  });
});
