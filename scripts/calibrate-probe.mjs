// Runs the browser speech-presence probe (same code as the app) on clips and prints its features.
// Usage: node scripts/calibrate-probe.mjs <bundle.iife.js> <clip>...
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const [bundle, ...clips] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent("<html><body></body></html>");
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ content: `window.run = async (b64, name) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const r = await SX.extractAudioWithProbe(new File([u], name, { type: name.endsWith(".mp3") ? "audio/mpeg" : "video/webm" })); return { wav: !!r.wav, probe: r.probe }; };` });
for (const c of clips) {
  const r = await p.evaluate(([b64, n]) => window.run(b64, n), [fs.readFileSync(c).toString("base64"), path.basename(c)]);
  console.log(path.basename(c).padEnd(26), JSON.stringify({ wav: r.wav, verdict: r.probe?.verdict, score: r.probe?.speech_score, ...r.probe?.stats }));
}
await b.close();
