// Route audit: signs in as each demo persona through the real login form and opens every app route, recording
// HTTP failures (>= 400 or no response), console errors and visible error states. Read-only: it never clicks
// actions. Usage: node scripts/route-audit.mjs [baseURL]   (needs `npm run demo:seed` and a build against local DB)
import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:4174";
const { password, org_id } = JSON.parse(fs.readFileSync("demo/.demo-credentials.json", "utf8"));
const ROUTES = [
  "/dashboard", "/promotions", "/new", "/queue", "/rules", "/company-rules", "/claims", "/disclaimers", "/products",
  "/org", `/org/${org_id}`, "/roles", "/features", "/analytics", "/audit", "/ask", "/archive", "/settings",
  "/admin/metrics",
];
const PERSONAS = ["admin", "lead", "reviewer", "legal", "marketer", "partner", "viewer"];
const ERROR_TEXT = /تعذّر|حدث خطأ|غير متاح|الخادم|Something went wrong|failed to/i;

const browser = await chromium.launch();
const report = [];
for (const who of PERSONAS) {
  const ctx = await browser.newContext({ locale: "ar" });
  const page = await ctx.newPage();
  let current = "";
  const issues = [];
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && /54321/.test(u)) issues.push({ route: current, kind: `http_${r.status()}`, url: u.replace(/\?.*/, "").replace(/^.*54321/, "") });
  });
  page.on("requestfailed", (r) => {
    if (/54321/.test(r.url())) issues.push({ route: current, kind: "request_failed", url: r.url().replace(/\?.*/, "").replace(/^.*54321/, ""), why: r.failure()?.errorText });
  });
  page.on("console", (m) => {
    if (m.type() === "error") issues.push({ route: current, kind: "console", text: m.text().slice(0, 160) });
  });
  page.on("pageerror", (e) => issues.push({ route: current, kind: "pageerror", text: String(e).slice(0, 160) }));
  await page.goto(`${base}/login`);
  await page.locator("html[data-app-ready]").waitFor({ state: "attached" });
  await page.locator('input[type="email"]').fill(`${who}@demo.saleem.app`);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => issues.push({ route: "/login", kind: "login_failed" }));
  for (const r of ROUTES) {
    current = r;
    await page.goto(`${base}${r}`);
    await page.locator("html[data-app-ready]").waitFor({ state: "attached" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    const main = (await page.locator("main").innerText().catch(() => "")).trim();
    if (!main) issues.push({ route: r, kind: "empty_main" });
    const alert = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
    const errLine = main.split("\n").find((l) => ERROR_TEXT.test(l));
    if (alert.length || errLine) issues.push({ route: r, kind: "error_state", text: (alert.join(" | ") || errLine || "").slice(0, 160) });
  }
  report.push({ who, issues });
  await ctx.close();
}
await browser.close();
for (const { who, issues } of report) {
  console.log(`\n## ${who}: ${issues.length} issue(s)`);
  const seen = new Set();
  for (const i of issues) {
    const k = JSON.stringify(i);
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`  ${i.route} :: ${i.kind} ${i.url ?? ""} ${i.text ?? i.why ?? ""}`);
  }
}
