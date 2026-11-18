import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseLocalizedNumber, validateKeyFacts } from "@/lib/key-facts";

describe("product key facts", () => {
  it("frontend and Edge Function copies are identical", () => {
    const root = path.resolve(__dirname, "../../..");
    const a = fs.readFileSync(path.join(root, "frontend/src/lib/key-facts.ts"), "utf8");
    const b = fs.readFileSync(
      path.join(root, "backend/supabase/functions/_shared/products/key-facts.ts"),
      "utf8",
    );
    expect(a.replace(/\r\n/g, "\n")).toBe(b.replace(/\r\n/g, "\n"));
  });

  it("accepts the test-plan personal-finance product", () => {
    expect(
      validateKeyFacts({
        apr: { value: 4.5, type: "fixed" },
        term_months: { min: 6, max: 60 },
        fees: [
          { name_ar: "رسوم إدارية", amount: 1, unit: "percent", cap_sar: 5000, vat_included: true },
        ],
        sharia_compliant: true,
      }),
    ).toEqual([]);
    expect(validateKeyFacts({})).toEqual([]);
  });

  it("rejects bad values with typed errors", () => {
    const errs = validateKeyFacts({
      apr: { value: 140, type: "floating" },
      term_months: { min: 60, max: 6 },
      fees: [{ name_ar: "", amount: -1, unit: "USD" }],
      extra: 1,
    }).map((e) => e.error);
    expect(errs).toEqual(
      expect.arrayContaining([
        "apr_range",
        "apr_type",
        "term_order",
        "fee_name",
        "fee_amount",
        "fee_unit",
        "not_object",
      ]),
    );
    expect(validateKeyFacts(null)).toEqual([{ path: "", error: "not_object" }]);
  });

  it("parses Arabic and Latin digits", () => {
    expect(parseLocalizedNumber("٤٫٥")).toBe(4.5);
    expect(parseLocalizedNumber("4.5%")).toBe(4.5);
    expect(parseLocalizedNumber("٥٬٠٠٠")).toBe(5000);
    expect(parseLocalizedNumber("abc")).toBeNull();
  });
});
