// Screenshots routes at desktop 1440×900 and mobile 390×844, in Arabic and English.
// Usage: node scripts/shoot.mjs <outDir> <name=/path>... [--base=http://localhost:3000] [--auth=email:password]
// Console errors / failed requests are written to <outDir>/console-log.txt and printed.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const base = opt("base") ?? "http://localhost:3000";
const auth = opt("auth");
const only = opt("only"); // e.g. --only=desktop-ar
const [outDir, ...targets] = args.filter((a) => !a.startsWith("--"));
fs.mkdirSync(outDir, { recursive: true });

const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const problems = [];
const browser = await chromium.launch();

for (const [vp, viewport] of Object.entries(viewports)) {
  for (const lang of ["ar", "en"]) {
    if (only && only !== `${vp}-${lang}`) continue;
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    await context.addInitScript((l) => localStorage.setItem("saleem-lang", l), lang);
    if (auth) {
      const page = await context.newPage();
      await page.goto(`${base}/login`);
      const [email, password] = auth.split(":");
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
      await page.close();
    }
    for (const target of targets) {
      const [name, path] = target.split("=");
      const page = await context.newPage();
      const tag = `[${vp}/${lang}/${name}]`;
      page.on("console", (m) => m.type() === "error" && problems.push(`${tag} console.error: ${m.text().slice(0, 300)}`));
      page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message.slice(0, 300)}`));
      page.on("response", (r) => r.status() >= 400 && problems.push(`${tag} HTTP ${r.status()} ${r.url()}`));
      await page.goto(`${base}/${path.replace(/^\//, "")}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${outDir}/${name}.${vp}.${lang}.png`, fullPage: true });
      await page.close();
    }
    await context.close();
  }
}
await browser.close();
fs.writeFileSync(`${outDir}/console-log.txt`, problems.join("\n") + (problems.length ? "\n" : ""));
console.log(problems.length ? problems.join("\n") : "no console errors / failed requests");
