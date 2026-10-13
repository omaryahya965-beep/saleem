// Live smoke test of the production pipeline modules against OpenAI (costs ≈ $0.02–0.05).
//   npx tsx eval/provider-smoke.ts
// 1. Synthesizes an Arabic "slimming tea" ad with TTS (cached in tests/fixtures/synthetic/)
// 2. Transcribes it with TRANSCRIPTION_MODEL (segments + timestamps)
// 3. Analyzes transcript + a frame with on-screen Arabic text with LLM_MODEL (strict JSON)
// 4. Runs deterministic checks + merge, prints findings, timings, tokens and cost.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analysisProvider, config, transcriptionProvider } from "../supabase/functions/_shared/providers/index.ts";
import { runDeterministicChecks } from "../supabase/functions/_shared/rules/deterministic.ts";
import { mergeAndFilterFindings } from "../supabase/functions/_shared/pipeline/merge.ts";
import { audioCost, textCost } from "../supabase/functions/_shared/pipeline/cost.ts";
import { loadEnv, loadRules } from "./lib.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, "../tests/fixtures/synthetic");
const env = loadEnv();

const SCRIPT =
  "هلا والله يا جماعة، اليوم بجرب لكم شاي جديد. صراحة طعمه حلو وريحته تجنن. " +
  "هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع، ومضمون بدون أعراض جانبية. " +
  "استخدموا كود سليم عشرين والرابط في البايو، اطلبوا الحين قبل لا يخلص.";

async function tts(file: string) {
  if (fs.existsSync(file)) return;
  for (const model of ["gpt-4o-mini-tts", "tts-1"]) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice: "alloy", input: SCRIPT, response_format: "mp3" }),
    });
    if (res.ok) {
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log(`TTS: ${model} → ${path.basename(file)}`);
      return;
    }
    console.warn(`TTS ${model} failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  }
  throw new Error("TTS unavailable");
}

const audioFile = path.join(fixtures, "slimming-tea-ar.mp3");
await tts(audioFile);
const cfg = config(env);
console.log("models:", cfg.transcriptionModel, "+", cfg.llmModel);

let t0 = Date.now();
const asr = await transcriptionProvider(env).transcribe(new Blob([fs.readFileSync(audioFile)], { type: "audio/mpeg" }), "slimming-tea-ar.mp3");
const asrMs = Date.now() - t0;
console.log(`\nASR (${asr.model}, ${asrMs} ms, ${asr.seconds.toFixed(1)} s audio): ${asr.segments.length} segments`);
for (const s of asr.segments) console.log(`  [${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`);

const frame = fs.readFileSync(path.join(fixtures, "frame-12s.jpg")).toString("base64");
const rules = await loadRules(env);
const submission = {
  id: "smoke", is_demo: false, kind: "video" as const, caption: "جربت شاي التنحيف الجديد 🔥", platform: "snapchat",
  product_category: "health", is_paid_ad: true, has_written_contract: false, ai_used: false, mawthooq_license_no: null,
  status: "analyzing", progress: 0, current_step: "llm" as const, duration_seconds: asr.seconds,
};

t0 = Date.now();
const llm = await analysisProvider(env).analyze({
  submission, segments: asr.segments, rules, duration: asr.seconds,
  frames: [{ t: 12, url: `data:image/jpeg;base64,${frame}` }],
});
const llmMs = Date.now() - t0;
console.log(`\nLLM (${llm.model}, ${llmMs} ms, attempts ${llm.attempts}): ${llm.findings.length} findings, usage`, llm.usage);
console.log("on-screen text:", llm.on_screen_text);

const det = runDeterministicChecks(submission, asr.segments, llm.on_screen_text);
const merged = mergeAndFilterFindings([...det.findings, ...llm.findings], new Set(rules.map((r) => r.code)));
console.log(`\nMerged: ${merged.overallStatus}`, merged.dropped);
for (const f of merged.mergedFindings)
  console.log(`  ${f.rule_code} ${f.severity.padEnd(9)} t=${f.t_start ?? "—"} conf=${f.confidence.toFixed(2)} [${f.source}] ${f.evidence_text ?? ""}`);

const cost = textCost(llm.model, llm.usage) + audioCost(asr.model, asr.seconds);
console.log(`\nCost: $${cost.toFixed(4)}  (asr $${audioCost(asr.model, asr.seconds).toFixed(4)}, llm $${textCost(llm.model, llm.usage).toFixed(4)})`);
fs.writeFileSync(
  path.resolve(here, "results/provider-smoke.json"),
  JSON.stringify({ at: new Date().toISOString(), models: { asr: asr.model, llm: llm.model }, asrMs, llmMs, usage: llm.usage, cost, segments: asr.segments, on_screen_text: llm.on_screen_text, findings: merged.mergedFindings, status: merged.overallStatus }, null, 2),
);
