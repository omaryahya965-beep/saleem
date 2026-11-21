// D195: the roles page never shows a write permission to viewers, assignment to reviewers, approval to legal or
// externals, and every catalogue row has a label and an enforcing function.
import { describe, expect, it } from "vitest";
import ar from "@/i18n/ar.json";
import { AREAS, rowOf } from "@/features/roles/catalogue";

const all = AREAS.flatMap((a) => a.actions);
describe("roles catalogue", () => {
  it("covers every functional area with labelled, enforced rows", () => {
    expect(AREAS.map((a) => a.key)).toEqual(
      expect.arrayContaining([
        "advertisements",
        "analysis",
        "review",
        "decisions",
        "products",
        "claims",
        "legal",
        "organization",
        "external",
        "analytics",
        "ai",
        "policies",
      ]),
    );
    for (const k of all) {
      expect((ar.roles2.action as Record<string, string>)[k], k).toBeTruthy();
      expect(rowOf(k).enforcedBy, k).toBeTruthy();
    }
  });
  it("keeps the governance boundaries", () => {
    const writes = all.filter((k) => !["view_promotions", "view_analytics"].includes(k));
    for (const k of writes) expect(rowOf(k).cells.viewer, k).toBe("no");
    expect(rowOf("assign_reviewer").cells.reviewer).toBe("no");
    for (const k of ["decide_review", "verify_conditions", "approve_claim", "self_approve"])
      for (const r of ["legal", "external_reviewer", "viewer"] as const)
        expect(rowOf(k).cells[r], `${k}/${r}`).toBe("no");
    expect(rowOf("decide_review").cells.external_uploader).toBe("no");
    expect(rowOf("manage_partner_links").cells.compliance_lead).toBe("no");
  });
});
