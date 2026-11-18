import { describe, expect, it } from "vitest";
import { emptyContext, pickVersion, resultOf } from "@/features/promotions/model";
import { translate } from "@/i18n";
import type { VersionSummary } from "@/lib/api/promotions";

const v = (n: number, status = "done", overall: string | null = "ready") =>
  ({ id: `s${n}`, version_no: n, status, overall_status: overall }) as unknown as VersionSummary;

describe("version switcher", () => {
  const versions = [v(1), v(2), v(3)];
  it("defaults to the latest version", () => {
    expect(pickVersion(versions, undefined)).toEqual({ version: versions[2], missing: false });
  });
  it("selects ?v=N", () => {
    expect(pickVersion(versions, 2).version?.id).toBe("s2");
  });
  it("falls back to the latest and reports a missing version", () => {
    expect(pickVersion(versions, 9)).toEqual({ version: versions[2], missing: true });
    expect(pickVersion([], 1)).toEqual({ version: null, missing: true });
  });
});

describe("automated result labels", () => {
  it("maps analysis state to advisory labels", () => {
    expect(resultOf(v(1, "done", "needs_fixes"))?.key).toBe("promo.result.needs_fixes");
    expect(resultOf(v(1, "done", "review"))?.key).toBe("promo.result.review");
    expect(resultOf(v(1, "done", "ready"))?.key).toBe("promo.result.ready");
    expect(resultOf(v(1, "transcribing", null))?.tone).toBe("processing");
    expect(resultOf(v(1, "failed", null))?.key).toBe("promo.result.failed");
    expect(resultOf(null)).toBeNull();
  });
  it("never uses forbidden approval wording", () => {
    for (const lang of ["ar", "en"] as const)
      for (const k of ["ready", "review", "needs_fixes"])
        expect(translate(lang, `promo.result.${k}` as never)).not.toMatch(
          /متوافق|معتمد|compliant|approved/i,
        );
  });
});

describe("new promotion context", () => {
  it("starts with a general audience and no product", () => {
    expect(emptyContext("financial_promotion")).toMatchObject({
      productId: null,
      communicationType: "financial_promotion",
      audience: ["general"],
    });
  });
});
