// Signs in with each test account through the real login page (no mocks) and reports where it lands.
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:4173";
const b = await chromium.launch();
for (const email of ["demo@saleem.app", "agency@saleem.app", "admin@saleem.app"]) {
  const c = await b.newContext();
  const p = await c.newPage();
  await p.goto(`${base}/login`);
  await p.locator("html[data-app-ready]").waitFor({ state: "attached" });
  await p.getByRole("button", { name: new RegExp(email.replace(".", "\.")) }).click();
  await p.waitForURL(/\/dashboard/, { timeout: 20000 });
  await p.getByRole("heading", { level: 1 }).waitFor();
  console.log(email, "→", new URL(p.url()).pathname, "| dashboard ✓");
  if (email.startsWith("agency")) {
    await p.goto(`${base}/org`);
    await p.getByText("وكالة نخلة للتسويق").waitFor({ timeout: 15000 });
    console.log("  workspace visible ✓");
  }
  if (email.startsWith("admin")) {
    await p.goto(`${base}/admin/metrics`);
    await p.getByRole("heading", { level: 1 }).waitFor();
    console.log("  admin page:", (await p.getByRole("heading", { level: 1 }).innerText()).trim());
  }
  await c.close();
}
await b.close();
