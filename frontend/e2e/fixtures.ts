import { test as base, expect, type Page } from "@playwright/test";
// @ts-expect-error — plain ESM helper shared with the screenshot scripts
import { installMockAuth } from "../../scripts/mock-auth.mjs";

type Lang = "ar" | "en";

export const test = base.extend<{ lang: Lang; signedIn: Page; consoleErrors: string[] }>({
  // eslint-disable-next-line no-empty-pattern
  lang: async ({}, use, info) =>
    use(((info.project.metadata as { lang?: Lang }).lang ?? "ar") as Lang),
  context: async ({ context, lang }, use) => {
    await context.addInitScript((l) => localStorage.setItem("saleem-lang", l), lang);
    await use(context);
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await use(errors);
  },
  signedIn: async ({ context, page }, use) => {
    await installMockAuth(context);
    await use(page);
  },
});

/** Waits until the SPA has taken over from the prerendered snapshot. */
export async function appReady(page: Page) {
  await page.locator("html[data-app-ready]").waitFor({ state: "attached" });
}

export const tr = (lang: Lang, ar: string, en: string) => (lang === "ar" ? ar : en);
export { expect };
