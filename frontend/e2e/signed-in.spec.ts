import { expect, test, tr } from "./fixtures";

test("dashboard filters update the URL and list", async ({ signedIn: page, lang }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("مراجعة عطر العود")).toBeVisible();
  await page
    .getByRole("tab", { name: tr(lang, "لا ملاحظات آلية", "No automated findings") })
    .click();
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

test("app navigation lives in the sidebar/drawer; the account menu stays small", async ({
  signedIn: page,
  lang,
}) => {
  await page.goto("/dashboard");
  const mobile = (page.viewportSize()?.width ?? 1440) < 768;
  if (mobile) {
    await page.getByTestId("nav-menu").click();
    await expect(page.getByRole("dialog").getByTestId("nav-rules")).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    const sidebar = page.getByTestId("app-sidebar");
    await expect(sidebar.getByTestId("nav-dashboard")).toHaveAttribute("aria-current", "page");
    await expect(sidebar.getByTestId("nav-rules")).toBeVisible();
  }
  await page.getByTestId("account-menu").click();
  const items = page.getByTestId("account-menu-content").getByRole("menuitem");
  // Personal settings, terms, sign out (+ workspace switcher entries only with several workspaces).
  await expect(items).toHaveCount(3);
  await expect(items.last()).toHaveText(tr(lang, "تسجيل الخروج", "Sign out"));
});
