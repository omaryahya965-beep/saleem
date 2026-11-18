// Offline copy of the 2026.11-v2 release, read from the SQL files the database uses:
// legacy rules from supabase/seed.sql, new rules from the RULES-BEGIN/END block of the M3 migration.
// Used by unit tests and `npm run eval -- --deterministic-only --offline` (no network).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Applicability, RuleRow } from "../supabase/functions/_shared/types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const M3 = path.resolve(here, "../supabase/migrations/20261117020100_v2_rules_sources_packs.sql");
const SEED = path.resolve(here, "../supabase/seed.sql");

const COMMON: Applicability = { sectors: ["banking", "finance_company", "payments"], communication_types: ["financial_promotion"] };
const SOURCE_STATUS: Record<string, string> = {
  "sama-adv-rules-2023": "in_force", "cma-cmi-regs": "in_force", "mc-ecommerce-law": "in_force",
  "gmedia-mawthooq": "in_force", "sdaia-deepfakes": "guideline",
};

/** Parses one SQL tuple line `('a', null, 'it''s', ...)` into string|null values. */
export function parseTuple(line: string): (string | null)[] {
  const s = line.trim().replace(/^\(/, "").replace(/\)\s*,?\s*$/, "");
  const out: (string | null)[] = [];
  let i = 0;
  while (i < s.length) {
    while (s[i] === " " || s[i] === ",") i++;
    if (s[i] === "'") {
      let v = "";
      i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        v += s[i++];
      }
      out.push(v);
    } else {
      const end = s.indexOf(",", i);
      const tok = s.slice(i, end === -1 ? undefined : end).trim();
      out.push(tok === "null" ? null : tok);
      i = end === -1 ? s.length : end;
    }
    while (i < s.length && s[i] !== ",") i++;
  }
  return out;
}

const arr = (pg: string | null) => (pg && pg !== "{}" ? pg.replace(/^\{|\}$/g, "").split(",").map((x) => x.trim()) : []);

function applicabilityOf(raw: string): Applicability {
  if (raw === "COMMON") return { ...COMMON };
  if (raw.startsWith("COMMON+")) return { ...COMMON, ...(JSON.parse(raw.slice(7)) as Applicability) };
  return JSON.parse(raw) as Applicability;
}

export function newRules(): RuleRow[] {
  const sql = fs.readFileSync(M3, "utf8");
  const block = sql.slice(sql.indexOf("-- RULES-BEGIN"), sql.indexOf("-- RULES-END"));
  return block
    .split(/\r?\n/)
    .filter((l) => l.startsWith("('"))
    .map((l) => {
      const [code, category, pack, source, article, titleAr, titleEn, sumAr, sumEn, kind, , det, ftype, sev, app, trig, instr, state] = parseTuple(l);
      return {
        id: `rule:${code}`, code: code!, category: category!, pack, regulatory_source_id: source,
        source_status: source ? SOURCE_STATUS[source] ?? "unknown" : null, article_ref: article,
        title_ar: titleAr!, title_en: titleEn!, summary_ar: sumAr, summary_en: sumEn,
        check_kind: kind as RuleRow["check_kind"], deterministic_check: det, finding_type_on_fail: ftype as RuleRow["finding_type_on_fail"],
        default_severity: sev as RuleRow["default_severity"], applicability: applicabilityOf(app!), content_triggers: arr(trig),
        llm_instructions: instr!, review_state: state as RuleRow["review_state"],
      };
    });
}

export function legacyRules(): RuleRow[] {
  const sql = fs.readFileSync(SEED, "utf8");
  const start = sql.indexOf("insert into public.rules");
  const end = sql.indexOf("on conflict", start);
  return sql
    .slice(start, end)
    .split(/\r?\n/)
    .filter((l) => l.startsWith("('"))
    .map((l) => {
      const [code, , category, titleAr, titleEn, descAr, descEn, , , , , sev, instr] = parseTuple(l);
      const pack = code!.startsWith("MAW-") || code!.startsWith("CNT-") ? "sa-gmedia-creators" : code === "AI-01" ? "sa-sdaia-ai" : "sa-mc-ecommerce";
      const source = code!.startsWith("MAW-") ? "gmedia-mawthooq" : code === "AI-01" ? "sdaia-deepfakes" : code === "COM-01" ? "mc-ecommerce-law" : null;
      return {
        id: `rule:${code}`, code: code!, category: category!, pack, regulatory_source_id: source,
        source_status: source ? SOURCE_STATUS[source] ?? null : null, article_ref: null, title_ar: titleAr!, title_en: titleEn!,
        summary_ar: descAr, summary_en: descEn, check_kind: "hybrid", deterministic_check: null, finding_type_on_fail: null,
        default_severity: sev as RuleRow["default_severity"],
        applicability: code!.startsWith("MAW-") ? { any_of: [{ communication_types: ["creator_sponsored", "general_commercial"] }, { distribution: ["influencer"] }] } : {},
        content_triggers: [], llm_instructions: instr!, review_state: "active",
      };
    });
}

/** The full v2 release as the database builds it (legacy + new). */
export const releaseRules = (): RuleRow[] => [...legacyRules(), ...newRules()];
