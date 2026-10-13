import { chromium } from "@playwright/test";
const [url, lang, w, out, ...ys] = process.argv.slice(2);
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: +w, height: 900 } });
await c.addInitScript((l) => localStorage.setItem("saleem-lang", l), lang);
const p = await c.newPage(); await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(500);
for (const y of ys) await p.screenshot({ path: `${out}-${y}.png`, fullPage: true, clip: { x: 0, y: +y, width: +w, height: 900 } });
await b.close();
