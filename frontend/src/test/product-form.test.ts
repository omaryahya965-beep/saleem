import { describe, expect, it } from "vitest";
import {
  emptyProductForm,
  formToKeyFacts,
  productToForm,
  splitAliases,
  validateProductForm,
} from "@/features/products/model";
import type { Product } from "@/lib/api/promotions";

describe("product form", () => {
  it("requires the Arabic name", () => {
    expect(validateProductForm(emptyProductForm()).map((i) => i.error)).toContain("name_required");
  });

  it("parses Arabic digits into key facts", () => {
    const f = {
      ...emptyProductForm(),
      nameAr: "تمويل",
      apr: "٤٫٥",
      aprType: "fixed" as const,
      termMin: "6",
      termMax: "٦٠",
    };
    expect(formToKeyFacts(f)).toMatchObject({
      apr: { value: 4.5, type: "fixed" },
      term_months: { min: 6, max: 60 },
    });
    expect(validateProductForm(f)).toEqual([]);
  });

  it("reports unparsable or inconsistent numbers", () => {
    const f = { ...emptyProductForm(), nameAr: "x", apr: "abc", termMin: "60", termMax: "6" };
    const errs = validateProductForm(f).map((i) => i.error);
    expect(errs).toEqual(expect.arrayContaining(["apr_range", "term_order"]));
    const fee = {
      ...emptyProductForm(),
      nameAr: "x",
      fees: [
        { name_ar: "", amount: "1", unit: "percent" as const, cap_sar: "", vat_included: true },
      ],
    };
    expect(validateProductForm(fee).map((i) => i.path)).toContain("fees.0.name_ar");
  });

  it("round-trips an approved product into a new-version form", () => {
    const p = {
      name_ar: "تمويل شخصي المثال",
      name_en: null,
      aliases: ["أ", "ب"],
      sector: "banking",
      product_type: "personal_finance",
      regulator: "SAMA",
      key_facts: {
        apr: { value: 4.5, type: "fixed" },
        fees: [
          { name_ar: "رسوم إدارية", amount: 1, unit: "percent", cap_sar: 5000, vat_included: true },
        ],
      },
    } as unknown as Product;
    const f = productToForm(p);
    expect(formToKeyFacts(f)).toMatchObject(p.key_facts as object);
    expect(splitAliases(f.aliases)).toEqual(["أ", "ب"]);
  });
});
