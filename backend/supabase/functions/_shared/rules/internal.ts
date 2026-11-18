// v2 Phase 6.7: organisation internal-policy (brand guideline) rules.
// Active rows of public.internal_rules become model-checked rule rows with code INT-*, category "internal" and no
// pack or regulatory source. They are labelled «سياسة داخلية» (citation.internal_policy) and never cite regulation.
import type { RuleRow } from "../types.ts";

export interface InternalRule {
  id: string;
  code: string;
  title_ar: string;
  instruction_ar: string;
  severity: "warning" | "violation";
  status: string;
}

/** Rule rows for the engine. The id is prefixed so persistence never treats it as a rulebook rule id. */
export function internalRuleRows(rows: InternalRule[]): RuleRow[] {
  return rows
    .filter((r) => r.status === "active" && /^INT-[A-Z0-9-]{2,24}$/.test(r.code))
    .map((r) => ({
      id: `internal:${r.id}`,
      code: r.code,
      category: "internal",
      pack: null,
      regulatory_source_id: null,
      source_status: null,
      article_ref: null,
      title_ar: r.title_ar,
      title_en: r.title_ar,
      summary_ar: r.instruction_ar,
      summary_en: null,
      check_kind: "llm",
      deterministic_check: null,
      finding_type_on_fail: "potential_risk",
      default_severity: r.severity,
      applicability: {},
      content_triggers: [],
      llm_instructions: `سياسة داخلية للمؤسسة (ليست نظاماً رقابياً): ${r.instruction_ar}`,
      review_state: "active",
    }));
}

/** A rulebook rule id (uuid) or null for internal / synthetic rules. */
export const rulebookId = (id: string): string | null => (/^[0-9a-f-]{36}$/i.test(id) ? id : null);

export interface DraftRule {
  code: string;
  title_ar: string;
  instruction_ar: string;
}

const DIRECTIVE = /(يجب|لا\s+يجوز|يُمنع|يمنع|ممنوع|لا\s+يُسمح|لا\s+يسمح|لا\s+تستخدم|لا\s+يُستخدم|ينبغي|احرص|\bmust\b|\bnever\b|\bdo not\b|\bdon't\b|\bshould\b)/i;

/**
 * Without a configured model: one draft per directive sentence of the guideline ("يجب…", "لا يجوز…", "must…").
 * Marked heuristic_draft; a person edits and approves each one before it runs.
 */
export function heuristicDrafts(text: string, max = 15): DraftRule[] {
  const sentences = text
    .split(/[\n.!؟?؛;]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 12 && s.length <= 400 && DIRECTIVE.test(s));
  const seen = new Set<string>();
  const out: DraftRule[] = [];
  for (const s of sentences) {
    if (seen.has(s) || out.length >= max) continue;
    seen.add(s);
    out.push({ code: `INT-G${String(out.length + 1).padStart(2, "0")}`, title_ar: s.slice(0, 80), instruction_ar: s });
  }
  return out;
}

/** JSON schema the model fills when drafting (strict). */
export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rules"],
  properties: {
    rules: {
      type: "array",
      maxItems: 15,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "title_ar", "instruction_ar"],
        properties: {
          code: { type: "string", description: "INT- followed by 2–24 capital letters, digits or hyphens" },
          title_ar: { type: "string" },
          instruction_ar: { type: "string", description: "What a reviewer checks in the ad, in Arabic, one sentence" },
        },
      },
    },
  },
} as const;

/** Keeps only well-formed drafts with unique INT-* codes. */
export function cleanDrafts(raw: unknown): DraftRule[] {
  const rules = (raw as { rules?: unknown })?.rules;
  if (!Array.isArray(rules)) return [];
  const seen = new Set<string>();
  const out: DraftRule[] = [];
  for (const r of rules as Record<string, unknown>[]) {
    const code = String(r["code"] ?? "").toUpperCase().trim();
    const title = String(r["title_ar"] ?? "").trim();
    const instruction = String(r["instruction_ar"] ?? "").trim();
    if (!/^INT-[A-Z0-9-]{2,24}$/.test(code) || !title || !instruction || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, title_ar: title.slice(0, 200), instruction_ar: instruction.slice(0, 2000) });
  }
  return out.slice(0, 15);
}
