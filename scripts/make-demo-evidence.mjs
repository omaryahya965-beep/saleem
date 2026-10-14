// Builds the blurred evidence thumbnails for the public demo report (same pixelation as the server:
// backend/supabase/functions/_shared/media/blur.ts). Usage: node scripts/make-demo-evidence.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const clip = "frontend/public/demo/slimming-tea-ar.webm";
const times = [12, 17];
const src = fs.readFileSync("backend/supabase/functions/_shared/media/blur.ts", "utf8")
  .replace(/export /g, "").replace(/: Uint8ClampedArray \| Uint8Array|: number|: string/g, "");
const b = await chromium.launch();
const page = await b.newPage();
await page.setContent(`<video id=v muted src="data:video/webm;base64,${fs.readFileSync(clip).toString("base64")}"></video>`);
for (const t of times) {
  const dataUrl = await page.evaluate(async ({ t, src }) => {
    const v = document.getElementById("v");
    if (v.readyState < 1) await new Promise((r) => (v.onloadedmetadata = r));
    v.currentTime = t;
    await new Promise((r) => (v.onseeked = r));
    const scale = 768 / Math.max(v.videoWidth, v.videoHeight);
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(v.videoWidth * scale), height: Math.round(v.videoHeight * scale) });
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    new Function("px", "w", "h", `${src}; pixelateRgba(px, w, h);`)(img.data, c.width, c.height);
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/jpeg", 0.7);
  }, { t, src });
  fs.writeFileSync(`frontend/public/demo/evidence/${t}.jpg`, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`wrote ${t}.jpg`);
}
await b.close();
