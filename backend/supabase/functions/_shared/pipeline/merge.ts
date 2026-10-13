// Merges deterministic and model findings into the final report.

import type { Finding, OverallStatus } from "../types.ts";

/** Below this confidence a "violation" is shown as a "warning" (weak evidence). */
export const WEAK_EVIDENCE_THRESHOLD = 0.7;
/** Findings of the same rule within this many seconds are the same issue. */
export const DEDUPE_WINDOW_S = 3;
/** Rules that describe the whole post (disclosure, licensing, contract): at most one finding each. */
export const WHOLE_POST_RULES = new Set(["MAW-01", "MAW-02", "MAW-03", "MAW-04", "AI-01"]);

export interface MergeResult {
  mergedFindings: Finding[];
  overallStatus: OverallStatus;
  dropped: { unknownRule: string[]; duplicates: number; downgraded: number };
}

export function overallStatusOf(findings: Pick<Finding, "severity">[]): OverallStatus {
  if (findings.some((f) => f.severity === "violation")) return "needs_fixes";
  if (findings.some((f) => f.severity === "warning")) return "review";
  return "ready";
}

export function mergeAndFilterFindings(findings: Finding[], validRuleCodes: Set<string>): MergeResult {
  const unknownRule: string[] = [];
  let downgraded = 0;
  let duplicates = 0;

  // 1. Drop unknown rule codes (the model must not invent rules).
  const known = findings.filter((f) => {
    if (validRuleCodes.has(f.rule_code)) return true;
    unknownRule.push(f.rule_code);
    return false;
  });

  // 2. Weak evidence → warning.
  const calibrated = known.map((f) => {
    if (f.severity === "violation" && f.confidence < WEAK_EVIDENCE_THRESHOLD) {
      downgraded++;
      return { ...f, severity: "warning" as const };
    }
    return f;
  });

  // 3. Dedupe same rule within 3 s (or both untimed); keep the stronger one —
  //    violation beats warning, then higher confidence, then deterministic (explainable).
  //    For whole-post rules the deterministic finding wins (its evidence and window are exact).
  const rank = (f: Finding) =>
    (f.severity === "violation" ? 2 : 0) +
    f.confidence +
    (f.source === "deterministic" ? (WHOLE_POST_RULES.has(f.rule_code) ? 1 : 0.001) : 0);
  const merged: Finding[] = [];
  for (const c of calibrated) {
    const i = merged.findIndex(
      (e) =>
        e.rule_code === c.rule_code &&
        (WHOLE_POST_RULES.has(c.rule_code) ||
          (e.t_start === null && c.t_start === null) ||
          (e.t_start !== null && c.t_start !== null && Math.abs(e.t_start - c.t_start) <= DEDUPE_WINDOW_S)),
    );
    if (i < 0) {
      merged.push(c);
      continue;
    }
    duplicates++;
    if (rank(c) > rank(merged[i]!)) merged[i] = c;
  }

  merged.sort((a, b) => (a.t_start ?? Infinity) - (b.t_start ?? Infinity));
  return { mergedFindings: merged, overallStatus: overallStatusOf(merged), dropped: { unknownRule, duplicates, downgraded } };
}
