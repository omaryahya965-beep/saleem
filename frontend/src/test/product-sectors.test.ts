// D170: a cosmetic product carries only its own optional attributes — no financial key facts, no required values.
import { describe, expect, it } from "vitest";
import {
  emptyProductForm,
  formToKeyFacts,
  productToForm,
  validateProductForm,
} from "@/features/products/model";
import { SECTOR_MODEL } from "@/lib/api/promotions";
import type { Product } from "@/lib/api/promotions";

describe("sector-aware products", () => {
  it("cosmetics: attributes under key_facts.cosmetics, nothing financial, nothing required but the name", () => {
    const f = {
      ...emptyProductForm("cosmetics"),
      nameAr: "كريم ندى",
      apr: "4.5",
      attrs: { intended_use: "العناية اليومية", warnings: " " },
    };
    expect(formToKeyFacts(f)).toEqual({ cosmetics: { intended_use: "العناية اليومية" } });
    expect(validateProductForm({ ...f, apr: "abc" })).toEqual([]);
    expect(validateProductForm({ ...f, nameAr: "" }).map((i) => i.path)).toEqual(["nameAr"]);
  });
  it("round-trips attributes and keeps financial products unchanged", () => {
    const p = {
      name_ar: "x",
      name_en: null,
      aliases: [],
      sector: "tourism",
      product_type: "tour_package",
      regulator: "MOT",
      key_facts: { tourism: { destination: "العلا" } },
    } as unknown as Product;
    expect(productToForm(p).attrs).toEqual({ destination: "العلا" });
    const bank = { ...emptyProductForm("banking"), nameAr: "تمويل", apr: "4.5" };
    expect(formToKeyFacts(bank)).toMatchObject({ apr: { value: 4.5 } });
  });
  it("every sector offers its own product types and a default regulator", () => {
    expect(SECTOR_MODEL.cosmetics.types).toContain("skincare");
    expect(SECTOR_MODEL.cosmetics.regulator).toBe("SFDA");
    expect(SECTOR_MODEL.cosmetics.types).not.toContain("credit_card");
  });
});
