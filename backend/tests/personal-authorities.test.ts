// D213: a personal advertisement considers EVERY supported authority automatically (no selection, no exclusion);
// draft rules are never included; rules of the sectors the content points to apply whatever sector was selected.
import { describe, expect, it } from "vitest";
import { applicabilityMismatch, enabledPacksFor } from "../supabase/functions/_shared/rules/applicability.ts";
import { detectContentSectors, relevantAuthorities } from "../supabase/functions/_shared/rules/sectors.ts";
import { normalizeArabic } from "../supabase/functions/_shared/rules/arabic.ts";
import type { AnalysisContext } from "../supabase/functions/_shared/types.ts";

const PACKS = [
  { code: "sa-system", authority: "INTERNAL", default_sectors: [], enabled_by_default: true, always_enabled: true },
  { code: "sa-gmedia-creators", authority: "GMEDIA", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-mc-ecommerce", authority: "MC", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-cos", authority: "SFDA", default_sectors: ["cosmetics"], enabled_by_default: false, always_enabled: false },
  { code: "sa-bank", authority: "SAMA", default_sectors: ["banking"], enabled_by_default: false, always_enabled: false },
];
const txt = (t: string) => ({ text: t, norm: normalizeArabic(t) });

describe("personal workspace: automatic multi-regulator analysis (D213)", () => {
  it("every pack is considered, never with drafts", () => {
    const packs = enabledPacksFor(null, "other", PACKS, []);
    expect(packs.map((p) => p.code).sort()).toEqual(["sa-bank", "sa-cos", "sa-gmedia-creators", "sa-mc-ecommerce", "sa-system"]);
    expect(packs.every((p) => !p.includeDrafts)).toBe(true);
    expect(packs.find((p) => p.code === "sa-bank")?.reason).toBe("personal_all");
  });
  it("organisations keep their own pack settings", () => {
    expect(enabledPacksFor("org-1", "banking", PACKS, []).map((p) => p.code).sort()).toEqual(["sa-gmedia-creators", "sa-mc-ecommerce", "sa-system"]);
  });
  it("detects the content's sectors at word level", () => {
    expect(detectContentSectors([txt("تمويل شخصي بمعدل نسبة سنوية 4%")])).toContain("banking");
    expect(detectContentSectors([txt("ودّعي التصبغات مع كريم ندى! بشرة صافية")])).toContain("cosmetics");
    expect(detectContentSectors([txt("شقق للبيع في الرياض")])).toContain("real_estate");
    expect(detectContentSectors([txt("منتج طبيعي مئة بالمئة")])).not.toContain("healthcare"); // «طبي» ≠ «طبيعي»
  });
  it("a wrong sector selection cannot hide a sector rule the content triggers", () => {
    const ctx = { sector: "other", product: null, channels: ["snapchat"], communicationType: "general_commercial", audience: ["general"], distribution: null } as unknown as AnalysisContext;
    expect(applicabilityMismatch({ sectors: ["banking"] }, ctx)).toBe("context:sector");
    expect(applicabilityMismatch({ sectors: ["banking"] }, { ...ctx, contentSectors: ["banking"] })).toBeNull();
  });
  it("relevance follows the selected and detected sectors and the publication context", () => {
    const r = relevantAuthorities({ channels: ["snapchat"], communicationType: "creator_sponsored", isPaid: true }, ["cosmetics", "banking"], true);
    expect(r.sort()).toEqual(["GMEDIA", "MC", "SAMA", "SDAIA", "SFDA"]);
  });
});
