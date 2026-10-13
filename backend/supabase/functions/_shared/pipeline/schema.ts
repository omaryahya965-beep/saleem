// JSON schema for the vision/reasoning model output, and a dependency-free validator.
// The schema is sent as OpenAI Structured Outputs (strict); we still validate server-side
// because providers can drift and we never trust model output blindly.

import type { EvidenceType, Finding, OnScreenText, Severity } from "../types.ts";

export const PROMPT_VERSION = "v3-2026-10";

export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["on_screen_text", "findings"],
  properties: {
    on_screen_text: {
      type: "array",
      description: "Readable text overlaid on or visible in frames, with the frame timestamp.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["t", "text"],
        properties: { t: { type: "number" }, text: { type: "string" } },
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "rule_code",
          "severity",
          "t_start",
          "t_end",
          "evidence_type",
          "evidence_text",
          "explanation_ar",
          "explanation_en",
          "fix_ar",
          "fix_en",
          "confidence",
        ],
        properties: {
          rule_code: { type: "string" },
          severity: { type: "string", enum: ["violation", "warning"] },
          t_start: { type: ["number", "null"] },
          t_end: { type: ["number", "null"] },
          evidence_type: { type: "string", enum: ["transcript", "frame", "caption", "metadata"] },
          evidence_text: { type: "string" },
          explanation_ar: { type: "string" },
          explanation_en: { type: "string" },
          fix_ar: { type: "string" },
          fix_en: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
  },
} as const;

export interface AnalysisOutput {
  on_screen_text: OnScreenText[];
  findings: Finding[];
}

export class SchemaError extends Error {}

const SEVERITIES: Severity[] = ["violation", "warning"];
const EVIDENCE: EvidenceType[] = ["transcript", "frame", "caption", "metadata"];

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function str(v: unknown, field: string, i: number): string {
  if (typeof v !== "string") throw new SchemaError(`findings[${i}].${field} must be a string`);
  return v.trim();
}

/**
 * Validates parsed JSON against ANALYSIS_SCHEMA. Throws SchemaError on structural problems.
 * Clamps confidence to [0,1] and times to [0, duration]; swaps reversed time ranges.
 */
export function validateAnalysis(raw: unknown, duration: number | null): AnalysisOutput {
  if (!raw || typeof raw !== "object") throw new SchemaError("root must be an object");
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.findings)) throw new SchemaError("findings must be an array");
  if (!Array.isArray(obj.on_screen_text)) throw new SchemaError("on_screen_text must be an array");

  const clampT = (t: unknown): number | null => {
    if (t === null || t === undefined) return null;
    if (!isNum(t)) throw new SchemaError("timestamps must be numbers or null");
    const lo = Math.max(0, t);
    return duration && duration > 0 ? Math.min(lo, duration) : lo;
  };

  const findings: Finding[] = obj.findings.map((f, i) => {
    if (!f || typeof f !== "object") throw new SchemaError(`findings[${i}] must be an object`);
    const r = f as Record<string, unknown>;
    if (!SEVERITIES.includes(r.severity as Severity)) throw new SchemaError(`findings[${i}].severity invalid`);
    if (!EVIDENCE.includes(r.evidence_type as EvidenceType)) throw new SchemaError(`findings[${i}].evidence_type invalid`);
    if (!isNum(r.confidence)) throw new SchemaError(`findings[${i}].confidence must be a number`);
    let t_start = clampT(r.t_start);
    let t_end = clampT(r.t_end);
    if (t_start !== null && t_end !== null && t_end < t_start) [t_start, t_end] = [t_end, t_start];
    const evidence = str(r.evidence_text, "evidence_text", i);
    return {
      rule_code: str(r.rule_code, "rule_code", i).toUpperCase(),
      severity: r.severity as Severity,
      t_start,
      t_end,
      evidence_type: r.evidence_type as EvidenceType,
      evidence_text: evidence || null,
      evidence_frame_t: r.evidence_type === "frame" ? t_start : null,
      explanation_ar: str(r.explanation_ar, "explanation_ar", i),
      explanation_en: str(r.explanation_en, "explanation_en", i),
      fix_ar: str(r.fix_ar, "fix_ar", i),
      fix_en: str(r.fix_en, "fix_en", i),
      confidence: Math.max(0, Math.min(1, r.confidence)),
      source: "llm" as const,
    };
  });

  const on_screen_text: OnScreenText[] = obj.on_screen_text
    .filter((o): o is { t: number; text: string } => !!o && typeof o === "object" && isNum((o as { t: unknown }).t) && typeof (o as { text: unknown }).text === "string")
    .map((o) => ({ t: clampT(o.t) ?? 0, text: o.text.trim() }))
    .filter((o) => o.text.length > 0);

  return { findings, on_screen_text };
}

/** Parses model text into JSON, tolerating code fences. */
export function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new SchemaError("model output is not valid JSON");
  }
}
