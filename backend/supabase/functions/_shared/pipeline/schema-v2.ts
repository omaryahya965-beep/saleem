// Model output schema v2 (04_AI_PIPELINE §6.3) and its validator. Strict: unknown fields are rejected.
// The model never returns confirmed_mismatch (facts checks do) or not_applicable (SALEEM decides).
import type { DraftFinding, FindingType, Modality, OnScreenText, Severity } from "../types.ts";
import { SchemaError } from "./schema.ts";

export const SCHEMA_VERSION = 2;

const MODEL_TYPES = ["potential_risk", "missing_required", "needs_evidence", "unable_to_verify"] as const;
const MODALITIES = ["speech", "on_screen_text", "caption", "visual", "pdf_text"] as const;
const OUTCOMES = ["passed", "failed", "unable_to_verify"] as const;

export const ANALYSIS_SCHEMA_V2 = {
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "classification", "signals", "ocr", "rule_results", "findings"],
  properties: {
    schema_version: { type: "integer", enum: [2] },
    classification: {
      type: "object",
      additionalProperties: false,
      required: ["is_advertisement", "language", "detected_product_type"],
      properties: {
        is_advertisement: { type: "string", enum: ["yes", "no", "unclear"] },
        language: { type: "string", enum: ["ar", "en", "mixed"] },
        detected_product_type: { type: ["string", "null"] },
      },
    },
    signals: {
      type: "array",
      items: { type: "string", enum: ["banknote_or_coin_image", "real_customer_or_testimonial", "minors_targeted_or_present", "third_party_logo"] },
    },
    ocr: {
      type: "array",
      description: "Text literally visible in the attached images, with the frame time in seconds (or page).",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["t", "page", "text"],
        properties: { t: { type: ["number", "null"] }, page: { type: ["integer", "null"] }, text: { type: "string" } },
      },
    },
    rule_results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rule_code", "outcome", "reason"],
        properties: { rule_code: { type: "string" }, outcome: { type: "string", enum: OUTCOMES }, reason: { type: "string" } },
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rule_code", "finding_type", "severity", "confidence", "evidence", "explanation_ar", "explanation_en", "missing_information_ar", "suggested_fix_ar", "suggested_fix_en"],
        properties: {
          rule_code: { type: "string" },
          finding_type: { type: "string", enum: MODEL_TYPES },
          severity: { type: "string", enum: ["violation", "warning"] },
          confidence: { type: "number" },
          evidence: {
            type: "object",
            additionalProperties: false,
            required: ["modality", "quote", "t_start", "t_end", "page"],
            properties: {
              modality: { type: "string", enum: MODALITIES },
              quote: { type: "string" },
              t_start: { type: ["number", "null"] },
              t_end: { type: ["number", "null"] },
              page: { type: ["integer", "null"] },
            },
          },
          explanation_ar: { type: "string" },
          explanation_en: { type: "string" },
          missing_information_ar: { type: ["string", "null"] },
          suggested_fix_ar: { type: "string" },
          suggested_fix_en: { type: "string" },
        },
      },
    },
  },
} as const;

export interface ModelRuleResult {
  rule_code: string;
  outcome: (typeof OUTCOMES)[number];
  reason: string;
}

export interface ModelOutputV2 {
  schema_version: 2;
  classification: { is_advertisement: "yes" | "no" | "unclear"; language: "ar" | "en" | "mixed"; detected_product_type: string | null };
  signals: string[];
  ocr: { t: number | null; page: number | null; text: string }[];
  rule_results: ModelRuleResult[];
  findings: DraftFinding[];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function onlyKeys(o: Record<string, unknown>, keys: readonly string[], where: string) {
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new SchemaError(`${where}: unknown field ${k}`);
}
const s = (v: unknown, where: string) => {
  if (typeof v !== "string") throw new SchemaError(`${where} must be a string`);
  return v.trim();
};

/** Validates parsed JSON against schema v2. Clamps confidence and times; throws SchemaError otherwise. */
export function validateAnalysisV2(raw: unknown, duration: number | null): ModelOutputV2 {
  if (!isObj(raw)) throw new SchemaError("root must be an object");
  onlyKeys(raw, ANALYSIS_SCHEMA_V2.required, "root");
  if (raw.schema_version !== 2) throw new SchemaError("schema_version must be 2");
  const c = raw.classification;
  if (!isObj(c)) throw new SchemaError("classification must be an object");
  for (const k of ["signals", "ocr", "rule_results", "findings"]) if (!Array.isArray(raw[k])) throw new SchemaError(`${k} must be an array`);
  const clampT = (t: unknown): number | null => {
    if (t === null || t === undefined) return null;
    if (!isNum(t)) throw new SchemaError("timestamps must be numbers or null");
    const lo = Math.max(0, t);
    return duration && duration > 0 ? Math.min(lo, duration) : lo;
  };

  const findings: DraftFinding[] = (raw.findings as unknown[]).map((f, i) => {
    const w = `findings[${i}]`;
    if (!isObj(f)) throw new SchemaError(`${w} must be an object`);
    onlyKeys(f, ANALYSIS_SCHEMA_V2.properties.findings.items.required, w);
    if (!(MODEL_TYPES as readonly string[]).includes(f.finding_type as string)) throw new SchemaError(`${w}.finding_type invalid`);
    if (f.severity !== "violation" && f.severity !== "warning") throw new SchemaError(`${w}.severity invalid`);
    if (!isNum(f.confidence)) throw new SchemaError(`${w}.confidence must be a number`);
    const e = f.evidence;
    if (!isObj(e)) throw new SchemaError(`${w}.evidence must be an object`);
    onlyKeys(e, ["modality", "quote", "t_start", "t_end", "page"], `${w}.evidence`);
    if (!(MODALITIES as readonly string[]).includes(e.modality as string)) throw new SchemaError(`${w}.evidence.modality invalid`);
    let t_start = clampT(e.t_start);
    let t_end = clampT(e.t_end);
    if (t_start !== null && t_end !== null && t_end < t_start) [t_start, t_end] = [t_end, t_start];
    return {
      rule_code: s(f.rule_code, `${w}.rule_code`).toUpperCase(),
      finding_type: f.finding_type as FindingType,
      severity: f.severity as Severity,
      confidence: Math.max(0, Math.min(1, f.confidence)),
      source: "llm" as const,
      evidence: { modality: e.modality as Modality, quote: s(e.quote, `${w}.evidence.quote`), t_start, t_end, page: isNum(e.page) ? e.page : null },
      explanation_ar: s(f.explanation_ar, `${w}.explanation_ar`),
      explanation_en: s(f.explanation_en, `${w}.explanation_en`),
      missing_information_ar: typeof f.missing_information_ar === "string" ? f.missing_information_ar.trim() || null : null,
      suggested_fix_ar: s(f.suggested_fix_ar, `${w}.suggested_fix_ar`),
      suggested_fix_en: s(f.suggested_fix_en, `${w}.suggested_fix_en`),
    };
  });

  const rule_results: ModelRuleResult[] = (raw.rule_results as unknown[]).map((r, i) => {
    if (!isObj(r)) throw new SchemaError(`rule_results[${i}] must be an object`);
    if (!(OUTCOMES as readonly string[]).includes(r.outcome as string)) throw new SchemaError(`rule_results[${i}].outcome invalid`);
    return { rule_code: s(r.rule_code, `rule_results[${i}].rule_code`).toUpperCase(), outcome: r.outcome as ModelRuleResult["outcome"], reason: typeof r.reason === "string" ? r.reason : "" };
  });

  const ocr = (raw.ocr as unknown[])
    .filter(isObj)
    .map((o) => ({ t: clampT(o.t), page: isNum(o.page) ? o.page : null, text: typeof o.text === "string" ? o.text.trim() : "" }))
    .filter((o) => o.text.length > 0);

  return {
    schema_version: 2,
    classification: {
      is_advertisement: (["yes", "no", "unclear"].includes(c.is_advertisement as string) ? c.is_advertisement : "unclear") as ModelOutputV2["classification"]["is_advertisement"],
      language: (["ar", "en", "mixed"].includes(c.language as string) ? c.language : "mixed") as ModelOutputV2["classification"]["language"],
      detected_product_type: typeof c.detected_product_type === "string" ? c.detected_product_type : null,
    },
    signals: (raw.signals as unknown[]).filter((x): x is string => typeof x === "string"),
    ocr,
    rule_results,
    findings,
  };
}

/** On-screen text in the v1 shape (frames.ocr_text, analysis_runs.on_screen_text). */
export const ocrToOnScreen = (o: ModelOutputV2["ocr"]): OnScreenText[] =>
  o.filter((x) => x.t !== null).map((x) => ({ t: x.t as number, text: x.text }));

/** Merges per-batch outputs (frames are sent in batches of 32). */
export function mergeBatches(outputs: ModelOutputV2[]): ModelOutputV2 {
  if (outputs.length === 1) return outputs[0]!;
  const results = new Map<string, ModelRuleResult>();
  const order = { failed: 3, unable_to_verify: 2, passed: 1 } as const;
  for (const o of outputs)
    for (const r of o.rule_results) {
      const prev = results.get(r.rule_code);
      if (!prev || order[r.outcome] > order[prev.outcome]) results.set(r.rule_code, r);
    }
  return {
    schema_version: 2,
    classification: outputs[0]!.classification,
    signals: [...new Set(outputs.flatMap((o) => o.signals))],
    ocr: outputs.flatMap((o) => o.ocr),
    rule_results: [...results.values()],
    findings: outputs.flatMap((o) => o.findings),
  };
}
