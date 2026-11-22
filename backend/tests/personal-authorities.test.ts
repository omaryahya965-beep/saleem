// D211: rule packs for a personal advertisement follow its selected authorities (manual) or the recommended ones
// (automatic). Draft rules are never included for a personal workspace; organisations are unchanged.
import { describe, expect, it } from "vitest";
import { enabledPacksFor } from "../supabase/functions/_shared/rules/applicability.ts";

const PACKS = [
  { code: "sa-system", authority: "INTERNAL", default_sectors: [], enabled_by_default: true, always_enabled: true },
  { code: "sa-gmedia-creators", authority: "GMEDIA", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-mc-ecommerce", authority: "MC", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-sdaia-ai", authority: "SDAIA", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-cos", authority: "SFDA", default_sectors: ["cosmetics"], enabled_by_default: false, always_enabled: false },
  { code: "sa-food", authority: "SFDA", default_sectors: ["food_beverage"], enabled_by_default: false, always_enabled: false },
  { code: "sa-bank", authority: "SAMA", default_sectors: ["banking"], enabled_by_default: false, always_enabled: false },
];
const codes = (x: { code: string }[]) => x.map((p) => p.code).sort();

describe("personal workspace rule packs (D211)", () => {
  it("automatic: the creator defaults plus every pack of a recommended authority, never drafts", () => {
    const packs = enabledPacksFor(null, "cosmetics", PACKS, [], { selected: null, recommended: ["GMEDIA", "MC", "SFDA"] });
    expect(codes(packs)).toEqual(["sa-cos", "sa-food", "sa-gmedia-creators", "sa-mc-ecommerce", "sa-sdaia-ai", "sa-system"]);
    expect(packs.every((p) => !p.includeDrafts)).toBe(true);
    expect(packs.find((p) => p.code === "sa-cos")?.reason).toBe("personal_recommended");
    expect(packs.find((p) => p.code === "sa-gmedia-creators")?.reason).toBe("creator_default");
  });
  it("manual: only the selected authorities (and the always-on system checks)", () => {
    const packs = enabledPacksFor(null, "cosmetics", PACKS, [], { selected: ["MC"], recommended: ["GMEDIA", "MC", "SFDA"] });
    expect(codes(packs)).toEqual(["sa-mc-ecommerce", "sa-system"]);
    expect(packs.find((p) => p.code === "sa-mc-ecommerce")?.reason).toBe("personal_selected");
  });
  it("organisations keep their own pack settings whatever a selection says", () => {
    const packs = enabledPacksFor("org-1", "banking", PACKS, [], { selected: ["MC"], recommended: [] });
    expect(codes(packs)).toEqual(["sa-gmedia-creators", "sa-mc-ecommerce", "sa-sdaia-ai", "sa-system"]);
  });
});
