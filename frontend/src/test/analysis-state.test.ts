// The header separates the automated-analysis state from the human decision; a finished run that could not
// evaluate every applicable rule is «مكتمل جزئياً», never plain «مكتمل».
import { describe, expect, it } from "vitest";
import { analysisState } from "@/features/promotions/PromotionPage";

describe("analysisState", () => {
  it("maps a finished run with partial coverage to partial", () => {
    expect(analysisState("done", true)).toBe("partial");
    expect(analysisState("done", false)).toBe("done");
  });
  it("keeps processing and failure states", () => {
    for (const s of ["queued", "extracting", "transcribing", "analyzing", "failed"] as const)
      expect(analysisState(s, true)).toBe(s);
    expect(analysisState(null)).toBe("not_started");
    expect(analysisState("something_new")).toBe("analyzing");
  });
});
