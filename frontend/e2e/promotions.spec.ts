import type { Page } from "@playwright/test";
import { expect, test, tr } from "./fixtures";
// @ts-expect-error — plain ESM helper shared with the screenshot scripts
import { MOCK_SUBMISSIONS, MOCK_USER_ID } from "../../scripts/mock-auth.mjs";

// Phase 1: promotions with numbered versions. Network is mocked (no backend needed).
const URL_ = process.env["VITE_SUPABASE_URL"] ?? "";
const PID = "bbbbbbbb-0000-4000-8000-000000000001";
type Sub = (typeof MOCK_SUBMISSIONS)[number];
const [, v2, v1] = MOCK_SUBMISSIONS as Sub[]; // v1 = review, v2 = needs_fixes
const versions = [
  { ...v1, promotion_id: PID, version_no: 1 },
  { ...v2, promotion_id: PID, version_no: 2 },
];
const promotion = {
  id: PID,
  org_id: null,
  owner_id: MOCK_USER_ID,
  title: "إعلان تمويل تجريبي",
  product_id: null,
  sector: null,
  channels: ["instagram"],
  communication_type: "creator_sponsored",
  audience: ["general"],
  market: "SA",
  is_paid: true,
  distribution: null,
  creator_license_no: null,
  caption: null,
  reviewer_notes: null,
  campaign_id: null,
  deadline_at: null,
  review_status: "draft",
  current_version_id: v2.id,
  assigned_reviewer_id: null,
  submitted_at: null,
  first_decision_at: null,
  approved_at: null,
  approved_version_id: null,
  tags: [],
  is_demo: false,
  created_at: v1.created_at,
  updated_at: v2.created_at,
};

async function mockPromotions(page: Page) {
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  const wantsObject = (h: Record<string, string>) => h["accept"]?.includes("vnd.pgrst.object");
  await page.context().route("**/rest/v1/promotions**", (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get("id") === `eq.${PID}`)
      return route.fulfill(json(wantsObject(route.request().headers()) ? promotion : [promotion]));
    return route.fulfill(json([promotion]));
  });
  await page.context().route("**/rest/v1/submissions**", (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get("promotion_id") === `eq.${PID}`) return route.fulfill(json(versions));
    const inIds = u.searchParams.get("id");
    if (inIds?.startsWith("in."))
      return route.fulfill(json(versions.filter((v) => inIds.includes(v.id))));
    const eq = inIds?.replace(/^eq\./, "");
    const row = versions.find((v) => v.id === eq);
    if (row && u.searchParams.get("select")?.includes("promotion_id"))
      return route.fulfill(json(wantsObject(route.request().headers()) ? row : [row]));
    if (row) return route.fulfill(json(wantsObject(route.request().headers()) ? row : [row]));
    return route.fallback();
  });
}

test("promotions list opens a promotion with its latest version", async ({
  signedIn: page,
  lang,
}) => {
  await mockPromotions(page);
  await page.goto("/promotions");
  await page.getByText("إعلان تمويل تجريبي").click();
  await expect(page).toHaveURL(new RegExp(`/promotions/${PID}`));
  await expect(page.getByRole("heading", { name: "إعلان تمويل تجريبي" })).toBeVisible();
  // D177: approval state and automated-analysis state are shown separately.
  await expect(page.getByTestId("review-status")).toContainText(tr(lang, "مسودة", "Draft"));
  await expect(page.getByTestId("analysis-status")).toContainText(tr(lang, "مكتمل", "Completed"));
  // Latest version (V2) is selected; the automated result never says "compliant".
  await expect(page.getByRole("button", { name: /V2|إ2|الإصدار 2|Version 2/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByText(tr(lang, "ملاحظات تستلزم التعديل", "Findings that require changes")).first(),
  ).toBeVisible();
  await expect(page.getByTestId("advisory")).toBeVisible();
});

test("version switcher selects V1 through ?v=1", async ({ signedIn: page }) => {
  await mockPromotions(page);
  await page.goto(`/promotions/${PID}`);
  await page.getByRole("button", { name: /V1|إ1|الإصدار 1|Version 1/ }).click();
  await expect(page).toHaveURL(/v=1/);
  await expect(page.getByRole("button", { name: /V1|إ1|الإصدار 1|Version 1/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("/checks/$id lands on the right version of its promotion", async ({ signedIn: page }) => {
  await mockPromotions(page);
  await page.goto(`/checks/${v1.id}`);
  await expect(page).toHaveURL(new RegExp(`/promotions/${PID}\\?v=1`));
});

test("upload new version links to /new with the promotion", async ({ signedIn: page, lang }) => {
  await mockPromotions(page);
  await page.goto(`/promotions/${PID}`);
  await // D177: one primary revision action «ارفع النسخة المعدلة» (was «رفع إصدار جديد»).
  await page
    .getByRole("link", { name: tr(lang, "ارفع النسخة المعدلة", "Upload revised version") })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/new\\?promotion=${PID}`));
  await expect(page.getByTestId("new-version-banner")).toContainText("إعلان تمويل تجريبي");
});
