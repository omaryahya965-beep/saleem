// UI contract tests only. Mocked REST results are NOT evidence of live Gemini success.
import { expect, test, appReady, tr } from "./fixtures";

const id = "aaaaaaaa-0000-4000-8000-000000000003";
const reason = {
  ar: "الصور غير متاحة للتحليل؛ يلزم فحص المحتوى المرئي بشرياً.",
  en: "Images are unavailable for analysis; human review of visual content is required.",
};

test("exhausted Gemini 503 shows temporary failure guidance and manual retry", async ({
  signedIn: page,
  context,
  lang,
}) => {
  await context.route("**/rest/v1/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").at(-1);
    const single = route.request().headers()["accept"]?.includes("vnd.pgrst.object");
    const userId = "11111111-2222-4333-8444-555555555555";
    const rows =
      table === "submissions"
        ? [
            {
              id,
              user_id: userId,
              is_demo: false,
              kind: "text",
              title: "503 contract test",
              status: "failed",
              current_step: "llm",
              progress: 40,
              error_message: "code:provider_provider_down",
              created_at: new Date().toISOString(),
            },
          ]
        : table === "profiles"
          ? [{ id: userId, display_name: "نورة" }]
          : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(single ? (rows[0] ?? null) : rows),
    });
  });
  await page.goto(`/checks/${id}`);
  await appReady(page);
  await expect(
    page.getByText(
      tr(
        lang,
        "تعذّر الوصول إلى مزوّد التحليل مؤقتاً. أعد المحاولة بعد قليل.",
        "The analysis provider is temporarily unreachable. Try again shortly.",
      ),
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: tr(lang, "أعد المحاولة", "Try again"), exact: true }),
  ).toBeVisible();
  await expect(page.locator("#report-status")).toHaveCount(0);
});

test("Gemini report shows persisted human review notices instead of a clean result", async ({
  signedIn: page,
  context,
  lang,
  consoleErrors,
}) => {
  await context.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    const single = route.request().headers()["accept"]?.includes("vnd.pgrst.object");
    const submission = {
      id,
      user_id: "11111111-2222-4333-8444-555555555555",
      is_demo: false,
      title: "إعلان يحتاج مراجعة",
      kind: "image",
      platform: "instagram",
      product_category: "other",
      caption: "",
      file_path: null,
      status: "done",
      progress: 100,
      current_step: "done",
      overall_status: "review",
      created_at: "2026-11-17T12:00:00Z",
      analyzed_at: "2026-11-17T12:01:00Z",
      media_deleted_at: "2026-11-17T12:02:00Z",
      parent_id: null,
    };
    const run = {
      id: "run-gemini",
      submission_id: id,
      status: "done",
      llm_provider: "gemini",
      llm_model: "gemini-3.8-flash",
      rulebook_version_id: "v1",
      rulebook_version: "test-v1",
      step_outputs: { review_reasons: [reason] },
    };
    let rows: unknown[] = [];
    if (table === "submissions") rows = [submission];
    if (table === "analysis_runs") rows = [run];
    if (table === "rulebook_versions")
      rows = [{ id: "v1", version_label: "test-v1", is_active: true }];
    if (table === "profiles") rows = [{ id: submission.user_id, display_name: "نورة" }];
    if (table === "user_roles") rows = [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(single ? (rows[0] ?? null) : rows),
    });
  });
  await page.goto(`/checks/${id}`);
  await appReady(page);
  await expect(page.locator("#report-status")).toHaveText(tr(lang, "يحتاج مراجعة", "Needs review"));
  await expect(
    page.getByRole("heading", {
      name: tr(lang, "يتطلب مراجعة بشرية قبل النشر", "Human review required before publishing"),
    }),
  ).toBeVisible();
  await expect(page.getByText(reason[lang], { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  // Toggle the actual language control and verify the persisted notice follows it.
  await page.getByRole("button", { name: /English|العربية/ }).click();
  await expect(page.getByText(reason[lang === "ar" ? "en" : "ar"], { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /English|العربية/ }).click();
  await expect(page.getByText(reason[lang], { exact: true })).toBeVisible();
  await expect(
    page.getByText(tr(lang, "كل القواعد المطبّقة اجتازت الفحص.", "Every applicable rule passed."), {
      exact: true,
    }),
  ).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
  if (process.env["SALEEM_QA_OUTPUT_DIR"]) {
    await page.screenshot({
      path: `${process.env["SALEEM_QA_OUTPUT_DIR"]}/${test.info().project.name}-gemini-review.png`,
      fullPage: true,
    });
  }
});
