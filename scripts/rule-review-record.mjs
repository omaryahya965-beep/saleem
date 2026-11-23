// Per-rule review record for every rule of the active rulebook that is not active (D219). READ-ONLY: one SELECT
// on the isolated stack's database (container supabase_db_saleem_iso), plus the official-URL reachability check of
// 2026-11-21 (docs/saleem-v2/data/source_url_check.json). Nothing is activated, verified or changed: activation
// needs a qualified legal reviewer (hard rule 2.1). Writes:
//   docs/saleem-v2/data/rule_review_record.csv   one row per rule with its evidence and blockers
//   docs/saleem-v2/legal/RULE_REVIEW_RECORD.md   counts per authority and blocker
//
//   node scripts/rule-review-record.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SQL = `
copy (
  select r.code, coalesce(p.authority, '') as authority, r.review_state, r.title_ar, r.article_ref,
    coalesce(s.id::text, '') as source_id, coalesce(s.title_ar, r.source_name, '') as source_title,
    coalesce(s.url, r.source_url, '') as source_url, coalesce(s.verification, '') as source_verification,
    coalesce(s.status, '') as source_status, r.source_verified,
    (coalesce(r.official_text_ar, '') <> '') as has_official_text,
    (coalesce(r.applicability_ar, '') <> '') as has_applicability,
    coalesce(r.possible_duplicate_of, '') as possible_duplicate_of,
    coalesce(r.check_kind, '') as check_kind, coalesce(r.check_mode, '') as check_mode,
    (r.deterministic_check is not null) as has_deterministic_check,
    coalesce(r.legal_reviewed_by::text, '') as legal_reviewed_by,
    coalesce(r.csv_activation_status, '') as csv_activation_status
  from rules r
  join rulebook_versions v on v.id = r.rulebook_version_id
  left join rule_packs p on p.code = r.pack
  left join regulatory_sources s on s.id = r.regulatory_source_id
  where v.id = (select id from rulebook_versions order by created_at desc limit 1)
  order by 2, 1
) to stdout with csv header`;

const csv = execFileSync(
  "docker",
  [
    "exec",
    "supabase_db_saleem_iso",
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    SQL,
  ],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);

// Minimal CSV parser (quoted fields, doubled quotes, newlines inside quotes).
function parse(text) {
  const rows = [];
  let row = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') ((f += '"'), i++);
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") (row.push(f), (f = ""));
    else if (c === "\n") (row.push(f), rows.push(row), (row = []), (f = ""));
    else if (c !== "\r") f += c;
  }
  if (f || row.length) (row.push(f), rows.push(row));
  const [head, ...body] = rows;
  return body.map((r) =>
    Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])),
  );
}

const all = parse(csv);
const reach = JSON.parse(
  readFileSync("docs/saleem-v2/data/source_url_check.json", "utf8"),
);
const urlStatus = new Map(
  reach.results.map((r) => [
    r.url,
    r.status === 200 ? "reachable" : "unreachable",
  ]),
);

const BLOCKERS = {
  source_unconfirmed:
    "Official status of the source not confirmed (not opened as an in-force official text)",
  source_unreachable:
    "Official URL not reachable from the development machine on 2026-11-21",
  no_official_text: "Exact Arabic legal text of the provision not recorded",
  no_applicability:
    "Applicability (when the rule applies, exceptions) not written",
  possible_duplicate:
    "Possible duplicate of another rule — merge or keep decision needed",
  workflow_only:
    "Procedural requirement (licence, prior approval) — not decidable from the ad content alone",
  legal_signoff: "No qualified legal reviewer sign-off recorded",
};

const pending = all.filter(
  (r) => r.review_state !== "active" && r.review_state !== "archived",
);
const out = pending.map((r) => {
  const b = [];
  if (r.source_verification !== "official_text_opened")
    b.push("source_unconfirmed");
  if (r.source_url && urlStatus.get(r.source_url) === "unreachable")
    b.push("source_unreachable");
  if (r.has_official_text !== "t") b.push("no_official_text");
  if (r.has_applicability !== "t") b.push("no_applicability");
  if (r.possible_duplicate_of) b.push("possible_duplicate");
  if (r.check_kind === "workflow") b.push("workflow_only");
  if (!r.legal_reviewed_by) b.push("legal_signoff");
  const evidenceOnly = b.every(
    (x) => x === "legal_signoff" || x === "workflow_only",
  );
  return {
    ...r,
    url_reachability: r.source_url
      ? (urlStatus.get(r.source_url) ?? "not_checked")
      : "no_url",
    blockers: b.join(";"),
    readiness: evidenceOnly ? "ready_for_legal_signoff" : "evidence_incomplete",
  };
});

const cols = [
  "code",
  "authority",
  "review_state",
  "title_ar",
  "article_ref",
  "source_title",
  "source_url",
  "source_verification",
  "source_status",
  "url_reachability",
  "has_official_text",
  "has_applicability",
  "possible_duplicate_of",
  "check_kind",
  "has_deterministic_check",
  "csv_activation_status",
  "readiness",
  "blockers",
];
const esc = (v) =>
  /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
writeFileSync(
  "docs/saleem-v2/data/rule_review_record.csv",
  "﻿" +
    [
      cols.join(","),
      ...out.map((r) => cols.map((c) => esc(r[c])).join(",")),
    ].join("\n") +
    "\n",
);

// Summary.
const by = (rows, key) =>
  rows.reduce(
    (m, r) => (m.set(r[key], (m.get(r[key]) ?? 0) + 1), m),
    new Map(),
  );
const count = (k) =>
  out.filter((r) => r.blockers.split(";").includes(k)).length;
const auth = [...new Set(out.map((r) => r.authority))].sort();
const active = all.filter((r) => r.review_state === "active").length;
const archived = all.filter((r) => r.review_state === "archived").length;
const lines = [
  "# Rule review record (D219)",
  "",
  `Generated by \`node scripts/rule-review-record.mjs\` from the isolated stack's active rulebook (read-only), with`,
  `the official-URL reachability check of ${reach.checked_on}. Per-rule evidence and blockers:`,
  "[`data/rule_review_record.csv`](../data/rule_review_record.csv).",
  "",
  "**No rule was activated or marked verified by this work.** Activation needs a qualified legal reviewer",
  "(master prompt, hard rule 2.1); this record is the evidence they start from.",
  "",
  "## Totals",
  "",
  `- Rules in the active rulebook: ${all.length}`,
  `- Active (applied in automatic analysis): ${active}`,
  `- Archived: ${archived}`,
  `- Not active yet (this record): ${out.length}`,
  `  - Ready for legal sign-off (evidence complete except the sign-off itself): ${out.filter((r) => r.readiness === "ready_for_legal_signoff").length}`,
  `  - Evidence incomplete: ${out.filter((r) => r.readiness === "evidence_incomplete").length}`,
  "",
  "## Blockers (a rule can have several)",
  "",
  "| Blocker | Rules |",
  "| --- | ---: |",
  ...Object.entries(BLOCKERS).map(([k, v]) => `| ${v} | ${count(k)} |`),
  "",
  "## Per authority",
  "",
  "| Authority | Not active | Source opened & in force | Source unconfirmed | Possible duplicates | Procedural only |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...auth.map((a) => {
    const rs = out.filter((r) => r.authority === a);
    const n = (f) => rs.filter(f).length;
    return `| ${a} | ${rs.length} | ${n((r) => r.source_verification === "official_text_opened")} | ${n((r) => r.source_verification !== "official_text_opened")} | ${n((r) => r.possible_duplicate_of)} | ${n((r) => r.check_kind === "workflow")} |`;
  }),
  "",
  "## What the rulebook shows",
  "",
  "- «سارية» (active): `review_state = active` — the only rules an analysis applies.",
  "- «تحتاج مراجعة» (needs review): a draft whose official source was opened and is in force, or `pending_review`.",
  "- «قيد التحقق» (being verified): any other draft.",
  "",
  "## How a rule becomes active",
  "",
  "1. Confirm the official source is current and in force; record the exact article and its Arabic text.",
  "2. Write the applicability and exceptions; resolve the possible duplicate.",
  "3. Check that the technical check works (rule fixtures in `backend/tests`, deterministic eval).",
  "4. A platform admin records the qualified legal reviewer's sign-off with",
  "   `set_rule_review_state(rule, 'active', reason, official_text_ar, reviewer)`. The database refuses activation",
  "   without the official Arabic text and a named reviewer (constraint `rules_active_needs_review`).",
  "",
  `Status counts by state: ${[...by(all, "review_state")].map(([k, v]) => `${k} ${v}`).join(", ")}.`,
  "",
];
writeFileSync("docs/saleem-v2/legal/RULE_REVIEW_RECORD.md", lines.join("\n"));
console.log(
  JSON.stringify({
    total: all.length,
    active,
    archived,
    pending: out.length,
    ready: out.filter((r) => r.readiness === "ready_for_legal_signoff").length,
    blockers: Object.fromEntries(
      Object.keys(BLOCKERS).map((k) => [k, count(k)]),
    ),
  }),
);
