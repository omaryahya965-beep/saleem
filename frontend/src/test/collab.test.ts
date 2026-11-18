import { describe, expect, it } from "vitest";
import {
  findingsDiff,
  isAnchor,
  ratioFromClick,
  textAnchor,
  wordDiff,
} from "@/features/collab/model";
import { joinTextItems, renderScale } from "@/lib/pdf";

describe("word diff", () => {
  it("marks added and removed Arabic words and re-joins exactly", () => {
    const a = "معدل النسبة السنوي 4.2% لمدة 60 شهراً";
    const b = "معدل النسبة السنوي 4.5% لمدة 60 شهراً";
    const d = wordDiff(a, b);
    expect(d.filter((x) => x.op === "removed").map((x) => x.text.trim())).toEqual(["4.2%"]);
    expect(d.filter((x) => x.op === "added").map((x) => x.text.trim())).toEqual(["4.5%"]);
    expect(
      d
        .filter((x) => x.op !== "added")
        .map((x) => x.text)
        .join(""),
    ).toBe(a);
    expect(
      d
        .filter((x) => x.op !== "removed")
        .map((x) => x.text)
        .join(""),
    ).toBe(b);
  });
});

describe("anchors", () => {
  it("ratios are clamped and independent of the element size", () => {
    expect(ratioFromClick(150, 50, { left: 100, top: 0, width: 200, height: 100 })).toEqual({
      x: 0.25,
      y: 0.5,
    });
    expect(ratioFromClick(500, -20, { left: 100, top: 0, width: 200, height: 100 })).toEqual({
      x: 1,
      y: 0,
    });
    expect(ratioFromClick(300, 100, { left: 200, top: 0, width: 400, height: 200 })).toEqual({
      x: 0.25,
      y: 0.5,
    });
  });
  it("text anchors keep offsets and the quote; empty selections are rejected", () => {
    expect(textAnchor("تمويل بدون رسوم", 6, 15)).toEqual({
      kind: "text",
      start: 6,
      end: 15,
      quote: "بدون رسوم",
    });
    expect(textAnchor("abc", 2, 2)).toBeNull();
  });
  it("validates anchor shapes like the database does", () => {
    expect(isAnchor({ kind: "pdf", page: 2, x: 0.3, y: 0.4 })).toBe(true);
    expect(isAnchor({ kind: "image", x: 1.2, y: 0 })).toBe(false);
    expect(isAnchor({ kind: "video", t: 12.5 })).toBe(true);
  });
});

describe("findings diff (case 11)", () => {
  const a = [
    {
      id: "a1",
      rule_code: "SAMA-ADV-03-8",
      finding_type: "missing_required",
      carried_from_finding_id: null,
      resolved_in_submission_id: "v2",
    },
    {
      id: "a2",
      rule_code: "SAMA-ADV-07",
      finding_type: "missing_required",
      carried_from_finding_id: null,
      resolved_in_submission_id: "v2",
    },
    {
      id: "a3",
      rule_code: "SAMA-ADV-01",
      finding_type: "potential_risk",
      carried_from_finding_id: null,
      resolved_in_submission_id: null,
    },
  ];
  const b = [
    {
      id: "b1",
      rule_code: "SAMA-ADV-01",
      finding_type: "potential_risk",
      carried_from_finding_id: "a3",
      resolved_in_submission_id: null,
    },
    {
      id: "b2",
      rule_code: "SAMA-ADV-06",
      finding_type: "missing_required",
      carried_from_finding_id: null,
      resolved_in_submission_id: null,
    },
  ];
  it("two fixed, one remaining (carried), one new", () => {
    const d = findingsDiff(a, b, "v2");
    expect(d.fixed.map((f) => f.id)).toEqual(["a1", "a2"]);
    expect(d.remaining.map((f) => f.id)).toEqual(["b1"]);
    expect(d.added.map((f) => f.id)).toEqual(["b2"]);
  });
  it("without carry links, matches by rule and type", () => {
    const d = findingsDiff(
      a.map((f) => ({ ...f, resolved_in_submission_id: null })),
      b.map((f) => ({ ...f, carried_from_finding_id: null })),
      "v9",
    );
    expect(d.remaining.map((f) => f.id)).toEqual(["b1"]);
    expect(d.fixed.map((f) => f.id)).toEqual(["a1", "a2"]);
  });
});

describe("pdf helpers", () => {
  it("joins text items into lines and caps the render width", () => {
    expect(
      joinTextItems([
        { str: "تمويل", hasEOL: false },
        { str: "شخصي", hasEOL: true },
        { str: "APR 4.5%" },
      ]),
    ).toBe("تمويل شخصي\nAPR 4.5%");
    expect(renderScale(595)).toBeCloseTo(2);
    expect(Math.round(1200 * renderScale(1200))).toBe(1600);
  });
});
