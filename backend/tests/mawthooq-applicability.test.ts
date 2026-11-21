// V2 completion §13 (D202): Mawthooq applicability. The licence (GAMR «موثوق») is for INDIVIDUALS presenting
// advertising content on social media, so MAW-04 (account linked to a Mawthooq licence) must not be applied to a
// company's own advertisement, while disclosure (MAW-01) applies to commercial communications generally.
// Applicability objects are copied from the published 2026.11-v2 rulebook.
import { describe, expect, it } from "vitest";
import { applicabilityMismatch } from "../supabase/functions/_shared/rules/applicability.ts";
import type { AnalysisContext, Applicability } from "../supabase/functions/_shared/types.ts";

const MAW_01: Applicability = { any_of: [{ communication_types: ["creator_sponsored", "general_commercial"] }, { distribution: ["influencer"] }] };
const MAW_04: Applicability = { any_of: [{ communication_types: ["creator_sponsored"] }, { distribution: ["influencer"] }] };
const MEDIA_001: Applicability = { distribution: ["influencer"] };

const ctx = (communicationType: string, distribution: AnalysisContext["distribution"] | "agency") =>
  ({ product: null, sector: "cosmetics", communicationType, channels: ["instagram"], distribution, audience: ["general"] }) as unknown as AnalysisContext;

const applies = (a: Applicability, c: AnalysisContext) => applicabilityMismatch(a, c) === null;

describe("Mawthooq applicability by advertiser type", () => {
  const cases: [string, AnalysisContext, boolean][] = [
    ["official company ad on its own account", ctx("general_commercial", "owned"), false],
    ["company ad through paid media placement", ctx("general_commercial", "paid_media"), false],
    ["agency-produced ad published by the company", ctx("general_commercial", "agency"), false],
    ["influencer distribution", ctx("general_commercial", "influencer"), true],
    ["sponsored creator content", ctx("creator_sponsored", "owned"), true],
    ["independent advertiser (creator) via an agency", ctx("creator_sponsored", "agency"), true],
  ];
  for (const [name, c, licence] of cases) {
    it(`${name}: licence rule ${licence ? "applies" : "does not apply"}`, () => {
      expect(applies(MAW_04, c)).toBe(licence);
      expect(applies(MEDIA_001, c)).toBe(c.distribution === "influencer");
    });
  }
  it("disclosure applies to commercial communications regardless of who publishes", () => {
    for (const [, c] of cases) expect(applies(MAW_01, c)).toBe(true);
  });
  it("financial promotions on the bank's own account need no Mawthooq licence", () => {
    expect(applies(MAW_04, ctx("financial_promotion", "owned"))).toBe(false);
  });
});
