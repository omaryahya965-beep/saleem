// External partner — complete video workflow in a real browser (§27, D207). ISOLATED STACK ONLY.
//   node scripts/isolated-stack.mjs run -- node scripts/partner-walkthrough.mjs --out <dir> --video <file.mp4> --video2 <file2.mp4>
// The partner works in the UI (link → create → upload video → submit → changes requested → upload v2 → compare →
// resubmit → decision). The manager and reviewer act as the real users through the same RPCs the UI calls. AI is
// disabled on the isolated stack, so the analysis fails with «provider_not_configured» and the partner submits with
// the explicit acknowledgement — exactly what the product offers in that state. Ends with isolation probes.
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const arg = (k, d) =>
  process.argv.includes(`--${k}`)
    ? process.argv[process.argv.indexOf(`--${k}`) + 1]
    : d;
const url = process.env.SUPABASE_URL ?? "";
if (!/^http:\/\/127\.0\.0\.1:544\d\d$/.test(url))
  throw new Error(`refusing: ${url} is not the isolated stack`);
const base = "http://localhost:3200";
const out = arg("out", "partner-walkthrough");
const video1 = resolve(arg("video"));
const video2 = resolve(arg("video2", arg("video")));
const { password } = JSON.parse(
  readFileSync(
    resolve(
      process.env.DEMO_STATE_DIR ?? ".iso/demo",
      ".demo-credentials.json",
    ),
    "utf8",
  ),
);
mkdirSync(out, { recursive: true });
const log = [];
const note = (step, data = {}) => {
  log.push({ step, ...data });
  console.log(step, JSON.stringify(data));
};

async function as(user) {
  const c = createClient(url, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const r = await c.auth.signInWithPassword({
    email: `${user}@demo.saleem.app`,
    password,
  });
  if (r.error) throw r.error;
  return { c, id: r.data.user.id };
}
const rpc = async (c, fn, args) => {
  const r = await c.rpc(fn, args);
  return r.error ? { error: r.error.message } : { data: r.data ?? "ok" };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await ctx.addInitScript(() => localStorage.setItem("saleem-lang", "ar"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let n = 0;
const shot = (name) =>
  page.screenshot({
    path: `${out}/${String(++n).padStart(2, "0")}-${name}.png`,
    fullPage: true,
  });

async function uploadVersion(promo, file) {
  await page.goto(`${base}/new?promotion=${promo}`);
  await page.locator('input[type="file"]').first().setInputFiles(file);
  for (let i = 0; i < 4; i++) {
    if (
      await page
        .getByTestId("review-summary")
        .isVisible()
        .catch(() => false)
    )
      break;
    await page.locator("button:visible", { hasText: "التالي" }).last().click();
    await page.waitForTimeout(900);
    const alert = await page
      .getByRole("alert")
      .first()
      .innerText()
      .catch(() => "");
    if (alert) note("wizard-alert", { step: i, alert });
  }
  await page
    .getByText(/لدي الحق في رفع هذا المحتوى/)
    .first()
    .click();
  await page.locator("[data-testid=start-analysis]:visible").click();
  try {
    await page.waitForURL((u) => u.pathname.startsWith("/checks/"), {
      timeout: 180000,
    });
  } catch (e) {
    await shot("upload-failed");
    note("upload-failed", {
      text: (await page.locator("body").innerText()).slice(0, 600),
    });
    throw e;
  }
  return new URL(page.url()).pathname.split("/").at(-1);
}
async function submitWithAck(promo, noteText) {
  await page.goto(`${base}/promotions/${promo}`);
  await page.getByRole("button", { name: "إرسال للمراجعة" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const ack = dialog.getByRole("checkbox", { name: /التحليل الآلي تعذّر/ });
  if (await ack.count()) await ack.check();
  await dialog
    .getByLabel(/ملاحظة/)
    .first()
    .fill(noteText)
    .catch(() => {});
  await dialog.getByRole("button", { name: "إرسال للمراجعة" }).click();
  await page.waitForTimeout(2500);
}

// 1. Partner signs in and opens the assigned submission link from the dashboard.
await page.goto(`${base}/login`);
await page.fill('input[type="email"]', "partner@demo.saleem.app");
await page.fill('input[type="password"]', password);
await page.locator('form button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
  timeout: 30000,
});
await page.goto(`${base}/dashboard`);
await page.getByTestId("my-partner-links").waitFor({ timeout: 30000 });
await shot("partner-dashboard");
await page
  .getByRole("link", { name: "فتح الرابط وتقديم إعلان" })
  .first()
  .click();
await page.getByTestId("partner-new").waitFor({ timeout: 30000 });
note("1-link-opened", { path: new URL(page.url()).pathname });

// 2. Create the advertisement through the link.
const card = page.getByTestId("partner-new");
await card.getByLabel("العنوان").fill("حملة الوكالة — فيديو تجريبي");
const product = card.locator("select").first();
if (await product.count()) {
  const value = await product
    .locator("option")
    .nth(1)
    .getAttribute("value")
    .catch(() => null);
  if (value) await product.selectOption(value);
}
await card.getByRole("checkbox").first().check();
await shot("partner-create");
await card.getByRole("button", { name: "إنشاء ورفع الملف" }).click();
await page.waitForURL((u) => /^\/promotions\/[0-9a-f-]+$/.test(u.pathname), {
  timeout: 60000,
});
const promo = new URL(page.url()).pathname.split("/").at(-1);
note("2-created", { promo });

// 3–4. Upload the actual video; the analysis state is shown (fails fast: no provider on the isolated stack).
const sid1 = await uploadVersion(promo, video1);
await page.waitForTimeout(4000);
await shot("v1-analysis-state");
note("3-uploaded-v1", { submission: sid1 });

// 5. Submit for review with the explicit acknowledgement.
await submitWithAck(promo, "الإصدار الأول من الوكالة.");
await shot("v1-submitted");

// Manager assigns, reviewer opens and requests changes (real users, same RPCs as the UI).
const lead = await as("lead");
const rv = await as("reviewer");
note(
  "assign",
  await rpc(lead.c, "assign_reviewer", { _pid: promo, _user: rv.id }),
);
note("open", await rpc(rv.c, "open_review", { _pid: promo }));
note(
  "request_changes",
  await rpc(rv.c, "decide_promotion", {
    _pid: promo,
    _decision: "request_changes",
    _reason_other:
      "أضيفوا «إعلان مدفوع» في بداية المقطع وأزيلوا أي وعد بنتيجة مضمونة.",
  }),
);

// 6. Partner receives the requested changes.
await page.goto(`${base}/promotions/${promo}`);
await page.waitForTimeout(2500);
await shot("partner-changes-requested");
note("6-partner-sees", {
  text: (await page.locator("main").innerText()).includes("طلب"),
});

// 7. Partner uploads the corrected version.
const sid2 = await uploadVersion(promo, video2);
await page.waitForTimeout(3000);
note("7-uploaded-v2", { submission: sid2 });

// 8. Compare both versions.
await page.goto(`${base}/promotions/${promo}`);
const compareTab = page.getByRole("tab", { name: /المقارنة|مقارنة/ });
if (await compareTab.count()) {
  await compareTab.first().click();
  await page.waitForTimeout(2000);
}
await shot("partner-compare");

// 9. Resubmit.
await submitWithAck(promo, "الإصدار الثاني بعد التعديلات المطلوبة.");
await shot("v2-resubmitted");

// 10. Reviewer decision (whatever can_decide allows for this version) and the partner sees it.
note("reopen", await rpc(rv.c, "open_review", { _pid: promo }));
const can = await rpc(rv.c, "can_decide", { _pid: promo });
note("can_decide", can);
const decision = can.data?.approve_ok
  ? await rpc(rv.c, "decide_promotion", {
      _pid: promo,
      _decision: "approve",
      _comment: "تمت المراجعة البشرية للإصدار الثاني.",
    })
  : await rpc(rv.c, "decide_promotion", {
      _pid: promo,
      _decision: "request_changes",
      _reason_other:
        "لم يُحلَّل الإصدار آلياً؛ أعيدوا الرفع بعد تفعيل التحليل.",
    });
note("decision", { approve_ok: can.data?.approve_ok, ...decision });
await page.goto(`${base}/promotions/${promo}`);
await page.waitForTimeout(2500);
await shot("partner-decision");

// Isolation: the partner cannot read internal advertisements or other partners' work.
const partner = await as("partner");
// Public demo rows (is_demo) are readable by everyone by design (public sample reports); everything else must be own.
const { data: visible } = await partner.c
  .from("promotions")
  .select("id, owner_id, is_demo");
const privateRows = (visible ?? []).filter((p) => !p.is_demo);
note("isolation-promotions", {
  visible: visible?.length,
  publicDemo: (visible ?? []).length - privateRows.length,
  privateAllOwn: privateRows.every((p) => p.owner_id === partner.id),
});
const mk = await as("marketer");
const { data: internal } = await mk.c
  .from("promotions")
  .select("id")
  .eq("is_demo", false)
  .neq("owner_id", partner.id)
  .not("org_id", "is", null)
  .limit(1);
if (internal?.[0]) {
  const { data: peek } = await partner.c
    .from("promotions")
    .select("id")
    .eq("id", internal[0].id);
  note("isolation-direct-read", { internalVisible: (peek ?? []).length });
  await page.goto(`${base}/promotions/${internal[0].id}`);
  await page.waitForTimeout(2500);
  await shot("partner-direct-url-internal");
}
const { data: subs } = await partner.c
  .from("submissions")
  .select("id, user_id, is_demo");
note("isolation-submissions", {
  visible: subs?.length,
  privateAllOwn: (subs ?? [])
    .filter((s) => !s.is_demo)
    .every((s) => s.user_id === partner.id),
});

writeFileSync(
  `${out}/report.json`,
  JSON.stringify({ promo, log, errors }, null, 1),
);
console.log(JSON.stringify({ promo, errors }));
await browser.close();
