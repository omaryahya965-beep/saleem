// V2 completion §20/§22 — real-browser walkthrough for the nine roles (D201). Run it ONLY against the isolated
// stack (scripts/isolated-stack.mjs) or another disposable environment: it signs in as each demo user and opens
// pages, it never deletes anything.
//
//   node scripts/browser-walkthrough.mjs --base http://localhost:3200 --creds <file.json> --out <dir> [--promo <id>]
//
// <file.json> = { "password": "...", "domain": "demo.saleem.app" } (local demo credentials; never committed).
// Per role: the sidebar entries it sees, each entry opened (page errors, console errors, horizontal overflow),
// direct-URL probes of management pages (what a role that must not manage them gets), one screenshot per page.
// Then responsive screenshots of key pages at 375/768/1024/1440/1920 px in Arabic and English with overflow checks.
// Writes <out>/walkthrough.json and exits 1 when any page error or overflow was found.
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const base = arg("base", "http://localhost:3200");
if (!/localhost|127\.0\.0\.1/.test(base))
  throw new Error("walkthrough runs only against a local stack");
const creds = JSON.parse(readFileSync(arg("creds"), "utf8"));
const out = arg("out", "walkthrough");
const promo = arg("promo", null);
const domain = creds.domain ?? "demo.saleem.app";
mkdirSync(out, { recursive: true });

const ROLES = [
  "owner",
  "orgadmin",
  "lead",
  "reviewer",
  "legal",
  "marketer",
  "partner",
  "extreviewer",
  "viewer",
];
const PROBES = [
  "/features",
  "/roles",
  "/company-rules",
  "/audit",
  "/admin",
  "/queue",
  "/org",
];
const WIDTHS = [375, 768, 1024, 1440, 1920];

const browser = await chromium.launch();
const report = { base, roles: {}, responsive: [], problems: [] };

async function open(width, lang) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    locale: lang === "ar" ? "ar-SA" : "en-GB",
  });
  await ctx.addInitScript((l) => localStorage.setItem("saleem-lang", l), lang);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) =>
    errs.push(`pageerror: ${e.message.slice(0, 160)}`),
  );
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const s = m.text();
    // Expected 4xx from permission probes and RLS-denied reads are not application errors.
    if (/status of 40[0-9]|Failed to load resource/.test(s)) return;
    errs.push(`console: ${s.slice(0, 160)}`);
  });
  return { ctx, page, errs };
}
async function login(page, user) {
  await page.goto(`${base}/login`);
  await page.fill('input[type="email"]', `${user}@${domain}`);
  await page.fill('input[type="password"]', creds.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 30000,
  });
}
async function settle(page, ms = 1800) {
  await page
    .waitForLoadState("networkidle", { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(ms);
}
const overflow = (page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
const heading = (page) =>
  page.evaluate(() =>
    (document.querySelector("main h1, main h2")?.textContent ?? "")
      .trim()
      .slice(0, 80),
  );

for (const role of ROLES) {
  const { ctx, page, errs } = await open(1440, "ar");
  const r = { nav: [], pages: [], probes: [] };
  report.roles[role] = r;
  try {
    await login(page, role);
    await page.goto(`${base}/dashboard`);
    await settle(page);
    r.dashboard = {
      workload: await page.getByTestId("role-workload").count(),
      heading: await heading(page),
    };
    await page.screenshot({
      path: `${out}/${role}-dashboard.png`,
      fullPage: true,
    });
    r.nav = await page.evaluate(() =>
      [
        ...new Set(
          [...document.querySelectorAll("aside a[href], nav a[href]")].map(
            (a) => new URL(a.href).pathname,
          ),
        ),
      ].filter((p) => p.startsWith("/") && !p.startsWith("/login")),
    );
    for (const path of r.nav.slice(0, 16)) {
      const before = errs.length;
      await page.goto(`${base}${path}`);
      await settle(page, 1200);
      const o = await overflow(page);
      r.pages.push({
        path,
        heading: await heading(page),
        overflow: o,
        errors: errs.slice(before),
      });
      if (o > 1)
        report.problems.push(`${role} ${path}: horizontal overflow ${o}px`);
      await page.screenshot({
        path: `${out}/${role}${path.replaceAll("/", "_")}.png`,
        fullPage: false,
      });
    }
    for (const path of PROBES.filter(
      (p) => !r.nav.some((n) => n.startsWith(p)),
    )) {
      await page.goto(`${base}${path}`);
      await settle(page, 1000);
      r.probes.push({
        path,
        landed: new URL(page.url()).pathname,
        text: (
          await page.evaluate(
            () => document.querySelector("main")?.innerText ?? "",
          )
        )
          .replace(/\s+/g, " ")
          .slice(0, 140),
      });
    }
  } catch (e) {
    report.problems.push(`${role}: ${e.message.split("\n")[0]}`);
  }
  if (errs.length) report.problems.push(...errs.map((e) => `${role}: ${e}`));
  await ctx.close();
}

// Responsive pass: the marketer's dashboard, list and advertisement page; the owner's team and features pages.
const pages = [
  ["marketer", "/dashboard"],
  ["marketer", "/promotions"],
  ...(promo ? [["marketer", `/promotions/${promo}`]] : []),
  ["owner", "/features"],
  ["owner", "/roles"],
  ["partner", "/dashboard"],
];
for (const lang of ["ar", "en"])
  for (const width of WIDTHS) {
    const { ctx, page, errs } = await open(width, lang);
    let who = null;
    for (const [role, path] of pages) {
      try {
        if (who !== role) {
          await ctx.clearCookies();
          await page.goto(`${base}/login`);
          await page.evaluate(() => {
            const l = localStorage.getItem("saleem-lang");
            localStorage.clear();
            if (l) localStorage.setItem("saleem-lang", l);
          });
          await login(page, role);
          who = role;
        }
        await page.goto(`${base}${path}`);
        await settle(page, 1500);
        const o = await overflow(page);
        const dir = await page.evaluate(() => document.documentElement.dir);
        const name = `rsp-${lang}-${width}-${role}${path.replaceAll("/", "_").slice(0, 40)}`;
        await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
        report.responsive.push({ lang, width, role, path, dir, overflow: o });
        if (o > 1) report.problems.push(`${name}: horizontal overflow ${o}px`);
        if (dir !== (lang === "ar" ? "rtl" : "ltr"))
          report.problems.push(`${name}: dir=${dir}`);
      } catch (e) {
        report.problems.push(
          `${lang}-${width} ${role} ${path}: ${e.message.split("\n")[0]}`,
        );
      }
    }
    if (errs.length)
      report.problems.push(...errs.map((e) => `${lang}-${width}: ${e}`));
    await ctx.close();
  }

await browser.close();
writeFileSync(`${out}/walkthrough.json`, JSON.stringify(report, null, 1));
console.log(
  JSON.stringify(
    {
      roles: Object.fromEntries(
        Object.entries(report.roles).map(([k, v]) => [
          k,
          {
            nav: v.nav.length,
            pages: v.pages.length,
            probes: v.probes.length,
            workload: v.dashboard?.workload,
          },
        ]),
      ),
      responsive: report.responsive.length,
      problems: report.problems,
    },
    null,
    1,
  ),
);
process.exit(report.problems.length ? 1 : 0);
