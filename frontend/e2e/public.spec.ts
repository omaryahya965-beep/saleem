import { appReady, expect, test, tr } from "./fixtures";

const DEMO = "d0000000-0000-0000-0000-000000000001";
const DEMO_READY = "d0000000-0000-0000-0000-000000000002";

test("landing: direction, promise and interactive mini report", async ({
  page,
  lang,
  consoleErrors,
}) => {
  await page.goto("/");
  await appReady(page);
  await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    tr(lang, "افحص قبل أن تنشر", "Check before you publish"),
  );
  const marker = page
    .getByRole("button", { name: new RegExp(tr(lang, "عند 00:00", "at 00:00")) })
    .first();
  await marker.click();
  await expect(marker).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(
      tr(lang, "إعلان دون إفصاح قبل بدايته", "Ad without disclosure before it starts"),
    ),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("sample report: status, issues, seek and transcript sync", async ({ page, lang }) => {
  await page.goto(`/checks/${DEMO}`);
  await appReady(page);
  await expect(page.locator("#report-status")).toHaveText(tr(lang, "يحتاج تعديلات", "Needs fixes"));
  const cards = page.locator("article");
  await expect(cards).toHaveCount(6);
  // Selecting the 00:12 issue card seeks the timeline and highlights the card.
  const card = cards.filter({ hasText: "COM-01" }).first();
  await card.getByRole("button").first().click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuetext", "00:12");
  await expect(card).toHaveAttribute("aria-current", "true");
  // Clicking a transcript line seeks too.
  await page.locator("ol button", { hasText: "00:24" }).click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuetext", "00:24");
  await expect(
    page
      .getByText(
        tr(
          lang,
          "تنبيهات استرشادية وليست موافقة رسمية",
          "Advisory alerts, not an official approval",
        ),
      )
      .first(),
  ).toBeVisible();
});

test("ready report shows what was fixed vs the previous version", async ({ page, lang }) => {
  await page.goto(`/checks/${DEMO_READY}`);
  await appReady(page);
  await expect(page.locator("#report-status")).toHaveText(
    tr(lang, "جاهز للنشر", "Ready to publish"),
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
  await expect(page.getByText("MAW-01")).toBeVisible();
  await page.getByRole("searchbox").fill("COM-01");
  await expect(page.getByText("COM-01")).toBeVisible();
  await expect(page.getByText("MAW-01")).toHaveCount(0);
  await page.getByRole("searchbox").fill("zzzz");
  await expect(
    page.getByText(tr(lang, "لا توجد قواعد مطابقة.", "No matching rules.")),
  ).toBeVisible();
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    tr(lang, "Rulebook", "دليل القواعد"),
  );
});
