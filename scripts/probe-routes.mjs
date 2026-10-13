// Prints the first visible text of each route — quick smoke check. Usage: node scripts/probe-routes.mjs <base> <path>...
import { chromium } from "@playwright/test";
const [base, ...paths] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage();
p.on("pageerror", (e) => console.log("pageerror:", e.message));
for (const path of paths) {
  await p.goto(`${base}/${path.replace(/^\//, "")}`, { waitUntil: "networkidle" });
  console.log(path, "→", (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 140));
}
await b.close();
