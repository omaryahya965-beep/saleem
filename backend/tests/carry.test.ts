import { describe, expect, it } from "vitest";
import { matchCarryForward } from "../supabase/functions/_shared/pipeline/carry.ts";

const prev = [
  { id: "a", rule_id: "r1", rule_code: "SAMA-ADV-03-8", finding_type: "missing_required", evidence_text: "", t_start: null, status: "open" },
  { id: "b", rule_id: "r2", rule_code: "SAMA-ADV-01", finding_type: "potential_risk", evidence_text: "الأفضل في المملكة", t_start: null, status: "open" },
  { id: "c", rule_id: "r3", rule_code: "SAMA-ADV-07", finding_type: "missing_required", evidence_text: "", t_start: null, status: "actioned" },
  { id: "d", rule_id: "r4", rule_code: "SAMA-ADV-05-4", finding_type: "potential_risk", evidence_text: "اسم مشابه", t_start: 4, status: "dismissed" },
];

describe("carry-forward (case 11)", () => {
  it("V2 fixes two of three open findings: one carried, two resolved", () => {
    const next = [{ rule_id: "r2", rule_code: "SAMA-ADV-01", finding_type: "potential_risk", quote: "الأفضل في المملكة", t_start: null }];
    const r = matchCarryForward(prev, next);
    expect(r.carriedFrom).toEqual(["b"]);
    expect(r.resolved.sort()).toEqual(["a", "c"]);
  });
  it("missing_required carries by rule; a dismissed finding that reappears keeps the reviewer's decision as context", () => {
    const next = [
      { rule_id: "r1", rule_code: "SAMA-ADV-03-8", finding_type: "missing_required", quote: "", t_start: null },
      { rule_id: "r4", rule_code: "SAMA-ADV-05-4", finding_type: "potential_risk", quote: "x", t_start: 5 },
    ];
    const r = matchCarryForward(prev, next);
    expect(r.carriedFrom).toEqual(["a", "d"]);
    expect(r.previousDecisions).toEqual([{ nextIndex: 1, prevId: "d", status: "dismissed" }]);
    expect(r.resolved.sort()).toEqual(["b", "c"]);
  });
  it("a different finding type is not the same issue", () => {
    const next = [{ rule_id: "r1", rule_code: "SAMA-ADV-03-8", finding_type: "confirmed_mismatch", quote: "4.2%", t_start: null }];
    expect(matchCarryForward(prev, next).carriedFrom).toEqual([null]);
  });
});
