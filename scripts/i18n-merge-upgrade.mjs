// Deep-merges a bilingual message module ({ ar: {...}, en: {...} }) into frontend/src/i18n/{ar,en}.json.
// Usage: node scripts/i18n-merge-upgrade.mjs frontend/src/i18n/upgrade/<area>.mjs
// Keeps both files in the same key order so the parity test stays meaningful; refuses one-sided keys.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [, , modPath] = process.argv;
if (!modPath) throw new Error("usage: node scripts/i18n-merge-upgrade.mjs <module>");
const mod = await import(pathToFileURL(resolve(modPath)).href);

const leaves = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? leaves(v, `${p}${k}.`) : [`${p}${k}`]));
const a = new Set(leaves(mod.ar));
const e = new Set(leaves(mod.en));
const missing = [...a].filter((k) => !e.has(k)).concat([...e].filter((k) => !a.has(k)));
if (missing.length) throw new Error(`keys not in both languages: ${missing.join(", ")}`);

const merge = (target, src) => {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (typeof target[k] !== "object" || target[k] === null) target[k] = {};
      merge(target[k], v);
    } else target[k] = v;
  }
  return target;
};

for (const lang of ["ar", "en"]) {
  const file = resolve(`frontend/src/i18n/${lang}.json`);
  const raw = readFileSync(file, "utf8");
  const json = merge(JSON.parse(raw), mod[lang]);
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
}
console.log(`merged ${a.size} keys from ${modPath}`);
