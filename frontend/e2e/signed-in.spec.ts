import { expect, test, tr } from "./fixtures";

test("dashboard filters update the URL and list", async ({ signedIn: page, lang }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("مراجعة عطر العود")).toBeVisible();
  await page.getByRole("tab", { name: tr(lang, "جاهز للنشر", "Ready to publish") }).click();
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByText("تغريدة إطلاق التطبيق")).toBeVisible();
  await expect(page.getByText("مراجعة عطر العود")).toHaveCount(0);
});

test("new check validates file and consent before upload", async ({ signedIn: page, lang }) => {
  await page.goto("/new");
  await page.locator("form#new-check").evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect(
    page.getByText(tr(lang, "اختر ملفاً للفحص.", "Choose a file to check.")),
  ).toBeVisible();
  await expect(
    page.getByText(tr(lang, "يجب الموافقة للمتابعة.", "Please confirm to continue.")),
  ).toBeVisible();
  // Text-only content swaps the dropzone for a text field.
  await page.getByRole("radio", { name: tr(lang, "نص فقط", "Text only") }).click();
  await expect(page.getByLabel(tr(lang, "نص المنشور", "Post text"))).toBeVisible();
});

test("live processing view shows real backend progress", async ({ signedIn: page, lang }) => {
  await page.goto("/checks/aaaaaaaa-0000-4000-8000-000000000001");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "55");
  await expect(
    page.getByText(tr(lang, "تحليل المشاهد والسياق", "Analyze visuals and context")),
  ).toBeVisible();
});

test("failed check explains the reason and offers retry", async ({ signedIn: page, lang }) => {
  await page.goto("/checks/aaaaaaaa-0000-4000-8000-000000000005");
  await expect(
    page.getByText(tr(lang, "تعذّر إكمال الفحص", "We couldn't finish this check")),
  ).toBeVisible();
  await expect(page.getByText("لا يحتوي على مسار صوتي")).toBeVisible();
  await expect(
    page.getByRole("button", { name: tr(lang, "أعد المحاولة", "Try again") }),
  ).toBeVisible();
});
