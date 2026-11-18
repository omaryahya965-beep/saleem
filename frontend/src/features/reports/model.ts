import type { IssueView } from "@/components/ui";
import type { Lang, TKey } from "@/i18n";
import type { Finding, RegulatorySource, Rule, RuleCheck } from "@/lib/api/data";

/** Maps DB findings + rules to the localized view model used by IssueCard and the timeline. */
export function toIssueViews(
  findings: Finding[],
  rules: Map<string, Rule>,
  lang: Lang,
  frameUrls: Map<string, string> = new Map(),
  v2?: {
    rulesById: Map<string, Rule>;
    sources: Map<string, RegulatorySource>;
    previousVersionNo?: number | null;
  },
): IssueView[] {
  return findings.map((f) => {
    const rule = (f.rule_id && v2?.rulesById.get(f.rule_id)) || rules.get(f.rule_code);
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
      ...(v2 ? { v2: issueV2(f, rule, v2) } : {}),
    };
  });
}

function issueV2(
  f: Finding,
  rule: Rule | undefined,
  v2: { sources: Map<string, RegulatorySource>; previousVersionNo?: number | null },
): IssueView["v2"] {
  const citation = (f.citation ?? {}) as {
    article_ref?: string | null;
    source_id?: string | null;
    pack?: string | null;
    internal_policy?: boolean;
  };
  const sourceId = citation.source_id ?? rule?.regulatory_source_id ?? null;
  const pack = citation.pack ?? rule?.pack ?? null;
  return {
    findingType: f.finding_type,
    draftRule: f.rule_draft,
    internalPolicy: citation.internal_policy === true || f.rule_code.startsWith("INT-"),
    articleRef: citation.article_ref ?? rule?.article_ref ?? null,
    verification:
      pack === "sa-system"
        ? "internal"
        : sourceId
          ? (v2.sources.get(sourceId)?.verification ?? null)
          : null,
    missingInformation: f.missing_information_ar,
    carriedFromVersion: f.carried_from_finding_id ? (v2.previousVersionNo ?? null) : null,
  };
}

/** i18n key for a rule-check reason code (e.g. "context:product_type" → report2.reason.context_product_type). */
export function reasonKey(reason: string | null): { key: TKey; signal?: string } {
  if (!reason) return { key: "report2.reason.unknown" };
  if (reason.startsWith("trigger_absent:"))
    return { key: "report2.reason.trigger_absent", signal: reason.slice(15) };
  return { key: `report2.reason.${reason.replace(/:/g, "_")}` as TKey };
}

export interface CoverageView {
  status: "complete" | "partial";
  items: { modality: string; state: string }[];
}

/** Coverage items that explain a partial result (failed or missing modalities). */
export function coverageGaps(c: CoverageView | null): CoverageView["items"] {
  if (!c) return [];
  const bad =
    /^(transcription_failed|failed|invalid|batch_failed|pack_not_available|draft_product)/;
  return c.items.filter(
    (i) => bad.test(i.state) || (i.modality === "frames" && /^analyzed:0\//.test(i.state)),
  );
}

export function outcomeCounts(checks: Pick<RuleCheck, "outcome">[]) {
  const out = { passed: 0, failed: 0, not_applicable: 0, unable_to_verify: 0 };
  for (const c of checks) if (c.outcome in out) out[c.outcome as keyof typeof out]++;
  return out;
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

/** A queued check with no worker heartbeat after this long most likely never started. */
export const START_STALL_MS = 30_000;

/**
 * True when the analysis did not start: the start request failed in this session, or the check is
 * still `queued` with no heartbeat more than 30 s after it was created.
 */
export function analysisStartStalled(
  sub: { status: string; heartbeat_at: string | null; created_at: string },
  nowMs: number,
  requestFailed: boolean,
): boolean {
  if (sub.status !== "queued" || sub.heartbeat_at) return false;
  return requestFailed || nowMs - new Date(sub.created_at).getTime() > START_STALL_MS;
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
