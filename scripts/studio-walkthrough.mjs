// SALEEM AI Studio browser test (D207) — ISOLATED STACK ONLY (Vite on :3200 → 5442x, Gemini key blank).
// Creates a fictional cosmetic ad from scratch with the deterministic template script, a voice generated locally by
// the open-source Piper model, the template renderer, then accepts it as a new advertisement. Saves the rendered MP4
// and frame screenshots for inspection and prints a JSON report. No AI provider request is made.
//
//   node scripts/studio-walkthrough.mjs --out <dir> --creds .iso/demo/.demo-credentials.json [--lang ar]
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (k, d) =>
  process.argv.includes(`--${k}`)
    ? process.argv[process.argv.indexOf(`--${k}`) + 1]
    : d;
const base = arg("base", "http://localhost:3200");
if (!/localhost:3200/.test(base))
  throw new Error(
    "studio walkthrough runs only against the isolated Vite (:3200)",
  );
const out = arg("out", "studio-walkthrough");
const lang = arg("lang", "ar");
const { password } = JSON.parse(
  readFileSync(arg("creds", ".iso/demo/.demo-credentials.json"), "utf8"),
);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await ctx.addInitScript((l) => localStorage.setItem("saleem-lang", l), lang);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const report = { steps: [] };
const step = async (name, fn) => {
  const t0 = Date.now();
  await fn();
  report.steps.push({ name, ms: Date.now() - t0 });
  await page.screenshot({
    path: `${out}/${String(report.steps.length).padStart(2, "0")}-${name}.png`,
    fullPage: true,
  });
};

await page.goto(`${base}/login`);
await page.fill('input[type="email"]', "marketer@demo.saleem.app");
await page.fill('input[type="password"]', password);
await page.locator('form button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
  timeout: 30000,
});

await step("new-chooser", async () => {
  await page.goto(`${base}/new`);
  await page.getByTestId("start-chooser").waitFor();
});
await step("brief", async () => {
  await page.getByTestId("start-studio").click();
  await page.getByTestId("studio").waitFor();
  await page.getByTestId("studio-product-name").fill("كريم لمى (منتج تجريبي)");
  await page
    .getByLabel(/وصف المنتج|Product description/)
    .fill("كريم ترطيب يومي للبشرة الجافة");
  const verified = page.getByTestId("studio-verified");
  await verified.fill("يرطّب البشرة طوال اليوم\nمناسب للاستخدام اليومي");
  await verified.blur();
  await page.getByLabel(/اسم العلامة|Brand name/).fill("لمى");
  await page
    .getByLabel(/هدف الحملة|Campaign objective/)
    .fill("تعريف بمنتج جديد");
  await page
    .getByLabel(/الجمهور المستهدف|Target audience/)
    .fill("البالغات في السعودية");
});
await step("direction", async () => {
  await page.getByTestId("studio-next").click();
  await page
    .getByLabel(/عبارة الدعوة|Call to action/)
    .fill("اطلبيه الآن من المتجر");
});
await step("context", async () => {
  await page.getByTestId("studio-next").click();
});
await step("script", async () => {
  await page.getByTestId("studio-next").click();
  await page.getByTestId("studio-generate").click();
  await page.getByTestId("studio-scenes").waitFor({ timeout: 30000 });
  await page.getByTestId("studio-review").click();
  await page.waitForTimeout(2500);
  report.scenes = await page.getByTestId("studio-scenes").locator("li").count();
  report.reviewItems = await page.getByTestId("studio-review-item").count();
});
await step("voice", async () => {
  await page.getByTestId("studio-next").click();
  await page.getByTestId("studio-generate-voice").click();
  await page
    .getByTestId("studio-voice-clip")
    .first()
    .waitFor({ timeout: 240000 });
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-testid="studio-generate-voice"][aria-busy="true"]',
      ),
    null,
    { timeout: 240000 },
  );
  await page.waitForTimeout(1500);
  report.voiceClips = await page.getByTestId("studio-voice-clip").count();
});
await step("render", async () => {
  await page.getByTestId("studio-next").click();
  await page.getByTestId("studio-render").click();
  await page.getByTestId("studio-rendered").waitFor({ timeout: 180000 });
  report.renderedCaption = await page
    .getByTestId("studio-rendered")
    .locator("figcaption")
    .innerText();
  // Save the actual rendered file for inspection.
  const b64 = await page
    .getByTestId("studio-rendered")
    .locator("video")
    .evaluate(async (v) => {
      const blob = await fetch(v.src).then((r) => r.blob());
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000)
        s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { data: btoa(s), type: blob.type };
    });
  const ext = b64.type.includes("mp4") ? "mp4" : "webm";
  writeFileSync(
    `${out}/studio-rendered.${ext}`,
    Buffer.from(b64.data, "base64"),
  );
  report.file = `studio-rendered.${ext}`;
});
await step("accept", async () => {
  await page.getByTestId("studio-next").click();
  await page.getByTestId("studio-accept").click();
  await page.waitForURL(
    (u) =>
      u.pathname.startsWith("/checks/") ||
      u.pathname.startsWith("/promotions/"),
    { timeout: 180000 },
  );
  await page.waitForTimeout(3000);
  report.landed = new URL(page.url()).pathname;
});

report.errors = errors;
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
