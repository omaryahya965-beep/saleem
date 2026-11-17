import { describe, expect, it } from "vitest";
import {
  analysisReviewReasons,
  diffFindings,
  sortIssues,
  toIssueViews,
  verificationId,
} from "@/features/reports/model";
import { formatClock, translate } from "@/i18n";
import ar from "@/i18n/ar.json";
import en from "@/i18n/en.json";
import { validateBasics, validateDuration } from "@/lib/media";
import type { Finding, Rule } from "@/lib/api/data";

const f = (rule_code: string, severity: "violation" | "warning" = "violation") =>
  ({ rule_code, severity }) as Finding;

describe("regulatory references", () => {
  const finding = {
    ...f("COM-01"),
    source_url: "https://untrusted.example/invented-law",
    source_name: "Invented regulator",
  };
  it("resolves reference URLs and names only from database rules", () => {
    const rule = {
      source_url: "https://mc.gov.sa",
      source_name: "وزارة التجارة",
      title_ar: "قاعدة",
    } as Rule;
    const [issue] = toIssueViews([finding], new Map([["COM-01", rule]]), "ar");
    expect(issue?.sourceUrl).toBe(rule.source_url);
    expect(issue?.sourceName).toBe(rule.source_name);
  });
  it("does not fall back to a model reference when the database rule is missing", () => {
    const [issue] = toIssueViews([finding], new Map(), "ar");
    expect(issue?.sourceUrl).toBeNull();
    expect(issue?.sourceName).toBe("");
  });
});

describe("persisted human review notices", () => {
  it("reads the actual run's localized notices and tolerates legacy output", () => {
    const outputs = { review_reasons: [{ ar: "يتطلب مراجعة بشرية", en: "Human review required" }] };
    expect(analysisReviewReasons(outputs, "ar")).toEqual(["يتطلب مراجعة بشرية"]);
    expect(analysisReviewReasons(outputs, "en")).toEqual(["Human review required"]);
    expect(analysisReviewReasons(null, "ar")).toEqual([]);
    expect(analysisReviewReasons({ review_reasons: [null, { ar: 123 }] }, "ar")).toEqual([]);
  });
});

describe("diffFindings", () => {
  it("reports rules present before and absent now as fixed (deduped)", () => {
    const { fixed, stillOpen } = diffFindings(
      [f("MAW-01"), f("MAW-01"), f("COM-01"), f("AI-01")],
      [f("AI-01")],
    );
    expect(fixed.map((x) => x.rule_code)).toEqual(["MAW-01", "COM-01"]);
    expect(stillOpen.map((x) => x.rule_code)).toEqual(["AI-01"]);
  });
});

describe("sortIssues", () => {
  it("orders timed issues by time, violations first, untimed last", () => {
    const mk = (id: string, time: number | null, severity: "violation" | "warning") =>
      ({ id, time, severity }) as Parameters<typeof sortIssues>[0][number];
    const out = sortIssues([
      mk("a", null, "violation"),
      mk("b", 12, "warning"),
      mk("c", 12, "violation"),
      mk("d", 0, "warning"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["d", "c", "b", "a"]);
  });
});

describe("formatting", () => {
  it("formats clock times as mm:ss", () => {
    expect(formatClock(12)).toBe("00:12");
    expect(formatClock(75.9)).toBe("01:15");
    expect(formatClock(null)).toBe("—");
  });
  it("builds a readable verification id", () => {
    expect(verificationId("9f2c4a1e-7b3d-4f60-a8c1-e2b4d6f8091a")).toBe("SLM-9F2C-4A1E-7B3D");
  });
  it("interpolates params", () => {
    expect(translate("en", "common.pageOf", { page: 2, total: 5 })).toBe("Page 2 of 5");
  });
});

describe("i18n dictionaries", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`],
    );
  it("en has every non-plural key from ar", () => {
    const enKeys = new Set(keys(en));
    const missing = keys(ar).filter((k) => !k.startsWith("count.") && !enKeys.has(k));
    expect(missing).toEqual([]);
  });
  it("Arabic plural forms are grammatical", () => {
    const cat = (n: number) => new Intl.PluralRules("ar").select(n);
    expect(cat(3)).toBe("few");
    expect(translate("ar", `count.violations.${cat(3)}` as never, { n: 3 })).toBe("3 مخالفات");
    expect(translate("ar", `count.violations.${cat(2)}` as never, { n: 2 })).toBe("مخالفتان");
  });
});

describe("media validation", () => {
  it("rejects wrong type, oversize and long clips", () => {
    expect(validateBasics({ type: "application/pdf", size: 1, name: "a.pdf" }, "video")).toEqual({
      code: "type",
    });
    expect(
      validateBasics({ type: "video/mp4", size: 26 * 1024 * 1024, name: "a.mp4" }, "video")?.code,
    ).toBe("size");
    expect(validateBasics({ type: "", size: 10, name: "clip.MOV" }, "video")).toBeNull();
    expect(validateDuration(91)?.code).toBe("duration");
    expect(validateDuration(90.2)).toBeNull();
  });
});

import { pipelineErrorText } from "@/features/reports/model";

describe("pipelineErrorText", () => {
  const tAr = (k: string) => translate("ar", k as never);
  const tEn = (k: string) => translate("en", k as never);
  it("shows a temporary provider failure and retry guidance for exhausted 503s", () => {
    expect(pipelineErrorText("code:provider_provider_down", tEn)).toMatch(/temporar.*try again/i);
    expect(pipelineErrorText("code:provider_provider_down", tAr)).toContain("أعد المحاولة");
  });
  it("translates provider codes in both languages; invalid key only for that code", () => {
    expect(pipelineErrorText("code:provider_invalid_key", tAr)).toContain("مفتاح");
    expect(pipelineErrorText("code:provider_insufficient_quota", tEn)).toMatch(/credit/);
    expect(pipelineErrorText("code:provider_insufficient_quota", tAr)).not.toContain("مفتاح");
    expect(pipelineErrorText("code:provider_model_not_found", tEn)).toMatch(/model/);
  });
  it("keeps legacy plain-text messages and falls back for unknown codes", () => {
    expect(pipelineErrorText("رسالة قديمة", tAr)).toBe("رسالة قديمة");
    expect(pipelineErrorText("code:something_new", tEn)).toBe(
      translate("en", "pipelineErrors.pipeline_unexpected"),
    );
  });
});
