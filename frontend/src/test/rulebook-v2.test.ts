import { describe, expect, it } from "vitest";
import { applicabilityLines } from "@/features/rulebook/model";
import { translate } from "@/i18n";
import { packEnabled, type RulePack } from "@/lib/api/rules";

const tAr = (k: string, v?: Record<string, string | number>) =>
  translate("ar", k as never, v as never);

describe("rulebook v2", () => {
  it("renders applicability in Arabic", () => {
    const lines = applicabilityLines(
      {
        sectors: ["banking"],
        product_types: ["personal_finance"],
        requires_product: true,
        audiences_exclude: ["non_arabic_speakers"],
      },
      tAr as never,
    );
    expect(lines[0]).toContain("البنوك");
    expect(lines[1]).toContain("تمويل شخصي");
    expect(lines).toContain("تتطلب منتجاً");
    expect(lines[3]).toContain("non_arabic_speakers"); // unknown values stay readable
  });
  it("pack defaults follow the org sector; rows override; system pack is always on", () => {
    const sama = {
      code: "sa-sama-advertising",
      enabled_by_default: true,
      default_sectors: ["banking"],
      always_enabled: false,
    } as unknown as RulePack;
    const sys = {
      code: "sa-system",
      enabled_by_default: true,
      default_sectors: [],
      always_enabled: true,
    } as unknown as RulePack;
    expect(packEnabled(sama, undefined, "banking")).toBe(true);
    expect(packEnabled(sama, undefined, "insurance")).toBe(false);
    expect(packEnabled(sama, { enabled: false } as never, "banking")).toBe(false);
    expect(packEnabled(sys, { enabled: false } as never, null)).toBe(true);
  });
});
