// V2 completion §13 (D202): regulatory source-verification register for the 187 draft rules.
// Usage: node backend/scripts/gen-regulatory-verification.mjs  →  docs/saleem-v2/legal/REGULATORY_VERIFICATION.md
// Inputs: the rules/sources CSVs and docs/saleem-v2/data/source_url_check.json (reachability of every cited URL).
// It classifies each rule's evidence and gives a verification status. It NEVER marks a rule legally verified or
// active: that needs a named legal reviewer through the existing governance flow (legal_review → publish).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/^﻿/, "");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const rules = parseCsv(read("docs/saleem-v2/data/saleem_saudi_rules_v0_1.csv"));
const check = JSON.parse(read("docs/saleem-v2/data/source_url_check.json"));
const byUrl = new Map(check.results.map((r) => [r.url, r]));
if (rules.length !== 187) throw new Error(`expected 187 rules, got ${rules.length}`);

const ANNOUNCEMENT = /\/news\/|mediacenter|spa\.gov\.sa/i;
const OFFICIAL = /(^|\.)gov\.sa$/i;

/** Evidence class and status for one rule. */
function classify(r) {
  const url = r.source_url;
  const host = url ? new URL(url).hostname : "";
  const res = byUrl.get(url);
  const official = OFFICIAL.test(host);
  const announcement = ANNOUNCEMENT.test(url);
  const expectPdf = /\.pdf($|\?)/i.test(url);
  let evidence = !url ? "none" : !official ? "secondary" : announcement ? "official_announcement" : "official_instrument";
  let status;
  if (!url) status = "no_source";
  else if (!official) status = "needs_primary_source";
  else if (!res || res.status === null) status = "unreachable_here";
  else if (res.status >= 400) status = "broken_link";
  else if (expectPdf && !String(res.content_type).includes("pdf")) status = "link_not_document";
  else if (announcement) status = "needs_primary_source";
  else if (!r.legal_reference) status = "reference_missing";
  else status = "ready_for_legal_review";
  return { host, evidence, status, http: res?.status ?? null };
}

const STATUS_AR = {
  ready_for_legal_review: "المصدر الرسمي متاح — المرجع جاهز للمراجعة القانونية",
  needs_primary_source: "يعتمد على إعلان/خبر — يلزم الصك الرسمي",
  unreachable_here: "تعذّر الوصول من بيئة التحقق — يُتحقق يدوياً",
  link_not_document: "الرابط يفتح صفحة لا المستند المذكور — يلزم تأكيد المستند",
  broken_link: "رابط معطّل",
  reference_missing: "لا يوجد مرجع مادة",
  no_source: "لا يوجد مصدر",
};

const rows = rules.map((r) => ({ r, c: classify(r) }));
const count = (f) => rows.filter(f).length;
const statuses = Object.keys(STATUS_AR);

let md = `# سجل التحقق من المصادر التنظيمية — القواعد السعودية v0.1

مولّد بالأمر \`node backend/scripts/gen-regulatory-verification.mjs\` من \`docs/saleem-v2/data/saleem_saudi_rules_v0_1.csv\`
و\`docs/saleem-v2/data/source_url_check.json\` (فحص الوصول بتاريخ ${check.checked_on}: ${check.method}).

**لا تُعدّ أي قاعدة هنا موثّقة قانونياً ولا مفعّلة.** هذا السجل يجهّز القواعد للاعتماد البشري الرسمي: الحالة
«جاهز للمراجعة القانونية» تعني أن الرابط الرسمي يعمل وأن للمادة مرجعاً مسجّلاً، لا أن نص المادة طوبق. التفعيل يتم فقط
عبر مسار الحوكمة الحالي (مراجعة قانونية باسم المراجع ثم نشر إصدار جديد من مشرف المنصة)، ولم تُفعَّل القواعد الـ187.

## الملخص

| الحالة | العدد |
|---|---|
${statuses.map((s) => `| ${STATUS_AR[s]} | ${count((x) => x.c.status === s)} |`).join("\n")}
| **المجموع** | **${rows.length}** |

| نوع الدليل | العدد |
|---|---|
| صك أو دليل رسمي على نطاق gov.sa | ${count((x) => x.c.evidence === "official_instrument")} |
| إعلان أو خبر على موقع رسمي | ${count((x) => x.c.evidence === "official_announcement")} |
| مصدر ثانوي (خارج gov.sa) | ${count((x) => x.c.evidence === "secondary")} |

### حقول لم تُسجَّل بعد لأي قاعدة

مجموعة البيانات الحالية لا تتضمن **الاستثناءات** ولا **تاريخ النفاذ** لكل قاعدة، ونطاق التطبيق مسجّل نصاً
(\`applicability_ar\`) وليس دائماً كنوع اتصال. يكملها المراجع القانوني قبل الاعتماد؛ لم تُخترع قيم لها.

## حسب الجهة

| الجهة | القواعد | جاهزة للمراجعة | تحتاج صكاً رسمياً | تعذّر الوصول/تأكيد المستند |
|---|---|---|---|---|
`;
const authorities = [...new Set(rules.map((r) => r.authority_ar))];
for (const a of authorities) {
  const xs = rows.filter((x) => x.r.authority_ar === a);
  md += `| ${a} | ${xs.length} | ${xs.filter((x) => x.c.status === "ready_for_legal_review").length} | ${xs.filter((x) => x.c.status === "needs_primary_source").length} | ${xs.filter((x) => ["unreachable_here", "link_not_document", "broken_link"].includes(x.c.status)).length} |\n`;
}

md += `
## الروابط المفحوصة

| HTTP | النوع | الرابط |
|---|---|---|
${check.results.map((r) => `| ${r.status ?? "—"} | ${r.content_type ?? r.error ?? ""} | ${r.url} |`).join("\n")}

## السجل التفصيلي

| القاعدة | الجهة | المرجع | القطاع | نطاق التطبيق | نمط الفحص | الدليل | حالة التحقق | القرار القانوني |
|---|---|---|---|---|---|---|---|---|
`;
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
for (const { r, c } of rows)
  md += `| ${r.rule_id} | ${esc(r.authority_ar)} | ${esc(r.legal_reference) || "—"} | ${esc(r.sector_ar)} | ${esc(r.applicability_ar)} | ${r.check_mode} | ${c.evidence} | ${STATUS_AR[c.status]} | يتطلب اعتماداً قانونياً ☐ |\n`;

md += fs.readFileSync(path.join(root, "docs/saleem-v2/legal/coverage-notes.md"), "utf8").replace("${checked}", check.checked_on);
fs.writeFileSync(path.join(root, "docs/saleem-v2/legal/REGULATORY_VERIFICATION.md"), md);
console.log(Object.fromEntries(statuses.map((s) => [s, count((x) => x.c.status === s)])));
