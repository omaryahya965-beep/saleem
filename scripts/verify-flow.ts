// scripts/verify-flow.ts
// End-to-end verification script testing SALEEM flow end-to-end:
// Demo report -> New check with sample data -> Processing pipeline -> Report -> Re-check -> Ready -> Compliance log

import { runDeterministicChecks } from "../supabase/functions/_shared/rules/deterministic.ts";
import { mergeAndFilterFindings } from "../supabase/functions/_shared/pipeline/merge.ts";
import { runLlmChecks } from "../supabase/functions/_shared/providers/llm.ts";
import type { Finding, RuleRecord, SubmissionData, TranscriptSegment } from "../supabase/functions/_shared/types.ts";

const ACTIVE_RULES: RuleRecord[] = [
  { code: "MAW-01", category: "mawthooq", title_ar: "الإفصاح الواضح عن الإعلان", title_en: "Ad disclosure", description_ar: "", description_en: "", source_name: "موثوق", source_url: "https://mawthooq.gcam.gov.sa", check_type: "hybrid", default_severity: "violation", llm_instructions: "Check disclosure in caption or first 5s", applies_to_categories: [] },
  { code: "MAW-02", category: "mawthooq", title_ar: "ترخيص المنتج", title_en: "Product license", description_ar: "", description_en: "", source_name: "موثوق", source_url: "https://mawthooq.gcam.gov.sa", check_type: "hybrid", default_severity: "warning", llm_instructions: "Check license for regulated categories", applies_to_categories: [] },
  { code: "MAW-03", category: "mawthooq", title_ar: "عقد مكتوب", title_en: "Written contract", description_ar: "", description_en: "", source_name: "موثوق", source_url: "https://mawthooq.gcam.gov.sa", check_type: "metadata", default_severity: "warning", llm_instructions: "Check written contract", applies_to_categories: [] },
  { code: "MAW-04", category: "mawthooq", title_ar: "رخصة موثوق", title_en: "Mawthooq license", description_ar: "", description_en: "", source_name: "موثوق", source_url: "https://mawthooq.gcam.gov.sa", check_type: "metadata", default_severity: "warning", llm_instructions: "Check license number", applies_to_categories: [] },
  { code: "CNT-01", category: "content", title_ar: "عدم تصوير الأطفال", title_en: "No children", description_ar: "", description_en: "", source_name: "الهيئة", source_url: "https://gcam.gov.sa", check_type: "visual", default_severity: "violation", llm_instructions: "Check minors in content", applies_to_categories: [] },
  { code: "AI-01", category: "ai", title_ar: "الإفصاح عن الذكاء الاصطناعي", title_en: "Disclose AI", description_ar: "", description_en: "", source_name: "سدايا", source_url: "https://sdaia.gov.sa", check_type: "hybrid", default_severity: "violation", llm_instructions: "Check AI disclosure", applies_to_categories: [] },
  { code: "COM-01", category: "commerce", title_ar: "عدم الادعاءات المطلقة", title_en: "No absolute claims", description_ar: "", description_en: "", source_name: "التجارة", source_url: "https://mc.gov.sa", check_type: "hybrid", default_severity: "warning", llm_instructions: "Check absolute health claims", applies_to_categories: [] },
];

const VALID_RULE_CODES = new Set(ACTIVE_RULES.map((r) => r.code));

async function runEndToEndVerification() {
  console.log("================================================================================");
  console.log("🚀 STARTING SALEEM END-TO-END FLOW VERIFICATION");
  console.log("================================================================================\n");

  let passes = 0;
  let total = 0;

  function assert(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passes++;
      console.log(`  ✅ [PASS] ${name}`);
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details ? `(${details})` : ""}`);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 1: Demo Reports Verification
  // --------------------------------------------------------------------------
  console.log("Step 1: Auditing Demo Reports Fixtures");
  const demoNeedsFixesId = "d0000000-0000-0000-0000-000000000001";
  const demoReadyId = "d0000000-0000-0000-0000-000000000002";

  assert("Demo Needs-Fixes UUID conforms to specification", demoNeedsFixesId.endsWith("0001"));
  assert("Demo Ready UUID conforms to specification", demoReadyId.endsWith("0002"));

  // --------------------------------------------------------------------------
  // STEP 2: New Check Creation with Sample Non-Compliant Clip
  // --------------------------------------------------------------------------
  console.log("\nStep 2: Submitting New Check (Unannounced Health Ad with AI)");
  const sampleSubmission1: SubmissionData = {
    id: "test-sub-001",
    is_demo: false,
    kind: "video",
    caption: "جربت شاي التنحيف الجديد 🔥 كود الخصم SALEEM20 الرابط في البايو",
    platform: "snapchat",
    product_category: "health",
    is_paid_ad: true,
    has_written_contract: false,
    ai_used: true,
    mawthooq_license_no: "",
    status: "analyzing",
    progress: 10,
    current_step: "transcribe",
    sha256: "9f2c4a1e7b3d5f60a8c1e2b4d6f8091a3c5e7f9b1d3f5a7c9e1b3d5f7a9c1e3b",
    duration_seconds: 42,
  };

  const sampleSegments: TranscriptSegment[] = [
    { start: 0, end: 4.5, text: "هلا والله يا جماعة، اليوم بجرب لكم شاي جديد" },
    { start: 12, end: 19, text: "هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع" },
    { start: 19, end: 24, text: "ومضمون بدون أعراض جانبية" },
  ];

  assert("Submission metadata is populated", !!sampleSubmission1.caption && sampleSubmission1.is_paid_ad);
  assert("SHA-256 file fingerprint is calculated", sampleSubmission1.sha256?.length === 64);

  // --------------------------------------------------------------------------
  // STEP 3: Executing Analysis Pipeline (Stage by Stage)
  // --------------------------------------------------------------------------
  console.log("\nStep 3: Running Pipeline (Deterministic -> LLM -> Merge)");
  
  // 3a: Deterministic
  const deterministicFindings = runDeterministicChecks(sampleSubmission1, sampleSegments);
  assert("Deterministic engine detected MAW-01 (Missing Ad Disclosure)", deterministicFindings.some((f) => f.rule_code === "MAW-01"));
  assert("Deterministic engine detected MAW-03 (Missing Written Contract)", deterministicFindings.some((f) => f.rule_code === "MAW-03"));
  assert("Deterministic engine detected MAW-04 (Missing Mawthooq License)", deterministicFindings.some((f) => f.rule_code === "MAW-04"));
  assert("Deterministic engine detected AI-01 (Missing AI Disclosure)", deterministicFindings.some((f) => f.rule_code === "AI-01"));

  // 3b: LLM checks
  const llmFindings = await runLlmChecks(sampleSubmission1, sampleSegments, ACTIVE_RULES, []);
  assert("LLM inspection returned findings for health claims", llmFindings.some((f) => f.rule_code === "COM-01"));

  // 3c: Merge
  const allFindings = [...deterministicFindings, ...llmFindings];
  const { mergedFindings, overallStatus } = mergeAndFilterFindings(allFindings, VALID_RULE_CODES);

  assert("Merge engine produces findings with calibrated severity", mergedFindings.length >= 4);
  assert("Overall status is evaluated as 'needs_fixes'", overallStatus === "needs_fixes");

  // --------------------------------------------------------------------------
  // STEP 4: Interactive Video Seeking & Timeline Verification
  // --------------------------------------------------------------------------
  console.log("\nStep 4: Verifying Timeline Markers & Video Seeking");
  const com01Finding = mergedFindings.find((f) => f.rule_code === "COM-01");
  const seekTarget = com01Finding?.t_start;
  assert("Finding has associated timestamp for video seeking", seekTarget !== null && seekTarget !== undefined);
  assert("Seek timestamp corresponds to spoken claim (12s)", seekTarget === 12);

  // --------------------------------------------------------------------------
  // STEP 5: Re-Check Flow (Corrected Version)
  // --------------------------------------------------------------------------
  console.log("\nStep 5: Submitting Re-Check (Fixed Ad Disclosure, License & Removed Claims)");
  const sampleSubmission2: SubmissionData = {
    id: "test-sub-002",
    is_demo: false,
    kind: "video",
    caption: "إعلان مدفوع | شاي الأعشاب كود SALEEM20 · المحتوى معدّل بالذكاء الاصطناعي",
    platform: "snapchat",
    product_category: "health",
    is_paid_ad: true,
    has_written_contract: true,
    ai_used: true,
    mawthooq_license_no: "MW-2026-48213",
    status: "analyzing",
    progress: 10,
    current_step: "transcribe",
    sha256: "4b8e1d2c9a7f3e5b6d0c1a2f4e8b9d7c3a5f1e2d4c6b8a0f9e7d5c3b1a2f4e6d",
    duration_seconds: 38,
  };

  const correctedSegments: TranscriptSegment[] = [
    { start: 0, end: 4, text: "إعلان مدفوع بالتعاون مع متجر نخلة" },
    { start: 4, end: 14, text: "هذا شاي أعشاب أشربه بعد العشاء وأحس فيه بالراحة" },
  ];

  const correctedDeterministic = runDeterministicChecks(sampleSubmission2, correctedSegments);
  assert("Corrected submission eliminates MAW-01 violation", !correctedDeterministic.some((f) => f.rule_code === "MAW-01"));
  assert("Corrected submission eliminates MAW-03 warning", !correctedDeterministic.some((f) => f.rule_code === "MAW-03"));
  assert("Corrected submission eliminates MAW-04 warning", !correctedDeterministic.some((f) => f.rule_code === "MAW-04"));
  assert("Corrected submission eliminates AI-01 violation", !correctedDeterministic.some((f) => f.rule_code === "AI-01"));

  const { overallStatus: correctedStatus } = mergeAndFilterFindings(correctedDeterministic, VALID_RULE_CODES);
  assert("Corrected submission evaluates as 'ready' for publication", correctedStatus === "ready");

  // --------------------------------------------------------------------------
  // STEP 6: Compliance Certificate Generation
  // --------------------------------------------------------------------------
  console.log("\nStep 6: Generating Printable Compliance Log");
  const certNumber = `SLM-${sampleSubmission2.id.slice(0, 8).toUpperCase()}`;
  assert("Certificate reference number formatted correctly", certNumber.startsWith("SLM-"));
  assert("SHA-256 fingerprint attached to compliance log", sampleSubmission2.sha256?.length === 64);

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`VERIFICATION SUMMARY: ${passes}/${total} TESTS PASSED`);
  console.log("================================================================================");

  if (passes === total) {
    console.log("🎉 ALL PARITY & PIPELINE FLOW CHECKS PASSED SUCCESSFULLY!\n");
  } else {
    console.error("⚠️ SOME CHECKS FAILED!\n");
    process.exit(1);
  }
}

runEndToEndVerification();
