// LIVE end-to-end checks. No mocked sessions, fake JWTs, route fulfillments, or provider results.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  runtime = path.resolve(root, "../saleem-local");
const out = path.resolve(
  process.argv.find((a) => a.startsWith("--output-dir="))?.slice(13) ??
    path.join(root, "backend/eval/results/live-local"),
);
fs.mkdirSync(out, { recursive: true });
const credentials = JSON.parse(
  fs.readFileSync(path.join(runtime, "e2e-credentials.json"), "utf8"),
);
const en = JSON.parse(
  fs.readFileSync(path.join(root, "frontend/src/i18n/en.json"), "utf8"),
);
if (
  new URL(credentials.url).hostname !== "127.0.0.1" ||
  new URL(credentials.url).port !== "55421"
)
  throw new Error("Local-only target required");
const redactions = [
  credentials.anon_key,
  credentials.service_role_key,
  ...credentials.users.map((u) => u.password),
];
const safe = (s) =>
  redactions
    .reduce((t, k) => t.replaceAll(k, "[redacted]"), String(s))
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted-jwt]",
    )
    .slice(0, 1500);
const report = {
  at: new Date().toISOString(),
  live: true,
  mocked: false,
  frontend: "http://localhost:3001",
  supabase: credentials.url,
  tests: [],
};
const save = () =>
  fs.writeFileSync(
    path.join(out, "saleem-live-e2e.json"),
    JSON.stringify(report, null, 2),
  );
const serviceHeaders = {
  apikey: credentials.service_role_key,
  Authorization: `Bearer ${credentials.service_role_key}`,
};
async function db(table, query) {
  const r = await fetch(`${credentials.url}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Local DB read ${table}: HTTP ${r.status}`);
  return r.json();
}
const cases = [
  {
    id: "arabic-text",
    kind: "text",
    title: "اختبار حقيقي: إعلان قهوة",
    text: "#إعلان قهوة عربية بطعم الهيل، عبوة 250 جرام.",
    category: "other",
    expected: [],
  },
  {
    id: "misleading-claim",
    kind: "text",
    title: "اختبار حقيقي: ادعاء تنحيف",
    text: "#إعلان هذا الشاي ينحف خمسة كيلو في أسبوع، مضمون بدون أعراض جانبية.",
    category: "health",
    expected: ["COM-01"],
  },
  {
    id: "image-ad",
    kind: "image",
    title: "اختبار حقيقي: إعلان صورة",
    file: "backend/tests/fixtures/synthetic/frame-12s.jpg",
    caption: "#إعلان",
    category: "health",
    expected: ["COM-01"],
  },
  {
    id: "arabic-video",
    kind: "video",
    title: "اختبار حقيقي: فيديو عربي",
    file: "backend/tests/fixtures/synthetic/herbal-tea-fixed-ar.webm",
    caption: "#إعلان",
    category: "other",
    expected: [],
  },
  {
    id: "insufficient-evidence",
    kind: "image",
    title: "اختبار حقيقي: معلومات غير كافية",
    file: "../saleem-local/unclear-ad.png",
    caption:
      "#إعلان منتج صحي. لا تتوفر معلومات مقروءة عن اسم المنتج أو مكوناته أو الادعاءات على العبوة.",
    category: "health",
    expected: [],
    requiresReview: true,
  },
];
const only = process.argv.find((a) => a.startsWith("--case="))?.slice(7);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await context.addInitScript(() => localStorage.setItem("saleem-lang", "en"));
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [],
  invocations = [];
page.on("pageerror", (e) => errors.push(safe(e.message)));
page.on("response", async (r) => {
  if (r.url().includes("/functions/v1/analyze")) {
    let body;
    try {
      body = await r.json();
    } catch {}
    invocations.push({
      status: r.status(),
      run_id: body?.run_id ?? null,
      error: body?.error ? safe(body.error) : null,
    });
  }
});
// Guard against accidental production traffic. No requests are fulfilled or replaced.
await context.route("**/*", (r) => {
  const u = new URL(r.request().url());
  if (
    /\/(?:rest|auth|storage|functions)\/v1\//.test(u.pathname) &&
    !new Set(["localhost", "127.0.0.1"]).has(u.hostname)
  )
    return r.abort("blockedbyclient");
  return r.continue();
});
try {
  await page.goto("http://localhost:3001/login", { waitUntil: "networkidle" });
  await page
    .getByLabel(en.auth.email, { exact: true })
    .fill(credentials.users[0].email);
  await page
    .getByLabel(en.auth.password, { exact: true })
    .fill(credentials.users[0].password);
  await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });
  console.log(
    JSON.stringify({
      login: "PASS",
      method: "real local Supabase password auth",
    }),
  );
  // Deliberately unreadable synthetic packaging; not an edited user asset.
  const blank = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 240;
    const x = c.getContext("2d");
    x.fillStyle = "#ddd";
    x.fillRect(0, 0, 320, 240);
    x.fillStyle = "#aaa";
    x.fillRect(110, 30, 100, 180);
    x.fillStyle = "#888";
    x.font = "2px sans-serif";
    x.fillText("Unspecified health product", 112, 90);
    return c.toDataURL("image/png").split(",")[1];
  });
  fs.writeFileSync(
    path.join(runtime, "unclear-ad.png"),
    Buffer.from(blank, "base64"),
  );
  for (const c of cases.filter((c) => !only || c.id === only)) {
    const start = Date.now(),
      before = invocations.length;
    let sid = null;
    try {
      await page.goto("http://localhost:3001/new", {
        waitUntil: "networkidle",
      });
      await page
        .getByRole("radio", { name: en.kinds[c.kind], exact: true })
        .click();
      if (c.kind === "text")
        await page
          .getByLabel(en.newCheck.textLabel, { exact: true })
          .fill(c.text);
      else {
        await page
          .locator('input[type="file"]')
          .first()
          .setInputFiles(path.resolve(root, c.file));
        await page
          .getByRole("button", { name: /Remove|إزالة/ })
          .waitFor({ timeout: 20000 });
      }
      if (c.caption)
        await page
          .getByLabel(en.newCheck.captionLabel, { exact: true })
          .fill(c.caption);
      await page
        .getByLabel(en.newCheck.titleLabel, { exact: false })
        .fill(c.title);
      await page
        .getByLabel(en.newCheck.category, { exact: true })
        .selectOption(c.category);
      await page
        .getByRole("switch", { name: en.newCheck.contract, exact: false })
        .check();
      await page
        .getByLabel(en.newCheck.license, { exact: false })
        .fill("LOCAL-TEST-ONLY");
      await page
        .getByRole("checkbox", { name: en.newCheck.consent, exact: true })
        .check();
      await page
        .getByRole("button", { name: en.newCheck.submit, exact: true })
        .click();
      await page.waitForURL(/\/checks\/[a-f0-9-]+$/, { timeout: 45000 });
      sid = page.url().split("/").at(-1);
      let sub, run;
      for (let retry = 0; retry < 3; retry++) {
        const deadline = Date.now() + 220000;
        while (Date.now() < deadline) {
          [sub] = await db(
            "submissions",
            `id=eq.${sid}&select=id,status,overall_status,is_demo,error_message`,
          );
          if (["done", "failed"].includes(sub?.status)) break;
          await new Promise((r) => setTimeout(r, 2000));
        }
        if (
          sub?.status === "failed" &&
          /provider_(down|rate_limited)/.test(sub.error_message ?? "") &&
          retry < 2
        ) {
          console.log(
            JSON.stringify({
              test: c.id,
              retry: retry + 1,
              reason: sub.error_message,
            }),
          );
          await new Promise((r) => setTimeout(r, 2000 * 2 ** retry));
          await page
            .getByRole("button", { name: en.processing.retry, exact: true })
            .click();
          continue;
        }
        break;
      }
      if (sub?.status !== "done")
        throw new Error(
          `Analysis ${sub?.status ?? "not found"}: ${sub?.error_message ?? "worker did not finish"}`,
        );
      [run] = await db(
        "analysis_runs",
        `submission_id=eq.${sid}&select=*&order=started_at.desc&limit=1`,
      );
      const findings = await db(
        "findings",
        `run_id=eq.${run.id}&select=rule_code,evidence_text,severity,t_start,source,explanation_ar`,
      );
      const rules = await db(
        "rules",
        `rulebook_version_id=eq.${run.rulebook_version_id}&select=code`,
      );
      const [transcript] = await db(
        "transcripts",
        `submission_id=eq.${sid}&select=segments`,
      );
      if (
        sub.is_demo ||
        run.llm_provider !== "gemini" ||
        !run.raw_llm_output?.length ||
        !(run.token_usage?.input_tokens > 0)
      )
        throw new Error(
          "No verifiable real Gemini response on this user submission",
        );
      if (
        findings.some(
          (f) =>
            !rules.some((r) => r.code === f.rule_code) ||
            !f.evidence_text?.trim(),
        )
      )
        throw new Error("Finding lacks existing rule or concrete evidence");
      if (
        c.expected.some((code) => !findings.some((f) => f.rule_code === code))
      )
        throw new Error("Expected evidence-backed rule was not detected");
      if (
        c.kind === "video" &&
        (!transcript?.segments?.length || !run.frames_count)
      )
        throw new Error("Video lacks real transcript or visual input");
      if (
        c.requiresReview &&
        (sub.overall_status !== "review" ||
          !run.step_outputs?.review_reasons?.length)
      )
        throw new Error(
          "Insufficient evidence lacks explicit run-level human-review notices",
        );
      await page.locator("#report-status").waitFor({ timeout: 30000 });
      const statusText = await page.locator("#report-status").textContent();
      await page.getByRole("button", { name: /العربية/ }).click();
      await page.locator('html[dir="rtl"]').waitFor();
      const screenshot = `live-${c.id}-PASS.png`;
      await page.screenshot({
        path: path.join(out, screenshot),
        fullPage: true,
      });
      await page.getByRole("button", { name: /English/ }).click();
      const record = {
        id: c.id,
        status: "PASS",
        submission_id: sid,
        run_id: run.id,
        model: run.llm_model,
        latency_ms: Date.now() - start,
        pipeline_durations_ms: run.durations_ms,
        token_usage: run.token_usage,
        transcription_usage: run.step_outputs?.asr_usage ?? null,
        overall_status: sub.overall_status,
        ui_status: statusText,
        frames: run.frames_count,
        transcript_segments: transcript?.segments?.length ?? 0,
        findings,
        review_reasons: run.step_outputs?.review_reasons ?? [],
        invocations: invocations.slice(before),
        screenshot,
      };
      report.tests.push(record);
      console.log(
        JSON.stringify({
          test: c.id,
          status: "PASS",
          model: run.llm_model,
          latency_ms: record.latency_ms,
          overall_status: sub.overall_status,
          findings: findings.map((f) => f.rule_code),
        }),
      );
    } catch (e) {
      const record = {
        id: c.id,
        status: "FAIL",
        submission_id: sid,
        latency_ms: Date.now() - start,
        error: safe(e.message),
        invocations: invocations.slice(before),
      };
      report.tests.push(record);
      console.log(JSON.stringify(record));
      await page
        .screenshot({
          path: path.join(out, `live-${c.id}-FAIL.png`),
          fullPage: true,
        })
        .catch(() => {});
    }
    save();
  }
  report.console_errors = errors;
  save();
} catch (e) {
  report.blocker = safe(e.message);
  save();
  console.log(JSON.stringify({ e2e: "BLOCKED", reason: report.blocker }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
if (report.tests.some((t) => t.status !== "PASS")) process.exitCode = 1;
