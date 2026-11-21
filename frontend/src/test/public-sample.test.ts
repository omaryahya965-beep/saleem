// D206: the public pages derive every number from the sanitised Nada Cream data with the app's own grouping. These
// invariants keep the marketing copy honest: 9 evidence → 6 consolidated findings, 4 no longer detected in V2,
// 2 document requirements still open, nothing new — and every rule shown has a reference and a review requirement.
import { describe, expect, it } from "vitest";
import ar from "@/i18n/ar.json";
import en from "@/i18n/en.json";
import { diffGroups, groupFindings } from "@/features/reports/grouping";
import { NADA_MEDIA, NADA_V1, NADA_V2, RULE_REFS } from "@/features/sample/nadaSample";

describe("public Nada Cream sample", () => {
  it("consolidates 9 pieces of evidence into 6 findings", () => {
    expect(NADA_V1.findings).toHaveLength(9);
    expect(groupFindings(NADA_V1.findings)).toHaveLength(6);
    expect(groupFindings(NADA_V2.findings)).toHaveLength(2);
  });
  it("V2: four no longer detected, the two document requirements persist, none added", () => {
    const d = diffGroups(NADA_V1.findings, NADA_V2.findings);
    expect(d.noLongerDetected).toHaveLength(4);
    expect(d.persistent.map((p) => p.after.ruleCode).sort()).toEqual(["MAW-03", "MAW-04"]);
    expect(d.added).toHaveLength(0);
  });
  it("every rule shown has a rulebook reference and a review requirement in both languages", () => {
    const codes = new Set([...NADA_V1.findings, ...NADA_V2.findings].map((f) => f.rule_code));
    for (const c of codes) {
      expect(RULE_REFS[c], c).toBeDefined();
      expect((ar.demo.req as Record<string, string>)[c], c).toBeTruthy();
      expect((en.demo.req as Record<string, string>)[c], c).toBeTruthy();
    }
  });
  it("uses only local sample media", () => {
    for (const p of [NADA_V1.video, NADA_V2.video, ...Object.values(NADA_MEDIA)])
      expect(p).toMatch(/^\/sample\//);
  });
  it("public copy makes no compliance guarantee and labels upcoming generation", () => {
    expect(ar.home.hero.note).toContain("لا يضمن الامتثال القانوني");
    expect(en.home.hero.note).toContain("does not guarantee legal compliance");
    // D209: generated footage stays labelled provider-dependent and not configured; script by Gemini is not claimed as always on.
    expect(en.home.journeys.create.steps.footage).toMatch(/not configured/);
    expect(en.home.journeys.create.note).toMatch(/not configured/);
    expect(en.home.journeys.create.steps.script).toMatch(/when configured/);
    expect(en.demo.honesty).toMatch(/prepared manually/);
  });
});
