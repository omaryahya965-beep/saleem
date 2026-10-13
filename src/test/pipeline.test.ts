// src/test/pipeline.test.ts
// Unit tests for Arabic deterministic compliance rules and pipeline merging

import { describe, expect, it } from "vitest";
import { runDeterministicChecks } from "../../supabase/functions/_shared/rules/deterministic.ts";
import { mergeAndFilterFindings } from "../../supabase/functions/_shared/pipeline/merge.ts";
import type {
  Finding,
  SubmissionData,
  TranscriptSegment,
} from "../../supabase/functions/_shared/types.ts";

describe("Deterministic Compliance Engine (Arabic Fixtures)", () => {
  it("detects MAW-01 violation when paid ad has no disclosure in caption or first 5s", () => {
    const submission: SubmissionData = {
      id: "sub-1",
      is_demo: false,
      kind: "video",
      caption: "جربت شاي التنحيف الجديد كود الخصم SALEEM20",
      platform: "snapchat",
      product_category: "health",
      is_paid_ad: true,
      has_written_contract: true,
      ai_used: false,
      mawthooq_license_no: "MW-12345",
      status: "analyzing",
      progress: 50,
      current_step: "deterministic",
    };

    const segments: TranscriptSegment[] = [
      { start: 0, end: 4, text: "هلا والله يا جماعة اليوم بجرب لكم شاي جديد" },
    ];

    const findings = runDeterministicChecks(submission, segments);
    const maw01 = findings.find((f) => f.rule_code === "MAW-01");

    expect(maw01).toBeDefined();
    expect(maw01?.severity).toBe("violation");
    expect(maw01?.source).toBe("deterministic");
  });

  it("passes MAW-01 when paid ad contains Arabic disclosure hashtag #إعلان in caption", () => {
    const submission: SubmissionData = {
      id: "sub-2",
      is_demo: false,
      kind: "video",
      caption: "#إعلان | تجربة شاي الأعشاب كود الخصم SALEEM20",
      platform: "snapchat",
      product_category: "health",
      is_paid_ad: true,
      has_written_contract: true,
      ai_used: false,
      mawthooq_license_no: "MW-12345",
      status: "analyzing",
      progress: 50,
      current_step: "deterministic",
    };

    const findings = runDeterministicChecks(submission, []);
    const maw01 = findings.find((f) => f.rule_code === "MAW-01");

    expect(maw01).toBeUndefined();
  });

  it("detects MAW-03 warning when paid ad lacks written contract", () => {
    const submission: SubmissionData = {
      id: "sub-3",
      is_demo: false,
      kind: "video",
      caption: "#إعلان تجاري",
      platform: "snapchat",
      product_category: "beauty",
      is_paid_ad: true,
      has_written_contract: false,
      ai_used: false,
      mawthooq_license_no: "MW-12345",
      status: "analyzing",
      progress: 50,
      current_step: "deterministic",
    };

    const findings = runDeterministicChecks(submission, []);
    const maw03 = findings.find((f) => f.rule_code === "MAW-03");

    expect(maw03).toBeDefined();
    expect(maw03?.severity).toBe("warning");
  });

  it("detects MAW-04 warning when paid ad has no Mawthooq license number", () => {
    const submission: SubmissionData = {
      id: "sub-4",
      is_demo: false,
      kind: "video",
      caption: "#إعلان تجاري",
      platform: "snapchat",
      product_category: "beauty",
      is_paid_ad: true,
      has_written_contract: true,
      ai_used: false,
      mawthooq_license_no: "",
      status: "analyzing",
      progress: 50,
      current_step: "deterministic",
    };

    const findings = runDeterministicChecks(submission, []);
    const maw04 = findings.find((f) => f.rule_code === "MAW-04");

    expect(maw04).toBeDefined();
    expect(maw04?.severity).toBe("warning");
  });

  it("detects AI-01 violation when AI is used without caption disclosure", () => {
    const submission: SubmissionData = {
      id: "sub-5",
      is_demo: false,
      kind: "video",
      caption: "تصميم جديد تماماً للمنتج",
      platform: "instagram",
      product_category: "other",
      is_paid_ad: false,
      has_written_contract: false,
      ai_used: true,
      status: "analyzing",
      progress: 50,
      current_step: "deterministic",
    };

    const findings = runDeterministicChecks(submission, []);
    const ai01 = findings.find((f) => f.rule_code === "AI-01");

    expect(ai01).toBeDefined();
    expect(ai01?.severity).toBe("violation");
  });
});

describe("Pipeline Merge & Calibration", () => {
  const validRules = new Set(["MAW-01", "MAW-02", "CNT-01"]);

  it("drops findings with unknown rule codes", () => {
    const mockFindings: Finding[] = [
      {
        rule_code: "UNKNOWN-99",
        severity: "violation",
        t_start: 1,
        t_end: 2,
        evidence_type: "transcript",
        evidence_text: "test",
        explanation_ar: "unknown",
        fix_ar: "fix",
        confidence: 0.9,
        source: "llm",
      },
      {
        rule_code: "MAW-01",
        severity: "violation",
        t_start: 0,
        t_end: 4,
        evidence_type: "transcript",
        evidence_text: "test",
        explanation_ar: "known",
        fix_ar: "fix",
        confidence: 0.95,
        source: "deterministic",
      },
    ];

    const { mergedFindings } = mergeAndFilterFindings(mockFindings, validRules);
    expect(mergedFindings.length).toBe(1);
    expect(mergedFindings[0]?.rule_code).toBe("MAW-01");
  });

  it("downgrades weak evidence (< 0.7 confidence) to warning", () => {
    const mockFindings: Finding[] = [
      {
        rule_code: "MAW-02",
        severity: "violation",
        t_start: 10,
        t_end: 15,
        evidence_type: "transcript",
        evidence_text: "weak",
        explanation_ar: "explanation",
        fix_ar: "fix",
        confidence: 0.55,
        source: "llm",
      },
    ];

    const { mergedFindings, overallStatus } = mergeAndFilterFindings(mockFindings, validRules);
    expect(mergedFindings[0]?.severity).toBe("warning");
    expect(overallStatus).toBe("review");
  });

  it("deduplicates findings within 3-second window keeping higher confidence", () => {
    const mockFindings: Finding[] = [
      {
        rule_code: "MAW-01",
        severity: "violation",
        t_start: 2,
        t_end: 5,
        evidence_type: "transcript",
        evidence_text: "first",
        explanation_ar: "explanation",
        fix_ar: "fix",
        confidence: 0.8,
        source: "llm",
      },
      {
        rule_code: "MAW-01",
        severity: "violation",
        t_start: 3,
        t_end: 6,
        evidence_type: "transcript",
        evidence_text: "second",
        explanation_ar: "explanation",
        fix_ar: "fix",
        confidence: 0.95,
        source: "deterministic",
      },
    ];

    const { mergedFindings } = mergeAndFilterFindings(mockFindings, validRules);
    expect(mergedFindings.length).toBe(1);
    expect(mergedFindings[0]?.confidence).toBe(0.95);
  });
});
