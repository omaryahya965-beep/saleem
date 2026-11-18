// Demo personas end to end (real login buttons, real database): each persona lands on /dashboard with its role home,
// and sees its own navigation. Server-side enforcement of every forbidden cell is tested by p8_roles_matrix (pgTAP).
// Needs: npm run demo:seed, a demo build (VITE_DEMO_MODE=true + VITE_DEMO_PASSWORD), preview on the given URL.
// Usage: node scripts/check-demo-personas.mjs [baseURL]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:4174";
const EXPECT = {
  marketer: { has: ["new", "promotions"], not: ["queue", "features"], title: "المسوّق" },
  lead: { has: ["queue", "companyRules", "analytics"], not: ["features", "new"], title: "قائد الالتزام" },
  admin: { has: ["team", "roles", "features"], not: [], title: "المالك" },
  partner: { has: ["promotions"], not: ["team", "roles", "claims", "new", "audit"], title: null },
  viewer: { has: ["promotions", "audit"], not: ["new", "queue", "features"], title: "مطّلع" },
};
const browser = await chromium.launch();
let failed = 0;
for (const [key, exp] of Object.entries(EXPECT)) {
  const ctx = await browser.newContext({ locale: "ar" });
  const page = await ctx.newPage();
  const out = [];
  try {
    await page.goto(`${base}/login`);
    await page.getByTestId(`persona-${key}`).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    const nav = await page.locator("[data-testid=app-sidebar] a").evaluateAll((as) => as.map((a) => a.dataset.testid.replace("nav-", "")));
    for (const k of exp.has) if (!nav.includes(k)) out.push(`missing nav ${k}`);
    for (const k of exp.not) if (nav.includes(k)) out.push(`unexpected nav ${k}`);
    if (exp.title) {
      const home = await page.getByTestId("role-home").innerText().catch(() => "");
      if (!home.includes(exp.title)) out.push(`role home missing «${exp.title}»`);
    }
    console.log(`${out.length ? "✗" : "✓"} ${key}: nav=[${nav.join(",")}] ${out.join("; ")}`);
    if (out.length) failed++;
  } catch (e) {
    failed++;
    console.log(`✗ ${key}: ${String(e).slice(0, 200)}`);
  }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
