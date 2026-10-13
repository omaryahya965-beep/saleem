// Deep-merges a patch JSON into a locale file: node scripts/i18n-merge.mjs <locale.json> <patch.json>
import fs from "node:fs";
const [target, patch] = process.argv.slice(2);
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(a[k] ?? {}, v) : v;
  return a;
};
const out = merge(JSON.parse(fs.readFileSync(target, "utf8")), JSON.parse(fs.readFileSync(patch, "utf8")));
fs.writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
