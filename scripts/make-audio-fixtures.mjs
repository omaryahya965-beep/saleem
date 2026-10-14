// Generates the no-speech fixture clips (WebM, recorded in real time in Chromium):
//   music-only-ar.webm — synthesized music (chords + arpeggio + kick) + Arabic claim slides, no disclosure
//   no-audio-ar.webm   — video only (no audio stream), slides with a written «إعلان مدفوع» disclosure
// Usage: node scripts/make-audio-fixtures.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const dir = "backend/tests/fixtures/audio";
fs.mkdirSync(dir, { recursive: true });

const CLIPS = [
  {
    name: "music-only-ar",
    music: true,
    seconds: 14,
    slides: [
      { until: 5, bg: "#7b2cbf", lines: ["شاي التنحيف السحري", "جربوه الآن"] },
      { until: 10, bg: "#9d0208", lines: ["ينحف ٥ كيلو في أسبوع", "مضمون ١٠٠٪"] },
      { until: 99, bg: "#1b4332", lines: ["كود الخصم: SLIM50", "الرابط في البايو"] },
    ],
    sidecar: { caption: "شاي التنحيف 🔥 الرابط في البايو", platform: "tiktok", product_category: "health", is_paid_ad: true, has_written_contract: true, ai_used: false, mawthooq_license_no: "MW-2026-48213" },
    expected: [{ rule: "MAW-01", t: 0 }, { rule: "COM-01", t: 5 }],
  },
  {
    name: "no-audio-ar",
    music: false,
    seconds: 12,
    slides: [
      { until: 5, bg: "#1b4332", lines: ["إعلان مدفوع", "بالتعاون مع متجر نخلة"] },
      { until: 99, bg: "#3a5a40", lines: ["عطر العود الجديد", "متوفر في المتجر"] },
    ],
    sidecar: { caption: "عطر العود الجديد من متجر نخلة", platform: "instagram", product_category: "beauty", is_paid_ad: true, has_written_contract: true, ai_used: false, mawthooq_license_no: "MW-2026-48213" },
    expected: [],
  },
];

const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
for (const clip of CLIPS) {
  const p = await b.newPage();
  await p.setContent('<html dir="rtl"><body></body></html>');
  const b64 = await p.evaluate(async ({ slides, music, seconds }) => {
    const W = 720, H = 1280;
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const ctx = canvas.getContext("2d");
    const tracks = [...canvas.captureStream(30).getVideoTracks()];
    let ac = null;
    if (music) {
      ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      const master = ac.createGain();
      master.gain.value = 0.25;
      master.connect(dest);
      const t0 = ac.currentTime + 0.05;
      const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 293.7]];
      for (let bar = 0; bar < Math.ceil(seconds / 2); bar++) {
        const start = t0 + bar * 2;
        for (const f of chords[bar % 4]) {
          const o = ac.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = f;
          const lp = ac.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = 1200;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, start);
          g.gain.linearRampToValueAtTime(0.18, start + 0.1);
          g.gain.setValueAtTime(0.18, start + 1.85);
          g.gain.linearRampToValueAtTime(0.0001, start + 2);
          o.connect(lp).connect(g).connect(master);
          o.start(start);
          o.stop(start + 2);
        }
        for (let step = 0; step < 8; step++) {
          const s = start + step * 0.25;
          const o = ac.createOscillator();
          o.type = "triangle";
          o.frequency.value = chords[bar % 4][step % 3] * 2;
          const g = ac.createGain();
          g.gain.setValueAtTime(0.12, s);
          g.gain.exponentialRampToValueAtTime(0.001, s + 0.24);
          o.connect(g).connect(master);
          o.start(s);
          o.stop(s + 0.25);
        }
        for (let beat = 0; beat < 4; beat++) {
          const s = start + beat * 0.5;
          const o = ac.createOscillator();
          o.frequency.setValueAtTime(120, s);
          o.frequency.exponentialRampToValueAtTime(45, s + 0.15);
          const g = ac.createGain();
          g.gain.setValueAtTime(0.6, s);
          g.gain.exponentialRampToValueAtTime(0.001, s + 0.2);
          o.connect(g).connect(master);
          o.start(s);
          o.stop(s + 0.2);
        }
      }
      tracks.push(...dest.stream.getAudioTracks());
    }
    const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: music ? "video/webm;codecs=vp8,opus" : "video/webm;codecs=vp8", videoBitsPerSecond: 900_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const start = performance.now();
    const draw = () => {
      const s = (performance.now() - start) / 1000;
      const slide = slides.find((x) => s < x.until);
      ctx.fillStyle = slide.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 64px Tahoma, sans-serif";
      slide.lines.forEach((l, i) => ctx.fillText(l, W / 2, 560 + i * 110));
      if (rec.state === "recording") requestAnimationFrame(draw);
    };
    rec.start(500);
    draw();
    await new Promise((r) => setTimeout(r, seconds * 1000));
    rec.stop();
    await new Promise((r) => (rec.onstop = r));
    if (ac) await ac.close();
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }, clip);
  fs.writeFileSync(`${dir}/${clip.name}.webm`, Buffer.from(b64, "base64"));
  fs.writeFileSync(`${dir}/${clip.name}.json`, JSON.stringify({ $comment: "Generated by scripts/make-audio-fixtures.mjs", submission: clip.sidecar, expected: clip.expected }, null, 2) + "\n");
  console.log(`wrote ${dir}/${clip.name}.webm`);
  await p.close();
}
await b.close();
