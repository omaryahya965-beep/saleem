// Lists elements wider than the viewport. Usage: node scripts/find-overflow.mjs <url> [--mock=user] [--lang=ar]
import { chromium } from "@playwright/test";
import { installMockAuth } from "./mock-auth.mjs";
const url = process.argv[2];
const mock = process.argv.find((a) => a.startsWith("--mock="))?.slice(7);
const lang = process.argv.find((a) => a.startsWith("--lang="))?.slice(7) ?? "ar";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
await c.addInitScript((l) => localStorage.setItem("saleem-lang", l), lang);
if (mock) await installMockAuth(c, { empty: mock === "empty" });
const p = await c.newPage();
await p.goto(url, { waitUntil: "networkidle" });
const out = await p.evaluate(() => {
  const W = document.documentElement.clientWidth;
  return [...document.querySelectorAll("body *")]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.right > W + 1 || r.left < -1)
    .slice(0, 12)
    .map(({ el, r }) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
});
console.log(out.join("\n") || "no overflow");
await b.close();
