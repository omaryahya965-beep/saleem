// Runs real clips end-to-end through the production pipeline modules.
//   npm run clips [-- <file-or-dir> ...]      (default: tests/fixtures, recursively)
// For each .mp4/.mov/.webm: headless Chromium runs the SAME browser extraction code the app uses
// (frames 1/s ≤ 60 + first/last ≤ 768 px, mono 16 kHz WAV) → ASR → vision/reasoning model →
// deterministic checks → merge. Writes docs/demo/clips/<name>.json, contact sheet frames and a
// markdown summary (docs/demo/CLIPS.md). Optional sidecar <clip>.json sets submission fields
// (caption, is_paid_ad, …) and "expected" rules for scoring.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analysisProvider, config, transcriptionProvider } from "../supabase/functions/_shared/providers/index.ts";
import { runDeterministicChecks } from "../supabase/functions/_shared/rules/deterministic.ts";
import { mergeAndFilterFindings } from "../supabase/functions/_shared/pipeline/merge.ts";
import { audioCost, textCost } from "../supabase/functions/_shared/pipeline/cost.ts";
import type { SubmissionData } from "../supabase/functions/_shared/types.ts";
import { loadEnv, loadRules } from "./lib.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(root, "docs/demo/clips");
fs.mkdirSync(outDir, { recursive: true });
const env = loadEnv();
const cfg = config(env);

function findClips(p: string): string[] {
  if (!fs.existsSync(p)) return [];
  if (fs.statSync(p).isFile()) return /\.(mp4|mov|webm)$/i.test(p) ? [p] : [];
  return fs.readdirSync(p).flatMap((f) => findClips(path.join(p, f)));
}

// Bundle the app's extraction module for the browser (same code as production).
const bundle = path.join(here, "results/extract.iife.js");
const entry = path.join(root, "frontend/src/__clip_entry.ts");
fs.writeFileSync(entry, 'export { extractFrames, extractAudio } from "./lib/extract";\nexport { inspectMedia } from "./lib/media";\n');
try {
  execFileSync(process.execPath, [path.join(root, "node_modules/rolldown/bin/cli.mjs"), entry, "--format", "iife", "--name", "SX", "-o", bundle], { stdio: "ignore" });
} finally {
  fs.rmSync(entry);
}

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : [path.join(here, "../tests/fixtures")]).flatMap(findClips);
if (!targets.length) {
  console.log("No clips found. Put .mp4/.mov/.webm files in backend/tests/fixtures/ and re-run.");
  process.exit(0);
}

const rules = await loadRules(env);
const browser = await chromium.launch();
const summary: string[] = [];

for (const file of targets) {
  const name = path.basename(file).replace(/\.[^.]+$/, "");
  const sidecarPath = file.replace(/\.[^.]+$/, ".json");
  const sidecar = fs.existsSync(sidecarPath) ? JSON.parse(fs.readFileSync(sidecarPath, "utf8")) : {};
  console.log(`\n▶ ${path.relative(root, file)}`);
  const t0 = Date.now();

  const page = await browser.newPage();
  await page.setContent("<html><body></body></html>");
  await page.addScriptTag({ path: bundle });
  const b64 = fs.readFileSync(file).toString("base64");
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === "mov" ? "video/quicktime" : `video/${ext}`;
  // Plain JS string: tsx would otherwise inject helpers that don't exist in the page.
  await page.addScriptTag({
    content: `window.runClip = async (b64, mime, fname) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const f = new File([bytes], fname, { type: mime });
      const insp = await SX.inspectMedia(f, "video");
      const frames = await SX.extractFrames(f);
      const audio = await SX.extractAudio(f);
      const toB64 = async (b) => { const u = new Uint8Array(await b.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
      return {
        inspect: insp.ok ? { duration: insp.media.duration, width: insp.media.width, height: insp.media.height } : { error: insp.error },
        frames: await Promise.all(frames.map(async (fr) => ({ t: fr.t, b64: await toB64(fr.blob) }))),
        audio: audio ? await toB64(audio) : null,
      };
    };`,
  });
  const extracted = (await page.evaluate(
    (a: string[]) => (window as unknown as { runClip: (...x: string[]) => Promise<unknown> }).runClip(a[0]!, a[1]!, a[2]!),
    [b64, mime, path.basename(file)],
  )) as { inspect: { duration?: number }; frames: { t: number; b64: string }[]; audio: string | null };
  await page.close();
  const extractMs = Date.now() - t0;
  const duration = (extracted.inspect as { duration?: number }).duration ?? null;
  console.log(`  extracted ${extracted.frames.length} frames, audio ${extracted.audio ? "yes" : "no"}, duration ${duration?.toFixed(1)} s (${extractMs} ms)`);

  const frameDir = path.join(outDir, name);
  fs.mkdirSync(frameDir, { recursive: true });
  extracted.frames.forEach((f, i) => i % 5 === 0 && fs.writeFileSync(path.join(frameDir, `${String(Math.round(f.t * 1000)).padStart(7, "0")}.jpg`), Buffer.from(f.b64, "base64")));

  let t1 = Date.now();
  const audioBlob = extracted.audio ? new Blob([Buffer.from(extracted.audio, "base64")], { type: "audio/wav" }) : new Blob([fs.readFileSync(file)], { type: mime });
  const asr = await transcriptionProvider(env).transcribe(audioBlob, extracted.audio ? "audio.wav" : path.basename(file));
  const asrMs = Date.now() - t1;

  const sub: SubmissionData = {
    id: name, is_demo: false, kind: "video", caption: "", platform: "snapchat", product_category: "other",
    is_paid_ad: false, has_written_contract: false, ai_used: false, mawthooq_license_no: null,
    status: "analyzing", progress: 0, current_step: "llm", duration_seconds: duration, ...sidecar.submission,
  };
  t1 = Date.now();
  const llm = await analysisProvider(env).analyze({
    submission: sub, segments: asr.segments, rules, duration,
    frames: extracted.frames.map((f) => ({ t: f.t, url: `data:image/jpeg;base64,${f.b64}` })),
  });
  const llmMs = Date.now() - t1;
  const det = runDeterministicChecks(sub, asr.segments, llm.on_screen_text);
  const merged = mergeAndFilterFindings([...det.findings, ...llm.findings], new Set(rules.map((r) => r.code)));
  const cost = textCost(llm.model, llm.usage) + audioCost(asr.model, asr.seconds);
  const totalMs = Date.now() - t0;

  const result = {
    clip: path.relative(root, file).replace(/\\/g, "/"), at: new Date().toISOString(), models: { asr: asr.model, llm: llm.model },
    duration, frames: extracted.frames.length, timings_ms: { extract: extractMs, asr: asrMs, llm: llmMs, total: totalMs },
    usage: llm.usage, cost_usd: cost, status: merged.overallStatus, transcript: asr.segments, on_screen_text: llm.on_screen_text,
    findings: merged.mergedFindings, dropped: merged.dropped, expected: sidecar.expected ?? null,
  };
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(result, null, 2));
  console.log(`  ${merged.overallStatus} · ${merged.mergedFindings.length} findings · ${(totalMs / 1000).toFixed(1)} s · $${cost.toFixed(4)}`);
  for (const f of merged.mergedFindings) console.log(`    ${f.rule_code} ${f.severity.padEnd(9)} t=${f.t_start ?? "—"} [${f.source}] ${f.evidence_text ?? ""}`);

  summary.push(
    `## ${name}\n\n- Clip: \`${result.clip}\` · ${duration?.toFixed(1)} s · ${extracted.frames.length} frames\n- Models: ${asr.model} + ${llm.model}\n- Time: ${(totalMs / 1000).toFixed(1)} s (extract ${(extractMs / 1000).toFixed(1)}, ASR ${(asrMs / 1000).toFixed(1)}, model ${(llmMs / 1000).toFixed(1)}) · Cost: $${cost.toFixed(4)}\n- Status: **${merged.overallStatus}**\n\n| Rule | Severity | Time | Source | Evidence |\n|---|---|---|---|---|\n` +
      merged.mergedFindings.map((f) => `| ${f.rule_code} | ${f.severity} | ${f.t_start ?? "—"} | ${f.source} | ${(f.evidence_text ?? "").replace(/\|/g, "/")} |`).join("\n") +
      `\n\nTranscript:\n\n${asr.segments.map((s) => `- [${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`).join("\n")}\n`,
  );
}
await browser.close();
fs.writeFileSync(
  path.join(root, "docs/demo/CLIPS.md"),
  `# Clip runs\n\nGenerated by \`npm run clips\` on ${new Date().toISOString()} with ${cfg.transcriptionModel} + ${cfg.llmModel}.\nRaw results: \`docs/demo/clips/*.json\`; sample frames: \`docs/demo/clips/<clip>/\`.\n\n${summary.join("\n")}`,
);
console.log("\nWrote docs/demo/CLIPS.md");
