// Phase 8 step 4: mapping report between the existing SAMA/CMA rules (packs sa-sama-advertising, sa-cma-securities)
// and the CSV v0.1 rules (packs sa-bank, sa-cma). Read-only on the rules: it never supersedes, merges, deletes or
// deactivates anything. Outputs:
//   docs/saleem-v2/legal/SAMA_CMA_MAPPING.md                       — the report for human approval
//   backend/supabase/migrations/20261118080700_v2_rule_mapping.sql  — a pending mapping table + a duplicate flag on
//                                                                     the NEW draft rules only (keeps them out of
//                                                                     analyses until a person decides)
// Usage (local stack running, every earlier migration applied): node backend/scripts/gen-rule-mapping.mjs
//
// Classification (automatic, conservative):
//   Exact Match         same source document AND identical article path (article + paragraph/item).
//   Possible Match      same source document AND one article path refines the other, or text similarity >= 0.30.
//   No Match            nothing above.
//   Verified Equivalent never assigned by this script — only a legal reviewer can confirm equivalence.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docker = process.env.DOCKER ?? "docker";
const q = (sql) =>
  JSON.parse(
    execFileSync(docker, ["exec", "-i", "supabase_db_saleem", "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], {
      input: `select coalesce(json_agg(t), '[]') from (${sql}) t;`,
      encoding: "utf8",
      maxBuffer: 64 << 20,
    }),
  );

const RELEASE = "22222222-2222-2222-2222-222222222222";
const cols = `r.code, r.pack, r.article_ref, r.title_ar, r.summary_ar, r.review_state, r.is_active, r.applicability, r.applicability_ar,
  r.content_triggers, r.check_mode, s.id as source_id, s.title_ar as source_title, s.url as source_url, s.status as source_status,
  s.verification, s.verified_at`;
const from = `from public.rules r left join public.regulatory_sources s on s.id = r.regulatory_source_id where r.rulebook_version_id = '${RELEASE}'`;
const oldRules = q(`select ${cols} ${from} and r.pack in ('sa-sama-advertising', 'sa-cma-securities') order by r.code`);
const newRules = q(`select ${cols} ${from} and r.pack in ('sa-bank', 'sa-cma') order by r.code`);
if (!oldRules.length || !newRules.length) throw new Error("no rules found — run `supabase db reset` first");

// ---- normalisation ----
const normAr = (s) =>
  (s ?? "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase();
const STOP = new Set(["هل", "في", "من", "على", "او", "و", "ان", "الي", "عن", "مع", "ما", "لا", "ذلك", "التي", "الذي", "كل", "ان", "قد", "بعد", "قبل"]);
const tokens = (s) =>
  new Set(normAr(s).split(/\s+/).map((w) => w.replace(/^(وال|بال|كال|فال|لل|ال)/, "")).filter((w) => w.length > 2 && !STOP.has(w)));
const jaccard = (a, b) => {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
};
const docKey = (r) => normAr(r.source_title).replace(/\s+/g, " ").trim();
/** Article path as numbers: «م3 فقرة8» → [3, 8]; old «3» with code SAMA-ADV-03-8 → [3, 8]; «Annex 5-1» → [A, 5, 1]. */
function articlePath(r, isOld) {
  const ref = String(r.article_ref ?? "");
  const annex = /annex|ملحق/i.test(ref) ? ["A"] : [];
  // Numbers and Arabic sub-item letters in order: «م33(هـ)» → [33, "ه"], «ملحق 5-1 بند9» → [A, 5, 1, 9].
  const nums = (ref.match(/\d+|\([ء-يـ]{1,3}\)/g) ?? []).map((x) => (/^\d+$/.test(x) ? Number(x) : x.replace(/[()ـ]/g, "")));
  if (isOld) {
    const m = r.code.match(/^SAMA-ADV-(\d+)(?:-(\d+))?/);
    if (m) return [Number(m[1]), ...(m[2] ? [Number(m[2])] : [])];
  }
  return [...annex, ...nums];
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
/** One path refines the other (e.g. [33] and [33, "د"]): the general rule may cover the specific one. */
const prefix = (a, b) => a.length !== b.length && a.slice(0, Math.min(a.length, b.length)).every((x, i) => x === b[i]);

function classify(o, n) {
  const sameDoc = docKey(o) === docKey(n) || (o.source_url && o.source_url === n.source_url);
  const pa = articlePath(o, true), pb = articlePath(n, false);
  const sim = jaccard(`${o.title_ar} ${o.summary_ar}`, `${n.title_ar} ${n.summary_ar}`);
  let cls = "No Match";
  if (sameDoc && pa.length && same(pa, pb)) cls = "Exact Match";
  else if ((sameDoc && pa.length && pb.length && prefix(pa, pb)) || sim >= 0.3) cls = "Possible Match";
  return { cls, sim, sameDoc, pa, pb };
}
const RANK = { "Exact Match": 3, "Possible Match": 2, "No Match": 0 };

const pairs = [];
for (const o of oldRules) {
  const scored = newRules
    .map((n) => ({ n, ...classify(o, n) }))
    .filter((x) => x.cls !== "No Match")
    .sort((a, b) => RANK[b.cls] - RANK[a.cls] || b.sim - a.sim);
  if (!scored.length) pairs.push({ o, n: null, cls: "No Match", sim: 0 });
  else for (const x of scored.slice(0, 3)) pairs.push({ o, ...x });
}
const newMatched = new Set(pairs.filter((p) => p.n).map((p) => p.n.code));
const newOnly = newRules.filter((n) => !newMatched.has(n.code));
// The NEW draft is flagged (kept out of analyses) when its best match is Exact or Possible.
const flag = new Map();
for (const p of pairs) if (p.n && !flag.has(p.n.code)) flag.set(p.n.code, p);

// ---- report ----
const esc = (s) => String(s ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
const scope = (r) => (r.applicability_ar ? r.applicability_ar : JSON.stringify(r.applicability ?? {}));
const counts = pairs.reduce((m, p) => ((m[p.cls] = (m[p.cls] ?? 0) + 1), m), {});
const md = [`# مطابقة قواعد البنك المركزي وهيئة السوق المالية — القديمة مقابل CSV v0.1

مولَّد بالأمر \`node backend/scripts/gen-rule-mapping.mjs\` من قاعدة محلية فيها كل الـ migrations. **للمراجعة والاعتماد فقط:**
لم يُستبدل أو يُدمج أو يُحذف أو يُعطَّل أي قاعدة. التصنيف آلي ومتحفّظ:

| التصنيف | المعنى |
|---|---|
| Exact Match | المستند نفسه، ورقم المادة والفقرة/البند متطابقان. التطابق في **الإحالة**، لا يعني تطابق الصياغة. |
| Verified Equivalent | **لا يُعيَّن آلياً.** يملؤه المراجع القانوني بعد مقارنة نص المادة الرسمي. |
| Possible Match | المستند نفسه وإحدى الإحالتين أعمّ من الأخرى (مثل «م33» و«م33(د)»)، أو تشابه نصي ≥ 0.30. الفقرات الشقيقة (3.1 و3.2) لا تُعدّ مطابقة. |
| No Match | لا مستند ولا مادة ولا تشابه كافٍ. |

**حالة القواعد الآن:** القديمة (${oldRules.length}) كلها **مسودات** (\`${[...new Set(oldRules.map((r) => r.review_state))].join(", ")}\`)، ولا توجد قاعدة قديمة مفعّلة ومُتحقَّق منها
قانونياً، فلا شيء يُحفظ «لأنه مُتحقَّق». الجديدة (${newRules.length}) مسودات أيضاً. القواعد الجديدة التي لها مطابقة Exact أو Possible
(${flag.size}) **مستبعدة من التحليلات** (السبب «تكرار محتمل — بانتظار المراجعة») حتى يقرّر المراجع، فلا تُطبَّق قاعدتان
متعارضتان أو مكررتان حتى لو فعّلت المنظمة المسودات.

**ما لا تحتويه البيانات:** تاريخ النفاذ غير موجود في القواعد القديمة ولا في ملف CSV (يوجد فقط تاريخ فحص المصدر في CSV)،
ونص المادة الرسمي غير مخزَّن. المقارنة هنا على الإحالة والمستند وملخص القاعدة. يجب على المراجع فتح نص المادة الرسمي.

الأعداد: ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(" · ")} · قواعد جديدة بلا نظير قديم: ${newOnly.length}

## الأزواج المحتملة

| # | القاعدة القديمة | المادة (قديم) | القاعدة الجديدة | المادة (جديد) | المستند نفسه؟ | التشابه | التصنيف | قرار المراجع |
|---|---|---|---|---|---|---|---|---|`];
pairs.forEach((p, i) =>
  md.push(
    `| ${i + 1} | ${p.o.code} | ${esc(p.o.article_ref)} | ${p.n?.code ?? "—"} | ${esc(p.n?.article_ref)} | ${p.n ? (p.sameDoc ? "نعم" : "لا") : "—"} | ${p.n ? p.sim.toFixed(2) : "—"} | ${p.cls} | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |`,
  ),
);
md.push(`\n## التفاصيل لكل زوج (المصدر، العنوان، المادة، النص، النطاق)\n`);
pairs.filter((p) => p.n).forEach((p, i) => {
  md.push(`### ${p.o.code} ↔ ${p.n.code} — ${p.cls}

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [${esc(p.o.source_title)}](${p.o.source_url ?? ""}) (${esc(p.o.source_id)}) | [${esc(p.n.source_title)}](${p.n.source_url ?? ""}) (${esc(p.n.source_id)}) |
| حالة المصدر / التحقق | ${esc(p.o.source_status)} / ${esc(p.o.verification)} | ${esc(p.n.source_status)} / ${esc(p.n.verification)} |
| المادة | ${esc(p.o.article_ref)} → [${p.pa.join(", ")}] | ${esc(p.n.article_ref)} → [${p.pb.join(", ")}] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ${esc(p.o.summary_ar)} | ${esc(p.n.summary_ar)} |
| النطاق والانطباق | ${esc(scope(p.o))} | ${esc(scope(p.n))} |
| نوع الفحص | ${esc(p.o.check_mode ?? "—")} | ${esc(p.n.check_mode)} |
| الحالة | ${esc(p.o.review_state)} | ${esc(p.n.review_state)} |
`);
});
md.push(`## قواعد CSV بلا نظير قديم (${newOnly.length})\n\nتبقى مسودات وتُطبَّق فقط إذا فعّلت المنظمة مسودات الحزمة.\n`);
for (const n of newOnly) md.push(`- ${n.code} (${esc(n.article_ref)}): ${esc(n.summary_ar)}`);
md.push(`\n## ما يحدث بعد اعتمادك\n
1. لكل زوج تعلّمه «Verified Equivalent»: تبقى القاعدة القديمة إن كانت سارية، وتُؤرشف الجديدة المكررة، أو العكس حسب قرارك، في migration منفصل تراجعه.
2. «ليست مطابقة»: يُزال علم التكرار عن القاعدة الجديدة فتعود مسودة عادية.
3. لا تصبح أي قاعدة «سارية» إلا بعد المراجعة القانونية وإصدار جديد ينشره مشرف المنصة.

المراجع: ______________  التاريخ: ________  التوقيع: ______________
`);
fs.writeFileSync(path.join(root, "docs/saleem-v2/legal/SAMA_CMA_MAPPING.md"), md.join("\n"));

// ---- migration: pending mapping rows + duplicate flag on the NEW drafts only ----
const lit = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const sql = [`-- v2 Phase 8 (step 4): SAMA/CMA ↔ CSV v0.1 mapping, PENDING human review. GENERATED by backend/scripts/gen-rule-mapping.mjs.
-- Changes no rule's status. Flags the NEW draft rules that may duplicate an existing rule so the engine keeps them out
-- of analyses until a reviewer decides (docs/saleem-v2/legal/SAMA_CMA_MAPPING.md).
create table if not exists public.rule_mappings (
  id             bigint generated always as identity primary key,
  old_code       text not null,
  new_code       text not null,
  classification text not null check (classification in ('exact_match', 'verified_equivalent', 'possible_match', 'no_match')),
  similarity     numeric(4, 2) null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by     uuid null,
  decided_at     timestamptz null,
  note           text null,
  created_at     timestamptz not null default now(),
  unique (old_code, new_code)
);
alter table public.rule_mappings enable row level security;
drop policy if exists rule_mappings_read on public.rule_mappings;
create policy rule_mappings_read on public.rule_mappings for select to authenticated using (true);
revoke all on public.rule_mappings from anon, authenticated;
grant select on public.rule_mappings to authenticated;
grant all on public.rule_mappings to service_role;

alter table public.rules add column if not exists possible_duplicate_of text null;
`];
const rows = pairs.filter((p) => p.n).map((p) => `  (${lit(p.o.code)}, ${lit(p.n.code)}, ${lit(p.cls === "Exact Match" ? "exact_match" : "possible_match")}, ${p.sim.toFixed(2)})`);
if (rows.length) sql.push(`insert into public.rule_mappings (old_code, new_code, classification, similarity) values\n${rows.join(",\n")}\non conflict (old_code, new_code) do nothing;\n`);
for (const [code, p] of flag)
  sql.push(`update public.rules set possible_duplicate_of = ${lit(p.o.code)} where code = ${lit(code)} and rulebook_version_id = '${RELEASE}' and review_state = 'draft';`);
fs.writeFileSync(path.join(root, "backend/supabase/migrations/20261118080700_v2_rule_mapping.sql"), sql.join("\n") + "\n");
console.log(`pairs ${pairs.length}`, counts, `flagged new drafts ${flag.size}, new-only ${newOnly.length}`);
