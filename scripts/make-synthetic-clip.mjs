// Builds a synthetic Saudi-dialect ad clip (WebM: VP8 + Opus) from the TTS audio and on-screen
// Arabic slides, recorded in real time with MediaRecorder.
// Usage: node scripts/make-synthetic-clip.mjs [name] [slides.json]   (default: slimming-tea-ar, built-in slides)
// Reads backend/tests/fixtures/synthetic/<name>.mp3, writes <name>.webm.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const dir = "backend/tests/fixtures/synthetic";
const name = process.argv[2] ?? "slimming-tea-ar";
const slidesArg = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : null;
const audio = fs.readFileSync(`${dir}/${name}.mp3`).toString("base64");
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage();
await p.setContent('<html dir="rtl"><body></body></html>');
const out = await p.evaluate(async ([audioB64, customSlides]) => {
  const W = 720, H = 1280;
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = canvas.getContext("2d");
  const ac = new AudioContext();
  const buf = await ac.decodeAudioData(Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0)).buffer);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const dest = ac.createMediaStreamDestination();
  src.connect(dest);
  const slides = customSlides ?? [
    { until: 8, bg: "#3a5a40", lines: ["تجربتي مع", "شاي الأعشاب الجديد"] },
    { until: 15, bg: "#9d0208", lines: ["ينحف ٥ كيلو", "في أسبوع — مضمون!"] },
    { until: 99, bg: "#1b4332", lines: ["كود الخصم: SLIM50", "الرابط في البايو"] },
  ];
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus", videoBitsPerSecond: 900_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const t0 = performance.now();
  const draw = () => {
    const s = (performance.now() - t0) / 1000;
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
  src.start();
  draw();
  await new Promise((r) => (src.onended = r));
  await new Promise((r) => setTimeout(r, 400));
  rec.stop();
  await new Promise((r) => (rec.onstop = r));
  const blob = new Blob(chunks, { type: "video/webm" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { b64: btoa(bin), seconds: buf.duration };
}, [audio, slidesArg]);
fs.writeFileSync(`${dir}/${name}.webm`, Buffer.from(out.b64, "base64"));
console.log(`wrote ${dir}/${name}.webm (${out.seconds.toFixed(1)} s)`);
await b.close();
