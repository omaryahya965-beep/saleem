// Real-browser check of frame + audio extraction: records a 6 s WebM (canvas + 440 Hz tone)
// with MediaRecorder, then runs the bundled extract module on it.
// Usage: node scripts/verify-extract.mjs <extract.iife.js>
import { chromium } from "@playwright/test";
import fs from "node:fs";
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage();
await p.setContent("<html><body></body></html>");
await p.addScriptTag({ content: fs.readFileSync(process.argv[2], "utf8") });
const out = await p.evaluate(async () => {
  const canvas = Object.assign(document.createElement("canvas"), { width: 1280, height: 720 });
  const ctx = canvas.getContext("2d");
  const ac = new AudioContext();
  const osc = ac.createOscillator();
  const dest = ac.createMediaStreamDestination();
  osc.connect(dest);
  osc.start();
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const start = performance.now();
  const draw = () => {
    const s = (performance.now() - start) / 1000;
    ctx.fillStyle = `hsl(${(s * 60) % 360} 60% 40%)`;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = "#fff";
    ctx.font = "120px sans-serif";
    ctx.fillText(s.toFixed(1), 80, 400);
    if (rec.state === "recording") requestAnimationFrame(draw);
  };
  rec.start(250);
  draw();
  await new Promise((r) => setTimeout(r, 6000));
  rec.stop();
  await new Promise((r) => (rec.onstop = r));
  osc.stop();
  const file = new File(chunks, "test.webm", { type: "video/webm" });
  const frames = await SX.extractFrames(file);
  const bmp = await createImageBitmap(frames[1].blob);
  const audio = await SX.extractAudio(file);
  return {
    fileKB: Math.round(file.size / 1024),
    frames: frames.length,
    times: frames.map((f) => f.t),
    frameSize: [bmp.width, bmp.height],
    audioKB: audio ? Math.round(audio.size / 1024) : null,
    audioType: audio?.type,
    inspected: await SX.inspectMedia(file, "video").then((r) => (r.ok ? { duration: Math.round(r.media.duration * 10) / 10, poster: !!r.media.previewUrl } : r.error)),
  };
});
console.log(JSON.stringify(out));
await b.close();
