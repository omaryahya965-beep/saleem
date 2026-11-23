// Personal workspace browser journey (D211) — ISOLATED STACK ONLY (Vite on :3200 → 5442x), deterministic test
// providers (ISO_TEST_PROVIDER=1: no AI request). The individual demo enters through the new sign-in page, then:
// dashboard → check an existing ad (original Nada V1) with a MANUAL authority selection → automated analysis →
// findings with their authority → smart correction (in-browser media edit) → new version → comparison →
// re-analysis → download (warning for unresolved findings) → library. Screenshots in Arabic and English, desktop
// and mobile. Prints a JSON report.
//
//   node scripts/personal-walkthrough.mjs --out <dir>
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (k, d) =>
  process.argv.includes(`--${k}`)
    ? process.argv[process.argv.indexOf(`--${k}`) + 1]
    : d;
const base = "http://localhost:3200";
const out = arg("out", "personal-walkthrough");
mkdirSync(out, { recursive: true });
const CAPTION =
  "ودّعي التصبغات مع كريم ندى! بشرة صافية خلال 3 أيام فقط، ونتائج مضمونة لجميع أنواع البشرة.";

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const report = { steps: [], checks: {} };
const errors = [];

async function session(lang, viewport) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.addInitScript((l) => localStorage.setItem("saleem-lang", l), lang);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${lang}: ${e.message}`));
  return { ctx, page };
}
const shot = (page, name) =>
  page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
const step = async (page, name, fn) => {
  const t0 = Date.now();
  await fn();
  report.steps.push({ name, ms: Date.now() - t0 });
  await shot(page, `${String(report.steps.length).padStart(2, "0")}-${name}`);
};
const waitDone = async (page, ms = 120000) => {
  // The advertisement page polls the analysis; wait until the analysis status chip leaves «processing».
  await page.waitForFunction(
    () => {
      const t =
        document.querySelector("[data-testid=analysis-status]")?.textContent ??
        "";
      return /اكتمل|مكتمل|Complete|Done|Failed|فشل|تعذّر/.test(t);
    },
    null,
    { timeout: ms },
  );
};

// ---- Arabic desktop: the complete journey -------------------------------------------------------------------
const { page } = await session("ar", { width: 1440, height: 1000 });
await step(page, "landing-audiences", async () => {
  await page.goto(`${base}/`);
  await page.getByTestId("audiences").scrollIntoViewIfNeeded();
  report.checks.landingAudiences = await page
    .getByTestId("audiences")
    .isVisible();
});
await step(page, "login", async () => {
  await page.goto(`${base}/login`);
  await page.getByTestId("demo-roles").waitFor();
});
await step(page, "login-individual", async () => {
  await page.getByTestId("demo-audience-individual").click();
  await page.getByTestId("demo-individual-panel").waitFor();
  report.checks.noPasswordShown = !(await page
    .getByText(/password|كلمة المرور:/i)
    .count());
});
await step(page, "personal-dashboard", async () => {
  await page.getByTestId("demo-enter-individual").click();
  await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 30000 });
  await page.getByTestId("personal-dashboard").waitFor({ timeout: 30000 });
  await page.getByTestId("personal-allowance").waitFor();
  const nav = await page.locator("nav a").allInnerTexts();
  report.checks.nav = nav.map((s) => s.trim()).filter(Boolean);
  report.checks.noEnterpriseNav = !nav.some((s) =>
    /قائمة المراجعة|الفريق|الأدوار|قواعد الشركة|الحملات|التحليلات/.test(s),
  );
});

await step(page, "check-upload", async () => {
  await page.getByTestId("personal-check").click();
  await page.waitForURL((u) => u.pathname === "/new");
  const upload = page.getByTestId("start-upload");
  if (await upload.isVisible().catch(() => false)) await upload.click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("frontend/public/sample/nada-cream-v1.mp4");
  await page.waitForTimeout(2500);
  await page.locator("button:visible", { hasText: "التالي" }).last().click();
});
await step(page, "check-details", async () => {
  await page.getByLabel("اسم الفحص").fill("كريم ندى — فحص شخصي");
  await page.getByLabel("الوصف (الكابشن)").fill(CAPTION);
  await page.getByLabel("فئة المنتج أو المحتوى").selectOption("beauty");
  await page.locator("button:visible", { hasText: "التالي" }).last().click();
  await page.getByTestId("personal-context").waitFor();
});
await step(page, "check-sector", async () => {
  // D213: the user chooses the SECTOR, never authorities. «General content» on purpose: the content is cosmetic,
  // so the analysis must detect it and check the cosmetics rules anyway.
  await page.getByTestId("personal-sector").selectOption("general");
  await page.getByTestId("personal-use").selectOption("sponsored");
  await page.getByTestId("automatic-authorities").waitFor();
  await page.getByTestId("authority-coverage").waitFor();
  report.checks.noAuthorityChoice =
    (await page.getByTestId("authority-options").count()) === 0 &&
    (await page.getByRole("radio", { name: /أختارها بنفسي/ }).count()) === 0 &&
    (await page
      .getByRole("checkbox")
      .filter({ hasText: /الهيئة|وزارة|هيئة/ })
      .count()) === 0;
});
await step(page, "check-review", async () => {
  await page.locator("button:visible", { hasText: "التالي" }).last().click();
  await page.getByTestId("review-summary").waitFor();
  report.checks.noCampaignRow = !(await page
    .getByTestId("review-summary")
    .getByText("الحملة")
    .count());
});
await step(page, "analysis", async () => {
  await page
    .getByText(/لدي الحق في رفع هذا المحتوى/)
    .first()
    .click();
  await page.locator("[data-testid=start-analysis]:visible").click();
  await page.waitForURL((u) => u.pathname.startsWith("/checks/"), {
    timeout: 120000,
  });
  await page.waitForTimeout(8000); // the processing page starts analyze
  await page.goto(`${base}/promotions`);
  await page.getByTestId("personal-library").waitFor({ timeout: 30000 });
  await page.getByRole("link", { name: "كريم ندى — فحص شخصي" }).first().click();
  await page.getByTestId("personal-ad-panel").waitFor({ timeout: 30000 });
  await waitDone(page);
  await page.reload();
  await page.getByTestId("personal-ad-panel").waitFor();
  report.adUrl = new URL(page.url()).pathname;
  report.checks.personalBadge = await page
    .getByTestId("personal-badge")
    .isVisible();
  report.checks.noReviewStatus = !(await page
    .getByTestId("review-status")
    .count());
  await page.getByTestId("run-coverage").waitFor({ timeout: 30000 });
  report.checks.coverage = await page
    .locator("[data-testid^=run-authority-]")
    .evaluateAll((rows) =>
      rows.map(
        (r) =>
          `${r.getAttribute("data-testid").replace("run-authority-", "")}:${r.getAttribute("data-status")}`,
      ),
    );
  report.checks.sectorMismatch = (
    await page
      .getByTestId("sector-mismatch")
      .innerText()
      .catch(() => "")
  ).slice(0, 140);
  report.checks.coverageGaps = (
    await page
      .getByTestId("coverage-gaps")
      .innerText()
      .catch(() => "")
  ).slice(0, 140);
  report.checks.noChangeAuthorities =
    (await page.getByTestId("personal-change-authorities").count()) === 0;
  report.checks.findingAuthorityBadges = await page
    .getByTestId("finding-authority")
    .count();
});
await step(page, "fix-media", async () => {
  await page.goto(`${base}${report.adUrl}/fix`);
  await page.getByTestId("fix-methods").waitFor({ timeout: 30000 });
  await page.getByTestId("fix-media-start").click();
  await page.getByTestId("media-editor").waitFor({ timeout: 30000 });
  await page.getByTestId("render-video").click();
  await page.getByTestId("rendered-video").waitFor({ timeout: 180000 });
});
await step(page, "fix-accepted", async () => {
  await page
    .getByRole("button", { name: /قبول الفيديو المصحح كإصدار جديد/ })
    .click();
  await page.waitForURL((u) => u.pathname === report.adUrl, {
    timeout: 240000,
  });
  await page.getByTestId("personal-ad-panel").waitFor({ timeout: 30000 });
  await waitDone(page);
  await page.reload();
  report.checks.versions = await page
    .getByRole("navigation", { name: /الإصدارات/ })
    .getByRole("button")
    .count();
});
await step(page, "compare", async () => {
  await page.getByRole("tab", { name: /مقارنة|قارن/ }).click();
  await page.waitForTimeout(1500);
});
await step(page, "reanalyze", async () => {
  await page.getByRole("tab", { name: /الفحص الآلي/ }).click();
  await page.getByTestId("personal-reanalyze").click();
  await page.waitForTimeout(2500);
  await waitDone(page);
});
await step(page, "download-warning", async () => {
  await page.reload();
  await page.getByTestId("personal-ad-panel").waitFor();
  await page.waitForTimeout(4000); // the report (findings) loads before the download decision
  await page.getByTestId("personal-download").click();
  const warn = page.getByTestId("download-warning");
  if (
    await warn.waitFor({ timeout: 8000 }).then(
      () => true,
      () => false,
    )
  ) {
    report.checks.downloadWarning = true;
    await shot(page, "download-warning-dialog");
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.getByTestId("download-anyway").click(),
    ]);
    report.checks.downloaded = {
      name: dl.suggestedFilename(),
      bytes: (await dl.path())
        ? (await import("node:fs")).statSync(await dl.path()).size
        : 0,
    };
  } else {
    report.checks.downloadWarning = false;
    const dl = await page.waitForEvent("download", { timeout: 30000 });
    report.checks.downloaded = { name: dl.suggestedFilename() };
  }
});
await step(page, "library", async () => {
  await page.goto(`${base}/promotions`);
  await page.getByTestId("personal-library").waitFor();
  report.checks.libraryCount = await page
    .getByTestId("personal-library")
    .locator("li")
    .count();
});
await step(page, "rulebook-coverage", async () => {
  await page.goto(`${base}/rules`);
  await page.getByTestId("rule-results").waitFor({ timeout: 30000 }); // rules grouped by authority (D224)
});
await step(page, "ask", async () => {
  await page.goto(`${base}/ask`);
  await page.getByTestId("ask-examples").getByRole("button").first().click();
  await page.getByTestId("ask-answer").waitFor({ timeout: 60000 });
});

// ---- Screenshots: English desktop, Arabic and English mobile ---------------------------------------------------
for (const [lang, vp, tag] of [
  ["en", { width: 1440, height: 1000 }, "en-desktop"],
  ["ar", { width: 390, height: 844 }, "ar-mobile"],
  ["en", { width: 390, height: 844 }, "en-mobile"],
]) {
  const s = await session(lang, vp);
  await s.page.goto(`${base}/login`);
  await s.page.getByTestId("demo-audience-individual").click();
  await shot(s.page, `${tag}-login`);
  await s.page.getByTestId("demo-enter-individual").click();
  await s.page.getByTestId("personal-dashboard").waitFor({ timeout: 30000 });
  await s.page.waitForTimeout(1200);
  await shot(s.page, `${tag}-dashboard`);
  await s.page.goto(`${base}/promotions`);
  await s.page.getByTestId("personal-library").waitFor();
  await shot(s.page, `${tag}-library`);
  // D215: every demo visit is its own workspace — the first session's ad must not be reachable from this one.
  report.checks.libraryOfNewSession = report.checks.libraryOfNewSession ?? {};
  report.checks.libraryOfNewSession[tag] = await s.page
    .getByTestId("personal-library")
    .locator("li")
    .count();
  await s.page.goto(`${base}${report.adUrl}`);
  await s.page.waitForTimeout(4000);
  report.checks.otherSessionAdVisible =
    report.checks.otherSessionAdVisible ?? {};
  report.checks.otherSessionAdVisible[tag] =
    (await s.page.getByTestId("personal-ad-panel").count()) > 0;
  await shot(s.page, `${tag}-other-session-ad`);
  await s.page.goto(`${base}/promotions`);
  await s.page.getByTestId("personal-library").locator("li a").first().click();
  await s.page.getByTestId("personal-ad-panel").waitFor({ timeout: 30000 });
  await s.page.waitForTimeout(1200);
  await shot(s.page, `${tag}-ad`);
  await s.page.goto(`${base}/login`).catch(() => {});
  await s.ctx.close();
}

report.errors = errors;
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
