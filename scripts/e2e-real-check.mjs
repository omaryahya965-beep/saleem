// Real end-to-end check through the deployed pipeline (no mocks): signs in as a test account,
// uploads a clip on /new, waits for the report and prints stage timings, findings and the run cost.
// Usage: node scripts/e2e-real-check.mjs [clip] [base]   (default: synthetic slimming-tea ad, localhost:4173)
import { chromium } from "@playwright/test";
import fs from "node:fs";

const clip = process.argv[2] ?? "backend/tests/fixtures/synthetic/slimming-tea-ar.webm";
const base = process.argv[3] ?? "http://localhost:4173";
const env = Object.fromEntries(fs.readFileSync("backend/.env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.setItem("saleem-lang", "ar"));
const t0 = Date.now();
const stamp = (m) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s  ${m}`);

await page.goto(`${base}/login`);
await page.locator("html[data-app-ready]").waitFor({ state: "attached" });
await page.getByRole("button", { name: /demo@saleem\.app/ }).click();
await page.waitForURL(/\/dashboard/);
stamp("signed in as demo@saleem.app");

await page.goto(`${base}/new`);
await page.locator('input[type="file"]').setInputFiles(clip);
await page.getByText(/المدة/).first().waitFor({ timeout: 20000 });
await page.getByLabel(/الوصف \(الكابشن\)/).fill("جربت شاي التنحيف الجديد 🔥 الرابط في البايو");
await page.getByLabel(/اسم الفحص/).fill(`اختبار شامل ${new Date().toISOString().slice(11, 19)}`);
await page.getByText(/أؤكد أن لدي الحق/).click();
await page.locator("form#new-check").evaluate((f) => f.requestSubmit());
await page.waitForURL(/\/checks\/[0-9a-f-]{36}$/, { timeout: 120000 });
const id = page.url().split("/").pop();
stamp(`submitted → /checks/${id}`);

let last = "";
const deadline = Date.now() + 6 * 60_000;
while (Date.now() < deadline) {
  const status = await page.locator("#report-status").textContent({ timeout: 1000 }).catch(() => null);
  if (status) {
    stamp(`report: ${status.trim()}`);
    break;
  }
  const failed = await page.getByText("تعذّر إكمال الفحص").isVisible().catch(() => false);
  if (failed) {
    stamp(`FAILED: ${(await page.locator('[class*="bg-red-bg"]').first().innerText().catch(() => "")).replace(/\s+/g, " ")}`);
    break;
  }
  const progress = await page.getByRole("progressbar").getAttribute("aria-valuenow").catch(() => null);
  const step = await page.locator('[aria-current="step"]').innerText().catch(() => "");
  const now = `${progress ?? "?"}% ${step.trim()}`;
  if (now !== last) stamp(`processing ${now}`);
  last = now;
  await page.waitForTimeout(1500);
}

const cards = await page.locator("article").evaluateAll((els) => els.map((e) => e.innerText.split("\n").slice(0, 4).join(" | ")));
for (const c of cards) console.log("   •", c.replace(/\s+/g, " ").slice(0, 150));
await page.screenshot({ path: "docs/demo/real-check-report.png", fullPage: true });

// Run metadata (cost, models, durations) via the user's own session — readable through RLS.
const tok = await (await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: "demo@saleem.app", password: "demo123456" }) })).json();
const runs = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/analysis_runs?select=llm_model,asr_model,cost_usd,durations_ms,token_usage,frames_count,status&submission_id=eq.${id}`, { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${tok.access_token}` } })).json();
console.log("run:", JSON.stringify(runs[0]));
await b.close();
