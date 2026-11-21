// Nada Cream correction through the real SALEEM Fix media workflow (D207) — ISOLATED STACK ONLY (Vite :3200).
// The original V1 video is corrected by the implementation itself: claim ranges muted, on-screen claim covered,
// visible disclosure, subtitles, and a NEW narration of the corrected script generated locally (open-source Piper)
// that replaces the original audio. The corrected script/caption are typed by the tester here because Gemini text
// correction awaits authorisation. The manually prepared demo V2 video is NOT used.
//
//   node scripts/nada-correction-walkthrough.mjs --promo <id> --out <dir> --creds .iso/demo/.demo-credentials.json
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (k, d) =>
  process.argv.includes(`--${k}`)
    ? process.argv[process.argv.indexOf(`--${k}`) + 1]
    : d;
const base = "http://localhost:3200";
const promo = arg("promo");
const out = arg("out", "nada-correction");
const { password } = JSON.parse(
  readFileSync(arg("creds", ".iso/demo/.demo-credentials.json"), "utf8"),
);
mkdirSync(out, { recursive: true });

const SCRIPT =
  "إعلان مدفوع. كريم ندى للعناية اليومية بالبشرة. استخدميه وفق التعليمات الموضحة على العبوة. تختلف النتائج من شخص لآخر.";
const CAPTION =
  "#إعلان_مدفوع · محتوى معدّل بمساعدة الذكاء الاصطناعي\nكريم ندى للعناية اليومية بالبشرة. استخدميه وفق التعليمات الموضحة على العبوة.";

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await ctx.addInitScript(() => localStorage.setItem("saleem-lang", "ar"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/login`);
await page.fill('input[type="email"]', "marketer@demo.saleem.app");
await page.fill('input[type="password"]', password);
await page.locator('form button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
  timeout: 30000,
});

await page.goto(`${base}/promotions/${promo}/fix`);
await page.getByTestId("fix-methods").waitFor({ timeout: 30000 });
await page.screenshot({ path: `${out}/01-methods.png`, fullPage: true });
await page.getByTestId("fix-media-start").click();
await page.getByTestId("media-editor").waitFor({ timeout: 30000 });
await page.getByLabel("نص التعليق الصوتي").fill(SCRIPT);
await page.getByLabel("الوصف", { exact: true }).fill(CAPTION);
await page.screenshot({ path: `${out}/02-editor.png`, fullPage: true });
await page.getByTestId("fix-tts").click();
await page
  .getByTestId("media-editor")
  .locator("audio")
  .first()
  .waitFor({ timeout: 240000 });
await page.getByTestId("render-video").click();
await page.getByTestId("rendered-video").waitFor({ timeout: 180000 });
await page.screenshot({ path: `${out}/03-rendered.png`, fullPage: true });
const b64 = await page
  .getByTestId("rendered-video")
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
writeFileSync(`${out}/nada-corrected.${ext}`, Buffer.from(b64.data, "base64"));
await page
  .getByRole("button", { name: /قبول الفيديو المصحح كإصدار جديد/ })
  .click();
await page.waitForURL((u) => u.pathname === `/promotions/${promo}`, {
  timeout: 240000,
});
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/04-after-accept.png`, fullPage: false });
const report = { file: `nada-corrected.${ext}`, errors };
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
await browser.close();
