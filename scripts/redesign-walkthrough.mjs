// D219 browser walkthrough — ISOLATED STACK ONLY (Vite on :3200 → 5442x). No AI request: nothing here starts an
// analysis. Covers the logo, the demo entry, the redesigned personal home, the five-entry personal sidebar, Studio
// and settings entry points, the removed demo banner, the authority accordion rulebook (counts, search, filters,
// keyboard), English LTR, mobile/tablet widths and an enterprise regression. Screenshots + a JSON report.
//
//   node scripts/redesign-walkthrough.mjs --out <dir>
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (k, d) =>
  process.argv.includes(`--${k}`)
    ? process.argv[process.argv.indexOf(`--${k}`) + 1]
    : d;
const base = "http://localhost:3200";
const out = arg("out", "redesign-walkthrough");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const report = { checks: {}, shots: [] };
const errors = [];
const check = (name, ok, detail) => {
  report.checks[name] =
    detail === undefined ? Boolean(ok) : { ok: Boolean(ok), detail };
  if (!ok)
    errors.push(
      `check failed: ${name}${detail ? ` (${JSON.stringify(detail)})` : ""}`,
    );
};
const shot = async (page, name, full = true) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  report.shots.push(name);
};
async function session(lang, viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((l) => localStorage.setItem("saleem-lang", l), lang);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${lang}: ${e.message}`));
  return { ctx, page };
}
async function enterIndividual(page) {
  await page.goto(`${base}/login`);
  await page.getByTestId("demo-audience-individual").click();
  await page.getByTestId("demo-enter-individual").click();
  await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 30000 });
  await page.getByTestId("personal-dashboard").waitFor({ timeout: 30000 });
  await page
    .getByTestId("personal-recent")
    .or(page.getByTestId("personal-first-steps"))
    .waitFor({
      timeout: 30000,
    });
}
const BANNER = /جلسة تجريبية — |Demo session — /;

// ---- Arabic desktop ------------------------------------------------------------------------------------------
{
  const { ctx, page } = await session("ar", { width: 1440, height: 1000 });
  await page.goto(`${base}/`);
  await page.getByTestId("brand-logo").first().waitFor();
  check(
    "landingLogo",
    await page.getByTestId("brand-logo").first().isVisible(),
  );
  await shot(page, "01-landing-ar", false);

  await page.goto(`${base}/login`);
  await page.getByTestId("demo-roles").waitFor();
  check("loginLogo", await page.getByTestId("brand-logo").first().isVisible());
  await page.getByTestId("demo-audience-individual").click();
  check(
    "loginDemoIdentified",
    await page.getByTestId("demo-individual-panel").isVisible(),
  );
  await shot(page, "02-login-individual-ar");

  await enterIndividual(page);
  const nav = (
    await page.getByTestId("app-sidebar").locator("a").allInnerTexts()
  ).map((s) => s.trim());
  check(
    "personalSidebarFiveItems",
    JSON.stringify(nav) ===
      JSON.stringify([
        "الرئيسية",
        "إعلاناتي",
        "إعلان جديد",
        "دليل القواعد",
        "اسأل سَليم",
      ]),
    nav,
  );
  check(
    "noStudioInSidebar",
    (await page.getByTestId("nav-studio").count()) === 0,
  );
  check(
    "noSettingsInSidebar",
    (await page.getByTestId("nav-settings").count()) === 0,
  );
  check("noDemoBanner", (await page.getByText(BANNER).count()) === 0);
  check("demoChip", (await page.getByTestId("demo-chip").count()) === 1);
  check("headerLogo", await page.getByTestId("brand-logo").first().isVisible());
  check(
    "heroTitle",
    (await page.getByRole("heading", { level: 1 }).innerText()).includes(
      "افحص إعلانك بالقواعد",
    ),
  );
  const order = await page
    .locator("[data-testid^=personal-]")
    .evaluateAll((els) =>
      els
        .map((e) => e.getAttribute("data-testid"))
        .filter((x) =>
          [
            "personal-check",
            "personal-fix",
            "personal-ask",
            "personal-create",
          ].includes(x),
        ),
    );
  check(
    "actionOrder",
    JSON.stringify(order) ===
      JSON.stringify([
        "personal-check",
        "personal-fix",
        "personal-ask",
        "personal-create",
      ]),
    order,
  );
  const [checkBox, fixBox] = await Promise.all([
    page.getByTestId("personal-check").boundingBox(),
    page.getByTestId("personal-fix").boundingBox(),
  ]);
  check("primaryActionDominates", checkBox.width > fixBox.width * 1.3, {
    check: Math.round(checkBox.width),
    fix: Math.round(fixBox.width),
  });
  await shot(page, "03-dashboard-ar-desktop");
  await shot(page, "03b-dashboard-ar-desktop-fold", false);

  // Keyboard: the hero CTA is reachable with Tab and opens the check flow.
  await page.getByTestId("personal-hero-check").focus();
  check(
    "heroCtaFocusable",
    await page.evaluate(
      () =>
        document.activeElement?.getAttribute("data-testid") ===
        "personal-hero-check",
    ),
  );
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.pathname === "/new");
  await page.getByTestId("start-chooser").waitFor();
  await shot(page, "04-new-ad-chooser-ar", false);
  await page.getByTestId("start-studio").click();
  await page.waitForURL((u) => u.pathname === "/studio");
  check("studioViaNewAd", true);
  check(
    "newAdActiveInStudio",
    (await page.getByTestId("nav-new").getAttribute("aria-current")) === "page",
  );
  await shot(page, "05-studio-from-new-ad-ar", false);

  await page.goto(`${base}/dashboard`);
  await page.getByTestId("personal-create").click();
  await page.waitForURL((u) => u.pathname === "/studio");
  check("studioViaDashboard", true);

  await page.getByTestId("account-menu").click();
  await page
    .getByTestId("account-menu-content")
    .getByRole("menuitem", { name: /إعداداتي/ })
    .click();
  await page.waitForURL((u) => u.pathname === "/settings");
  check("settingsViaProfileMenu", true);
  await shot(page, "06-settings-via-profile-ar", false);

  // Rulebook: one collapsed section per authority, counts from the database, search and filters.
  await page.goto(`${base}/rules`);
  await page.getByTestId("rule-results").waitFor({ timeout: 30000 });
  const toggles = page.locator("[data-testid^=rule-group-toggle-]");
  const n = await toggles.count();
  const expandedAtStart = await page
    .locator("[data-testid^=rule-group-toggle-][aria-expanded=true]")
    .count();
  check("rulebookCollapsedAtStart", n >= 9 && expandedAtStart === 0, {
    groups: n,
    expandedAtStart,
  });
  check(
    "noAuthorityCards",
    (await page.getByTestId("authority-coverage").count()) === 0,
  );
  const stat = async (id) =>
    Number(
      (await page.getByTestId(id).locator("dd").first().innerText()).trim(),
    );
  const stats = {
    active: await stat("stat-active"),
    needsReview: await stat("stat-needs-review"),
    verifying: await stat("stat-verifying"),
  };
  report.checks.rulebookStats = stats;
  await shot(page, "07-rulebook-ar-collapsed");
  await page.getByTestId("rule-group-toggle-GMEDIA").click();
  await page.getByTestId("rule-group-toggle-SAMA").click();
  check(
    "multipleSectionsOpen",
    (await page
      .locator("[data-testid^=rule-group-toggle-][aria-expanded=true]")
      .count()) === 2,
  );
  await page
    .getByTestId("rule-group-GMEDIA")
    .getByTestId("rule-details-toggle")
    .first()
    .click();
  check(
    "ruleExpandsInPlace",
    await page.getByTestId("rule-details").first().isVisible(),
  );
  await shot(page, "08-rulebook-ar-expanded");
  // Status filter «سارية»: the visible count equals the active stat.
  await page.locator("#rb-status").selectOption("active");
  const showing = await page.getByTestId("rulebook-showing").innerText();
  check("activeFilterMatchesStat", showing.startsWith(`${stats.active} `), {
    showing,
    stats,
  });
  await page.locator("#rb-status").selectOption("all");
  // Authority filter opens that section only.
  await page.locator("#rb-authority").selectOption("SFDA");
  check(
    "authorityFilterOpensSection",
    (await page
      .getByTestId("rule-group-toggle-SFDA")
      .getAttribute("aria-expanded")) === "true" &&
      (await toggles.count()) === 1,
  );
  await page.locator("#rb-authority").selectOption("all");
  // Search by article text expands the matching sections.
  await page.getByTestId("rulebook-search").fill("المادة");
  const openBySearch = await page
    .locator("[data-testid^=rule-group-toggle-][aria-expanded=true]")
    .count();
  check("searchExpandsMatches", openBySearch > 0, { openBySearch });
  await shot(page, "09-rulebook-ar-search");
  await page.getByTestId("rulebook-search").fill("");
  await ctx.close();
}

// ---- English desktop -----------------------------------------------------------------------------------------
{
  const { ctx, page } = await session("en", { width: 1440, height: 1000 });
  await enterIndividual(page);
  check(
    "englishLtr",
    (await page.locator("html").getAttribute("dir")) === "ltr",
  );
  const nav = (
    await page.getByTestId("app-sidebar").locator("a").allInnerTexts()
  ).map((s) => s.trim());
  check("englishSidebar", nav.length === 5, nav);
  check("noDemoBannerEn", (await page.getByText(BANNER).count()) === 0);
  await shot(page, "10-dashboard-en-desktop");
  await page.goto(`${base}/rules`);
  await page.getByTestId("rule-results").waitFor({ timeout: 30000 });
  await page.getByTestId("rule-group-toggle-GMEDIA").click();
  check(
    "englishRuleStatus",
    (await page
      .getByTestId("rule-group-GMEDIA")
      .getByTestId("rule-status")
      .first()
      .innerText()) !== "",
  );
  await shot(page, "11-rulebook-en-desktop");
  await ctx.close();
}

// ---- Mobile and tablet ---------------------------------------------------------------------------------------
for (const [lang, vp, tag] of [
  ["ar", { width: 390, height: 844 }, "mobile"],
  ["en", { width: 390, height: 844 }, "mobile"],
  ["ar", { width: 820, height: 1180 }, "tablet"],
]) {
  const { ctx, page } = await session(lang, vp);
  await enterIndividual(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check(`noHorizontalScroll-${lang}-${tag}`, overflow <= 1, { overflow });
  check(
    `logoVisible-${lang}-${tag}`,
    await page.getByTestId("brand-logo").first().isVisible(),
  );
  await shot(page, `12-dashboard-${lang}-${tag}`);
  if (tag === "mobile") {
    await page.getByTestId("nav-menu").click();
    await page.getByRole("dialog").waitFor();
    const items = await page
      .getByRole("dialog")
      .locator("nav a")
      .allInnerTexts();
    check(`mobileMenuFive-${lang}`, items.length === 5, items);
    await shot(page, `13-menu-${lang}-mobile`, false);
    await page.keyboard.press("Escape");
  }
  await page.goto(`${base}/rules`);
  await page.getByTestId("rule-results").waitFor({ timeout: 30000 });
  await page.getByTestId("rule-group-toggle-GMEDIA").click();
  const ro = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check(`rulebookNoHorizontalScroll-${lang}-${tag}`, ro <= 1, { ro });
  await shot(page, `14-rulebook-${lang}-${tag}`);
  await ctx.close();
}

// ---- Enterprise regression -----------------------------------------------------------------------------------
{
  const { ctx, page } = await session("ar", { width: 1440, height: 1000 });
  await page.goto(`${base}/login`);
  await page.getByTestId("demo-open").click();
  await page.getByTestId("demo-enter-reviewer").click();
  await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 30000 });
  await page
    .getByTestId("app-sidebar")
    .locator("a")
    .first()
    .waitFor({ timeout: 30000 });
  const nav = (
    await page.getByTestId("app-sidebar").locator("a").allInnerTexts()
  ).map((s) => s.trim());
  report.checks.enterpriseNav = nav;
  check(
    "enterpriseHasQueue",
    (await page.getByTestId("nav-queue").count()) === 1,
  );
  check(
    "enterpriseNoPersonalHome",
    (await page.getByTestId("personal-dashboard").count()) === 0,
  );
  check("noDemoBannerEnterprise", (await page.getByText(BANNER).count()) === 0);
  check(
    "enterpriseDemoChip",
    (await page.getByTestId("demo-chip").count()) === 1,
  );
  await shot(page, "15-enterprise-dashboard-ar");
  await page.goto(`${base}/queue`);
  await page.waitForTimeout(1500);
  check(
    "enterpriseQueueOpens",
    (await page.getByText(/ليست ضمن صلاحيات|not part of your role/).count()) ===
      0,
  );
  await page.goto(`${base}/rules`);
  await page.getByTestId("rule-results").waitFor({ timeout: 30000 });
  await shot(page, "16-enterprise-rulebook-ar", false);
  await ctx.close();
}

await browser.close();
report.errors = errors;
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    { errors, checks: Object.keys(report.checks).length },
    null,
    2,
  ),
);
process.exit(errors.length ? 1 : 0);
