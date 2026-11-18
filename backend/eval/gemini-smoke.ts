// Opt-in LIVE Google calls on synthetic Arabic ads. Never imports or writes production data.
// npm --workspace backend run smoke:gemini [-- --case=clean-text]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GeminiAnalysis, GeminiTranscription, GEMINI_DEFAULT_MODEL, geminiError } from "../supabase/functions/_shared/providers/gemini.ts";
import { SchemaError } from "../supabase/functions/_shared/pipeline/schema.ts";
import { mergeAndFilterFindings } from "../supabase/functions/_shared/pipeline/merge.ts";
import { AUDIO_REVIEW, reviewReasons, reviewedStatus } from "../supabase/functions/_shared/pipeline/review.ts";
import { runDeterministicChecks } from "../supabase/functions/_shared/rules/deterministic.ts";
import { decideAudioMode, filterSegments } from "../supabase/functions/_shared/rules/speech.ts";
import type { AnalysisRequest } from "../supabase/functions/_shared/providers/types.ts";
import { loadEnv, loadSeedRuleRecords } from "./lib.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
const model = env("GEMINI_MODEL") || GEMINI_DEFAULT_MODEL;
const rules = loadSeedRuleRecords();
const key = env("GEMINI_API_KEY");
if (!key || key === "your-gemini-api-key") { console.error("GEMINI_API_KEY is missing from the server environment."); process.exit(1); }
const analysis = new GeminiAnalysis(key, model);
const asr = new GeminiTranscription(key, model);
const only = process.argv.find((a) => a.startsWith("--case="))?.slice(7);
const cases = [
  { id: "clean-text", text: "#إعلان قهوة عربية بطعم الهيل، عبوة 250 جرام.", expected: [] },
  { id: "misleading-text", text: "#إعلان هذا الشاي ينحف خمسة كيلو في أسبوع، مضمون بدون أعراض جانبية.", expected: ["COM-01"] },
  { id: "multiple-text", text: "هذا الشاي ينحف خمسة كيلو في أسبوع. استخدموا كود SALEEM20 والرابط في البايو.", expected: ["COM-01", "MAW-01"] },
  { id: "claim-image", image: "frame-12s.jpg", expected: ["COM-01"] },
  { id: "saudi-video", audio: "slimming-tea-ar.mp3", image: "frame-12s.jpg", expected: ["COM-01", "MAW-01"] },
] as const;
const results: Record<string, unknown>[] = [];
for (const c of cases.filter((c) => !only || c.id === only)) {
  const t0 = Date.now();
  try {
    const req: AnalysisRequest = {
      submission: { id: c.id, is_demo: false, kind: "audio" in c ? "video" : "image" in c ? "image" : "text", text_content: "text" in c ? c.text : "", caption: "", platform: "snapchat", product_category: "other", is_paid_ad: true, has_written_contract: true, ai_used: false, mawthooq_license_no: "TEST", status: "analyzing", progress: 0, current_step: "llm" },
      segments: [], frames: [], rules, duration: "audio" in c ? 33 : null,
    };
    let uncertainSpeech = false;
    if ("audio" in c) {
      const file = path.resolve(here, "../tests/fixtures/synthetic", c.audio);
      const transcript = await asr.transcribe(new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }), c.audio);
      const filtered = filterSegments(transcript.scored);
      req.segments = filtered.kept;
      req.submission.audio_mode = decideAudioMode({ hasAudioStream: true, kept: filtered.kept });
      uncertainSpeech = Boolean(transcript.requires_human_review || filtered.dropped.length);
    }
    if ("image" in c) {
      const bytes = fs.readFileSync(path.resolve(here, "../tests/fixtures/synthetic", c.image));
      req.frames = [{ t: "audio" in c ? 12 : 0, url: `data:image/jpeg;base64,${bytes.toString("base64")}` }];
    }
    const result = await analysis.analyze(req);
    const det = runDeterministicChecks(req.submission, req.segments, result.on_screen_text);
    const merged = mergeAndFilterFindings([...det.findings, ...result.findings], new Set(rules.map((r) => r.code)));
    const reasons = reviewReasons(result.review_reasons, uncertainSpeech ? [AUDIO_REVIEW] : []);
    const codes = [...new Set(merged.mergedFindings.map((f) => f.rule_code))];
    const ok = c.expected.every((code) => codes.includes(code)) && (c.expected.length > 0 || codes.length === 0);
    results.push({ id: c.id, ok, ms: Date.now() - t0, status: reviewedStatus(merged.overallStatus, reasons), codes, llm_findings: result.findings.length, transcript_segments: req.segments.length, ocr_items: result.on_screen_text.length, review_reasons: reasons, usage: result.usage });
    console.log(JSON.stringify(results.at(-1)));
  } catch (error) {
    const safe = error instanceof SchemaError ? { code: "invalid_response", message: error.message } : { code: geminiError(error).info?.code ?? "provider_failure", message: geminiError(error).message };
    results.push({ id: c.id, ok: false, ms: Date.now() - t0, error: safe });
    console.error(JSON.stringify(results.at(-1)));
    // Permanent credential/access errors affect every case; don't repeat paid/invalid calls.
    if (["invalid_key", "no_access", "model_not_found"].includes(safe.code)) break;
  }
}
const report = { at: new Date().toISOString(), live: true, model, sdk: "@google/genai@3.3.0", rulebook: "existing illustrative seed, pending legal review", results };
fs.writeFileSync(path.join(here, "results/gemini-live.json"), JSON.stringify(report, null, 2));
if (!results.length || results.some((r) => !r.ok)) process.exitCode = 1;
