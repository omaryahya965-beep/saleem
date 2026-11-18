// One-click demo, all nine roles, in a real browser against the real local stack (demo-login broker + database):
// login page → «استكشاف الحسابات التجريبية» → «الدخول بهذا الدور» → dashboard. Checks per role: the session is that
// role (account menu), its navigation, the demo banner, reload keeps the session, sign-out ends it.
// Server-side enforcement of every forbidden action is tested by pgTAP p8_roles_matrix and backend workflows.test.ts.
// Needs: npm run demo:seed, functions served with DEMO_MODE=true, a build with VITE_DEMO_LOGIN=true on baseURL.
// Usage: node scripts/check-demo-personas.mjs [baseURL]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:4174";
const LABEL = {
  owner: "مالك", admin: "مدير المنظمة", compliance_lead: "قائد الالتزام", reviewer: "مراجع الالتزام", legal: "قانوني",
  creator: "مسوّق", external_uploader: "شريك خارجي", external_reviewer: "مراجع خارجي", viewer: "مطّلع",
};
const EXPECT = {
  owner: { has: ["team", "roles", "features", "queue", "new"], not: [] },
  admin: { has: ["team", "roles", "features", "queue"], not: [] },
  compliance_lead: { has: ["queue", "companyRules", "analytics", "audit"], not: ["features", "new"] },
  reviewer: { has: ["queue", "rules", "audit"], not: ["features", "companyRules", "new"] },
  legal: { has: ["queue", "rules"], not: ["features", "new", "analytics"] },
  creator: { has: ["new", "promotions"], not: ["queue", "features", "audit"] },
  external_uploader: { has: ["promotions"], not: ["team", "roles", "claims", "new", "audit", "queue"] },
  external_reviewer: { has: ["promotions"], not: ["team", "roles", "claims", "new", "audit", "queue"] },
  viewer: { has: ["promotions", "audit", "analytics"], not: ["new", "queue", "features"] },
};
const browser = await chromium.launch();
let failed = 0;
for (const [role, exp] of Object.entries(EXPECT)) {
  const ctx = await browser.newContext({ locale: "ar" });
  const page = await ctx.newPage();
  const out = [];
  try {
    await page.goto(`${base}/login`);
    await page.getByTestId("demo-open").click();
    const btn = page.getByTestId(`demo-enter-${role}`);
    if (!(await btn.isVisible().catch(() => false))) {
      const toggle = page.getByTestId("demo-advanced-toggle");
      if (await toggle.isVisible().catch(() => false)) await toggle.click();
    }
    await btn.click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    const nav = await page.locator("[data-testid=app-sidebar] a").evaluateAll((as) => as.map((a) => a.dataset.testid.replace("nav-", "")));
    for (const k of exp.has) if (!nav.includes(k)) out.push(`missing nav ${k}`);
    for (const k of exp.not) if (nav.includes(k)) out.push(`unexpected nav ${k}`);
    if (!(await page.getByTestId("demo-banner").isVisible())) out.push("no demo banner");
    await page.getByTestId("account-menu").click();
    const who = await page.getByTestId("account-menu-content").innerText();
    if (!who.includes(LABEL[role])) out.push(`account menu lacks role «${LABEL[role]}»`);
    await page.keyboard.press("Escape");
    await page.reload();
    await page.locator("html[data-app-ready]").waitFor({ state: "attached" });
    const kept = await page.getByTestId("account-menu").waitFor({ timeout: 15000 }).then(() => true, () => false);
    if (!/\/dashboard/.test(page.url()) || !kept) out.push(`session lost on reload (url ${new URL(page.url()).pathname})`);
    await page.getByTestId("account-menu").click();
    await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/dashboard"), { timeout: 15000 });
    await page.goto(`${base}/dashboard`);
    await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => out.push("still signed in after sign-out"));
    console.log(`${out.length ? "✗" : "✓"} ${role}: nav=[${nav.join(",")}] ${out.join("; ")}`);
    if (out.length) failed++;
  } catch (e) {
    failed++;
    console.log(`✗ ${role}: ${String(e).split("\n")[0].slice(0, 200)}`);
  }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
