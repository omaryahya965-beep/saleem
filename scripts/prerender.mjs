// Build-time prerendering of public pages (Arabic, signed-out) for fast first paint.
// Run after `vite build`:  node scripts/prerender.mjs [distDir]
// Each route gets dist/<route>/index.html with the rendered markup in <div id="prerender">.
// At runtime the SPA mounts into #root and removes #prerender before its first paint
// (see frontend/src/lib/prerender.ts); English visitors drop it immediately (inline script).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const dist = path.resolve(process.argv[2] ?? "frontend/dist");
const ROUTES = ["/", "/rules", "/login", "/signup", "/legal/terms", "/legal/privacy", "/legal/disclaimer", "/legal/ai", "/checks/d0000000-0000-0000-0000-000000000001", "/checks/d0000000-0000-0000-0000-000000000002", "/checks/d0000000-0000-0000-0000-000000000003", "/checks/d0000000-0000-0000-0000-000000000004"];
const rawTemplate = fs.readFileSync(path.join(dist, "index.html"), "utf8");
// Preload the two fonts the first screen needs (Arabic UI 400, Arabic display 700) so text
// doesn't re-layout late on slow networks.
const fonts = fs
  .readdirSync(path.join(dist, "assets"))
  .filter((f) => /^(ibm-plex-sans-arabic-arabic-400|noto-naskh-arabic-arabic-700)-normal-.*\.woff2$/.test(f));
const preloads = fonts.map((f) => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin>`).join("");
const template = rawTemplate.includes('rel="preload"') ? rawTemplate : rawTemplate.replace("</head>", `${preloads}</head>`);

const types = { ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = path.join(dist, url);
  if (url !== "/" && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(template);
});
await new Promise((r) => server.listen(4199, r));

// CI images without Chromium's system libs (e.g. Vercel): ship the plain SPA shell instead of failing.
const browser = await chromium.launch().catch((e) => {
  console.warn(`prerender skipped (no browser): ${e.message.split("\n")[0]}`);
  fs.writeFileSync(path.join(dist, "spa.html"), template);
  server.close();
  process.exit(0);
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => localStorage.setItem("saleem-lang", "ar"));
let ok = 0;
for (const route of ROUTES) {
  try {
    await page.goto(`http://localhost:4199${route}`, { waitUntil: "load", timeout: 30000 });
    await page.waitForSelector("main#main > *", { timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); // media may stream indefinitely
    const html = await page.evaluate(() => {
      const root = document.getElementById("root").cloneNode(true);
      // Strip interactive-only bits that must not appear before hydration (portals, live regions).
      root.querySelectorAll("[data-sonner-toaster], [data-radix-popper-content-wrapper]").forEach((n) => n.remove());
      return root.innerHTML;
    });
    const out = template.replace('<div id="root"></div>', `<div id="prerender" inert>${html}</div><div id="root"></div>`);
    const target = route === "/" ? path.join(dist, "index.html") : path.join(dist, route.slice(1), "index.html");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, out);
    ok++;
    console.log(`prerendered ${route} (${Math.round(html.length / 1024)} KB)`);
  } catch (e) {
    console.warn(`skipped ${route}: ${e.message.split("\n")[0]}`);
  }
}
// The SPA fallback for every other path must stay the clean template.
fs.writeFileSync(path.join(dist, "spa.html"), template);
await browser.close();
server.close();
console.log(`prerendered ${ok}/${ROUTES.length} routes`);
