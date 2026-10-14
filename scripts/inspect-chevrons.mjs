// Debug helper: reports the computed transform of row chevrons on a page (RTL mirroring check).
import { chromium } from "@playwright/test";
import { installMockAuth } from "./mock-auth.mjs";
const [url, lang = "ar"] = process.argv.slice(2);
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
await c.addInitScript((l) => localStorage.setItem("saleem-lang", l), lang);
await installMockAuth(c);
const p = await c.newPage();
await p.goto(url, { waitUntil: "networkidle" });
console.log(await p.evaluate(() => [...document.querySelectorAll("svg.lucide-chevron-left")].slice(0, 3).map((s) => `${s.getAttribute("class")} → ${getComputedStyle(s).transform} rotate=${getComputedStyle(s).rotate} dirAttr=${s.closest("[dir]")?.getAttribute("dir")}`)));
await b.close();
