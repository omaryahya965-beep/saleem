import type { IssueView } from "@/components/ui";
import type { Lang, TKey } from "@/i18n";
import type { Finding, Rule } from "@/lib/api/data";

/** Maps DB findings + rules to the localized view model used by IssueCard and the timeline. */
export function toIssueViews(
  findings: Finding[],
  rules: Map<string, Rule>,
  lang: Lang,
  frameUrls: Map<string, string> = new Map(),
): IssueView[] {
  return findings.map((f) => {
    const rule = rules.get(f.rule_code);
    const explanation =
      (lang === "en" ? f.explanation_en : f.explanation_ar) || f.explanation_ar || f.explanation_en;
    const ruleTitle = rule ? (lang === "en" ? rule.title_en : rule.title_ar) : f.rule_code;
    return {
      id: f.id,
      severity: f.severity,
      time: f.t_start === null ? null : Number(f.t_start),
      title: explanation || ruleTitle,
      ruleCode: f.rule_code,
      ruleTitle,
      sourceName: (lang === "en" ? rule?.source_name_en : null) || rule?.source_name || "",
      sourceUrl: rule?.source_url || null,
      evidenceType: f.evidence_type,
      evidence: f.evidence_text,
      frameUrl: f.evidence_frame_id ? (frameUrls.get(f.evidence_frame_id) ?? null) : null,
      fix: ((lang === "en" ? f.fix_en : f.fix_ar) || f.fix_ar || f.fix_en) ?? "",
    };
  });
}

/** Timed issues first (by time), then whole-clip issues; violations before warnings at equal time. */
export function sortIssues(issues: IssueView[]): IssueView[] {
  return [...issues].sort((a, b) => {
    if (a.time === null && b.time !== null) return 1;
    if (b.time === null && a.time !== null) return -1;
    if (a.time !== b.time) return (a.time ?? 0) - (b.time ?? 0);
    return a.severity === b.severity ? 0 : a.severity === "violation" ? -1 : 1;
  });
}

export function countBySeverity(findings: { severity: string }[]) {
  return {
    violations: findings.filter((f) => f.severity === "violation").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
  };
}

/** Rule codes present in the parent but absent in the current run = fixed. */
export function diffFindings(previous: Finding[], current: Finding[]) {
  const now = new Set(current.map((f) => f.rule_code));
  const before = new Set(previous.map((f) => f.rule_code));
  const seen = new Set<string>();
  const fixed = previous.filter(
    (f) => !now.has(f.rule_code) && !seen.has(f.rule_code) && seen.add(f.rule_code),
  );
  const stillOpen = current.filter((f) => before.has(f.rule_code));
  return { fixed, stillOpen };
}

/** Human-readable verification ID derived from the submission UUID: SLM-XXXX-XXXX-XXXX. */
export function verificationId(id: string): string {
  const hex = id.replace(/-/g, "").toUpperCase();
  return `SLM-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return hash.length > 20 ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : hash;
}

/**
 * Translates a stored pipeline error. New errors are stored as `code:<key>` tokens
 * (see backend/supabase/functions/_shared/providers/errors.ts); older rows hold plain text.
 */
export function pipelineErrorText(message: string, t: (key: TKey) => string): string {
  if (!message.startsWith("code:")) return message;
  const key = `pipelineErrors.${message.slice(5)}` as TKey;
  const text = t(key);
  return text === key ? t("pipelineErrors.pipeline_unexpected") : text;
}
