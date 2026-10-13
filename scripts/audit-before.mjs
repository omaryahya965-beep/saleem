// Captures "before" screenshots of the legacy single-route UI (Phase 1 audit).
// Usage: node scripts/audit-before.mjs [baseUrl]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "docs/audit/before";
fs.mkdirSync(out, { recursive: true });

const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
// Each screen is reached by clicking through the legacy in-memory navigation.
const screens = [
  ["report-needs-fixes", async () => {}],
  ["landing", async (p) => p.click(".brand")],
  ["dashboard", async (p) => p.locator("nav button", { hasText: "فحوصاتي" }).dispatchEvent("click")],
  ["report-ready", async (p) => {
    await p.locator("nav button", { hasText: "فحوصاتي" }).dispatchEvent("click");
    await p.waitForTimeout(1500);
    await p.locator(".check-row").filter({ hasText: "جاهز" }).first().click();
  }],
  ["new-check", async (p) => p.locator("nav button", { hasText: "فحص جديد" }).dispatchEvent("click")],
  ["processing", async (p) => p.getByRole("button", { name: /رفع النسخة/ }).click()],
  ["rulebook", async (p) => p.locator("nav button", { hasText: "دليل القواعد" }).dispatchEvent("click")],
  ["compliance-log", async (p) => p.locator(".actions button", { hasText: "سجل الامتثال" }).click()],
  ["login", async (p) => p.locator("button.avatar").click()],
];

const log = [];
const browser = await chromium.launch();
for (const [vpName, viewport] of Object.entries(viewports)) {
  for (const lang of ["ar", "en"]) {
    for (const [name, nav] of screens) {
      const page = await browser.newPage({ viewport });
      page.on("console", (m) => m.type() !== "log" && log.push(`[${vpName}/${lang}/${name}] console.${m.type()}: ${m.text().slice(0, 300)}`));
      page.on("requestfailed", (r) => log.push(`[${vpName}/${lang}/${name}] requestfailed: ${r.url()} ${r.failure()?.errorText}`));
      page.on("response", (r) => r.status() >= 400 && log.push(`[${vpName}/${lang}/${name}] HTTP ${r.status()}: ${r.url()}`));
      await page.goto(base, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      try {
        await nav(page);
      } catch (e) {
        log.push(`[${vpName}/${lang}/${name}] NAV FAILED: ${e.message.split("\n")[0]}`);
      }
      // The legacy "EN" button has no handler; clicking it documents that nothing changes.
      if (lang === "en") await page.locator("button.lang").click().catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/${name}.${vpName}.${lang}.png`, fullPage: true });
      await page.close();
    }
  }
}
await browser.close();
fs.writeFileSync(`${out}/console-log.txt`, [...new Set(log)].join("\n") + "\n");
console.log(`done, ${log.length} log lines`);
