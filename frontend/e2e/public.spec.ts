import { appReady, expect, test, tr } from "./fixtures";

const DEMO = "d0000000-0000-0000-0000-000000000001";
const DEMO_READY = "d0000000-0000-0000-0000-000000000002";

// V2 upgrade §31 (D183): the landing presents the whole advertisement-to-approval workspace.
test("landing: direction, value proposition and calls to action", async ({
  page,
  lang,
  consoleErrors,
}) => {
  await page.goto("/");
  await appReady(page);
  await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    tr(
      lang,
      "من الإعلان إلى الاعتماد، في مساحة عمل واحدة.",
      "From advertisement to approval, in one workspace.",
    ),
  );
  await expect(
    page.getByRole("link", { name: tr(lang, "شاهد تقريراً جاهزاً", "View a sample report") }),
  ).toBeVisible();
  await expect(
    page
      .getByText(tr(lang, "لا يضمن الامتثال القانوني", "does not guarantee legal compliance"))
      .first(),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

// V2 upgrade §32 (D182): /sample is the read-only Nada Cream report.
test("Nada Cream sample: versions, grouped findings, comparison, read-only", async ({
  page,
  lang,
}) => {
  await page.goto("/sample");
  await appReady(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    tr(lang, "كريم ندى — Nada Cream", "Nada Cream — كريم ندى"),
  );
  await expect(
    page.getByText(tr(lang, "9 أدلة ← 6 ملاحظات موحّدة", "9 evidence → 6 consolidated findings")),
  ).toBeVisible();
  await page.getByRole("tab", { name: tr(lang, "المقارنة", "Comparison") }).click();
  await expect(page.getByTestId("compare-summary")).toBeVisible();
  await expect(
    page.getByRole("button", { name: tr(lang, "إرسال للمراجعة", "Submit for review") }),
  ).toHaveCount(0);
});

// The older demo opens in the redesigned advertisement workspace (D177): compact summary, grouped findings
// whose timestamp buttons seek the player, transcript seeking, advisory note.
test("demo report: summary, grouped findings, seek and transcript sync", async ({ page, lang }) => {
  await page.goto(`/checks/${DEMO}`);
  await appReady(page);
  await expect(page.getByTestId("result-summary")).toContainText(
    tr(lang, "ملاحظات تستلزم التعديل", "Findings that require changes"),
  );
  const groups = page.getByTestId("finding-group");
  await expect(groups.first()).toBeVisible();
  const com = groups.filter({ hasText: "COM-01" }).first();
  await com.getByRole("button", { name: /00:12/ }).click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuetext", "00:12");
  await expect(com).toHaveAttribute("aria-current", "true");
  await page.locator("ol button", { hasText: "00:24" }).click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuetext", "00:24");
  await expect(
    page
      .getByText(tr(lang, "الملاحظات الآلية استرشادية", "Automated findings are advisory"))
      .first(),
  ).toBeVisible();
});

// The fixed-vs-previous view now lives in the comparison tab (D181), not repeated in the report.
test("ready report: no findings, and what was fixed vs the previous check", async ({
  page,
  lang,
}) => {
  await page.goto(`/checks/${DEMO_READY}`);
  await appReady(page);
  await expect(page.getByTestId("result-summary")).toContainText(
    tr(lang, "لا ملاحظات آلية", "No automated findings"),
  );
  await expect(
    page.getByRole("heading", { name: tr(lang, "ما تم إصلاحه", "What you fixed") }),
  ).toBeVisible();
  await expect(page.getByText("MAW-01").first()).toBeVisible();
});

test("compliance log and public verification", async ({ page, lang }) => {
  await page.goto(`/checks/${DEMO_READY}/log`);
  await appReady(page);
  await expect(page.getByText("SLM-D000-0000-0000").first()).toBeVisible();
  await page.goto(`/verify/${DEMO_READY}`);
  await appReady(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    tr(lang, "سجل أصلي ولم يُعدَّل", "Authentic and unchanged"),
  );
  await page.goto("/verify/00000000-0000-0000-0000-000000000009");
  await appReady(page);
  await expect(
    page.getByText(tr(lang, "لم نجد هذا السجل", "We couldn't find this log")),
  ).toBeVisible();
});

test("rulebook search and categories", async ({ page, lang }) => {
  await page.goto("/rules");
  await appReady(page);
  await expect(page.getByTestId("rule-results").getByText("MAW-01", { exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("COM-01");
  await expect(page.getByTestId("rule-results").getByText("COM-01", { exact: true })).toBeVisible();
  await expect(page.getByTestId("rule-results").getByText("MAW-01", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("searchbox").fill("zzzz");
  await expect(page.getByText(tr(lang, "لا توجد قواعد مطابقة", "No matching rules"))).toBeVisible();
});

test("protected pages redirect to sign-in; invalid share link is explained", async ({
  page,
  lang,
}) => {
  await page.goto("/dashboard");
  await appReady(page);
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    tr(lang, "مرحباً بعودتك", "Welcome back"),
  );
  await page.goto("/share/not-a-token");
  await appReady(page);
  await expect(page.getByText(tr(lang, "الرابط غير صالح", "This link isn't valid"))).toBeVisible();
});

test("language toggle flips direction and copy", async ({ page, lang }) => {
  await page.goto("/rules");
  await appReady(page);
  await page.getByRole("button", { name: new RegExp(tr(lang, "اللغة", "Language")) }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "ltr" : "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    tr(lang, "Rulebook", "دليل القواعد"),
  );
});
