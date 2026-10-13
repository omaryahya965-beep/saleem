// supabase/functions/_shared/pipeline/merge.ts

import type { Finding, OverallStatus } from "../types.ts";

export function mergeAndFilterFindings(
  findings: Finding[],
  validRuleCodes: Set<string>
): { mergedFindings: Finding[]; overallStatus: OverallStatus } {
  // 1. Drop findings with unknown rule codes
  const filtered = findings.filter((f) => {
    if (!validRuleCodes.has(f.rule_code)) {
      console.warn(`[Merge] Dropping finding with unknown rule code: ${f.rule_code}`);
      return false;
    }
    return true;
  });

  // 2. Downgrade weak evidence (< 0.70 confidence) to "warning"
  const calibrated = filtered.map((f) => {
    if (f.confidence < 0.7 && f.severity === "violation") {
      return {
        ...f,
        severity: "warning" as const,
        explanation_ar: `${f.explanation_ar} (تنبيه استرشادي نظراً لانخفاض درجة التأكيد)`,
      };
    }
    return f;
  });

  // 3. Deduplicate findings matching same rule within 3-second window
  const mergedFindings: Finding[] = [];

  for (const candidate of calibrated) {
    const existingIndex = mergedFindings.findIndex((existing) => {
      if (existing.rule_code !== candidate.rule_code) return false;
      // If neither has timestamps (metadata checks)
      if (existing.t_start === null && candidate.t_start === null) return true;
      // If both have timestamps, check 3s window overlap
      if (existing.t_start !== null && candidate.t_start !== null) {
        return Math.abs(existing.t_start - candidate.t_start) <= 3.0;
      }
      return false;
    });

    if (existingIndex >= 0) {
      // Overwrite if candidate has higher confidence
      if (candidate.confidence > mergedFindings[existingIndex].confidence) {
        mergedFindings[existingIndex] = candidate;
      }
    } else {
      mergedFindings.push(candidate);
    }
  }

  // 4. Calculate overall status
  let overallStatus: OverallStatus = "ready";
  const hasViolation = mergedFindings.some((f) => f.severity === "violation");
  const hasWarning = mergedFindings.some((f) => f.severity === "warning");

  if (hasViolation) {
    overallStatus = "needs_fixes";
  } else if (hasWarning) {
    overallStatus = "review";
  }

  return { mergedFindings, overallStatus };
}
