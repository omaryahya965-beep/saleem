// Rule engine v2, pure and testable end to end (04_AI_PIPELINE §2, §5–10). The analyze function
// gathers the inputs (context, release rules, extracted texts, model output) and persists the result.
import type {
  AnalysisContext, DraftFinding, ExtractedText, Finding, FindingType, OnScreenText, OverallStatus, RuleOutcome, RuleRow,
  Severity, SubmissionData, TranscriptSegment,
} from "../types.ts";
import { normalizeArabic } from "../rules/arabic.ts";
import { applyOverrides, applyTriggers, selectRules, type NotApplicable, type RuleOverride } from "../rules/applicability.ts";
import { detectContentSectors } from "../rules/sectors.ts";
import { checkDisclaimers, matchClaims, type LibClaim, type LibDisclaimer } from "../claims/match.ts";
import { CHECKS, type CheckResult } from "../rules/checks/index.ts";
import { computeSignals } from "../rules/signals.ts";
import { checkProductFacts, type FactsStatus } from "../rules/productFacts.ts";
import { runDeterministicChecks } from "../rules/deterministic.ts";
import type { AudioMode } from "../rules/speech.ts";
import type { ModelOutputV2 } from "./schema-v2.ts";
import { DEDUPE_WINDOW_S, WEAK_EVIDENCE_THRESHOLD, WHOLE_POST_RULES } from "./merge.ts";

export const ENGINE_VERSION = "v2";
/** Packs whose rules keep the v1 merge semantics (dedupe per rule within 3 s). */
const LEGACY_PACKS = new Set(["sa-gmedia-creators", "sa-sdaia-ai", "sa-mc-ecommerce"]);
/** Rules whose product-facts part needs an approved product. */
const FACT_RULES = new Set(["SAMA-ADV-03-5", "SAMA-ADV-03-8"]);

export interface CoverageItem {
  modality: "caption" | "audio" | "frames" | "on_screen_text" | "product_facts" | "model" | "rule_packs" | "pdf_pages";
  state: string;
}
export interface Coverage {
  status: "complete" | "partial";
  items: CoverageItem[];
  /** Packs applied to this run and why, with how many of their rules were applicable (report: «الحزم المطبّقة ولماذا»). */
  packs?: PackApplied[];
}
export interface PackApplied {
  code: string;
  reason: string;
  include_drafts: boolean;
  applicable: number;
  not_applicable: number;
}

export interface EvaluateInput {
  ctx: AnalysisContext;
  rules: RuleRow[];
  texts: ExtractedText[];
  /** Inputs of the v1 deterministic checks for the creator rules (kept as is). */
  legacy: { submission: SubmissionData; segments: TranscriptSegment[]; onScreen: OnScreenText[]; audioMode: AudioMode | null };
  model: ModelOutputV2 | null;
  modelStatus: "ok" | "invalid" | "failed";
  /** Org libraries (Phase 5): claims, disclaimers, claims linked to the promotion, rule overrides. */
  library?: { claims: LibClaim[]; disclaimers: LibDisclaimer[]; linkedClaimIds: string[]; overrides: RuleOverride[] };
  media: {
    transcriptionFailed: boolean;
    framesTotal: number;
    framesAnalyzed: number;
    batchesFailed: number;
    /** PDF: pages, pages with a text layer, pages read only by the model, pages with no readable text. */
    pdf?: { total: number; textLayer: number; ocrOnly: number; unreadable: number };
  };
}

export interface MergedFinding extends DraftFinding {
  rule_id: string;
  rule_draft: boolean;
  citation: Record<string, unknown>;
}

export interface RuleCheckResult {
  rule_id: string;
  rule_code: string;
  outcome: RuleOutcome;
  reason: string | null;
  /** Indexes into `findings`. */
  finding_indexes: number[];
}

export interface EvaluateResult {
  findings: MergedFinding[];
  ruleChecks: RuleCheckResult[];
  /** D213: sectors detected in the content (personal advertisements). */
  contentSectors?: string[];
  coverage: Coverage;
  overallStatus: OverallStatus;
  signals: string[];
  dropped: { unknownRule: string[]; duplicates: number; downgraded: number; superseded: number };
}

/** Finding type for v1 deterministic findings of the creator rules (never guessed for stored legacy rows). */
export function legacyFindingType(code: string): FindingType {
  if (code === "MAW-01" || code === "AI-01") return "missing_required";
  if (code === "MAW-02" || code === "MAW-03" || code === "MAW-04") return "needs_evidence";
  return "potential_risk";
}

const MODALITY_OF: Record<Finding["evidence_type"], DraftFinding["evidence"]["modality"]> = {
  transcript: "speech", frame: "on_screen_text", caption: "caption", metadata: "metadata",
};

function fromLegacy(f: Finding): DraftFinding {
  return {
    rule_code: f.rule_code, finding_type: legacyFindingType(f.rule_code), severity: f.severity, confidence: f.confidence, source: "deterministic",
    evidence: { modality: MODALITY_OF[f.evidence_type], quote: f.evidence_text ?? "", t_start: f.t_start, t_end: f.t_end },
    explanation_ar: f.explanation_ar, explanation_en: f.explanation_en, suggested_fix_ar: f.fix_ar, suggested_fix_en: f.fix_en,
  };
}

const quoteKey = (f: DraftFinding) => normalizeArabic(f.evidence.quote ?? "").slice(0, 120);

/** Same issue: same rule and type, and (both untimed with the same quote, or starts within 3 s). */
function sameIssue(a: DraftFinding, b: DraftFinding, legacy: boolean): boolean {
  if (a.rule_code !== b.rule_code) return false;
  if (legacy) {
    if (WHOLE_POST_RULES.has(a.rule_code)) return true;
    if (a.evidence.t_start === null && b.evidence.t_start === null) return true;
    return a.evidence.t_start !== null && b.evidence.t_start !== null && Math.abs(a.evidence.t_start - b.evidence.t_start) <= DEDUPE_WINDOW_S;
  }
  if (a.finding_type !== b.finding_type) return false;
  if (a.source === "facts" || b.source === "facts") return a.source === b.source && JSON.stringify(a.values) === JSON.stringify(b.values);
  if (a.evidence.t_start !== null && b.evidence.t_start !== null) return Math.abs(a.evidence.t_start - b.evidence.t_start) <= DEDUPE_WINDOW_S;
  return a.evidence.t_start === null && b.evidence.t_start === null && (quoteKey(a) === quoteKey(b) || a.source === "deterministic" || b.source === "deterministic");
}

const rank = (f: DraftFinding) =>
  (f.finding_type === "confirmed_mismatch" ? 4 : 0) + (f.severity === "violation" ? 2 : 0) + f.confidence + (f.source === "deterministic" ? 0.5 : 0);

export function evaluate(input: EvaluateInput): EvaluateResult {
  const { texts, model } = input;
  // D213: a personal advertisement is also checked against the rules of every sector its content points to, so the
  // selected sector cannot hide applicable rules. Organisations keep their configured context.
  const ctx = input.ctx.orgId
    ? input.ctx
    : { ...input.ctx, contentSectors: [...new Set([...(input.ctx.contentSectors ?? []), ...detectContentSectors(texts)])] };
  const modelOk = input.modelStatus === "ok" && model !== null;
  const signals = computeSignals(texts, ctx, modelOk ? model!.signals : []);
  const lib = input.library ?? { claims: [], disclaimers: [], linkedClaimIds: [], overrides: [] };
  const base = applyOverrides(applyTriggers(selectRules(ctx, input.rules), signals), ctx, lib.overrides);
  // Library checks run only when the organisation has a library (SYS-CLAIMS needs approved claims).
  const hasClaims = lib.claims.some((c) => c.status === "approved");
  const hasDisclaimers = lib.disclaimers.length > 0;
  const selection = {
    applicable: base.applicable.filter((r) => (r.code !== "SYS-CLAIMS" || hasClaims) && (r.code !== "SYS-DISCLAIMERS" || hasDisclaimers)),
    notApplicable: [
      ...base.notApplicable,
      ...base.applicable
        .filter((r) => (r.code === "SYS-CLAIMS" && !hasClaims) || (r.code === "SYS-DISCLAIMERS" && !hasDisclaimers))
        .map((rule) => ({ rule, reason: rule.code === "SYS-CLAIMS" ? "no_claims_library" : "no_disclaimers_library" })),
    ],
  };
  const applicable = new Map(selection.applicable.map((r) => [r.code, r]));
  const dropped = { unknownRule: [] as string[], duplicates: 0, downgraded: 0, superseded: 0 };

  // ---- Deterministic registry (new rules) and the v1 checks (creator rules) ----
  const detResults = new Map<string, CheckResult>();
  const candidates: DraftFinding[] = [];
  // A document with unreadable pages cannot prove that something is missing (case 10).
  const unreadablePdf = (input.media.pdf?.unreadable ?? 0) > 0;
  for (const rule of selection.applicable) {
    const check = rule.deterministic_check ? CHECKS[rule.deterministic_check] : undefined;
    if (!check) continue;
    let res = check(rule, { ctx, texts, signals });
    if (unreadablePdf && res.outcome === "failed" && res.findings.every((f) => f.finding_type === "missing_required"))
      res = { outcome: "unable_to_verify", reason: "coverage:pdf_pages" };
    detResults.set(rule.code, res);
    if (res.outcome === "failed") candidates.push(...res.findings);
  }
  const legacy = runDeterministicChecks(input.legacy.submission, input.legacy.segments, input.legacy.onScreen, { audioMode: input.legacy.audioMode });
  candidates.push(...legacy.findings.map(fromLegacy).filter((f) => !(unreadablePdf && f.finding_type === "missing_required")));

  // ---- Product facts ----
  if (applicable.has("SYS-CLAIMS"))
    candidates.push(...matchClaims({ ctx, texts, claims: lib.claims, linkedClaimIds: lib.linkedClaimIds, modelQuotes: modelOk ? model!.claims_detected ?? [] : [] }));
  if (applicable.has("SYS-DISCLAIMERS")) candidates.push(...checkDisclaimers(lib.disclaimers, ctx, texts, new Set(applicable.keys())));

  const facts = checkProductFacts(ctx, texts);
  candidates.push(...facts.findings);

  // ---- Model findings (only for rules the model may evaluate) ----
  if (modelOk) {
    for (const f of model!.findings) {
      const rule = applicable.get(f.rule_code);
      if (!rule || rule.check_kind === "deterministic") {
        dropped.unknownRule.push(f.rule_code);
        continue;
      }
      candidates.push(f);
    }
  }

  // ---- Merge v2 ----
  const known = candidates.filter((f) => {
    if (applicable.has(f.rule_code)) return true;
    if (!dropped.unknownRule.includes(f.rule_code)) dropped.unknownRule.push(f.rule_code);
    return false;
  });
  // Precedence per rule: confirmed_mismatch > deterministic missing_required > model findings at the same place.
  const precedence = known.filter((f) => {
    if (f.source !== "llm") return true;
    const stronger = known.some(
      (g) => g !== f && g.rule_code === f.rule_code && g.source !== "llm" &&
        (g.finding_type === "confirmed_mismatch" || (g.finding_type === "missing_required" && f.finding_type === "missing_required")) &&
        (f.finding_type === "missing_required" || quoteKey(g) === quoteKey(f) || !quoteKey(f)),
    );
    if (stronger) dropped.superseded++;
    return !stronger;
  });
  const calibrated = precedence.map((f) => {
    if (f.source === "llm" && f.severity === "violation" && f.confidence < WEAK_EVIDENCE_THRESHOLD) {
      dropped.downgraded++;
      return { ...f, severity: "warning" as Severity };
    }
    return f;
  });
  const merged: DraftFinding[] = [];
  for (const c of calibrated) {
    const isLegacy = LEGACY_PACKS.has(applicable.get(c.rule_code)?.pack ?? "");
    const i = merged.findIndex((e) => sameIssue(e, c, isLegacy));
    if (i < 0) merged.push(c);
    else {
      dropped.duplicates++;
      if (rank(c) > rank(merged[i]!)) merged[i] = c;
    }
  }
  merged.sort((a, b) => (a.evidence.t_start ?? Infinity) - (b.evidence.t_start ?? Infinity));

  // check_mode = document: never a violation from the ad alone — a request for the document («يحتاج مستنداً»).
  const docRules = new Map(
    (selection.notApplicable as NotApplicable[]).filter((n) => n.reason === "document_required").map((n) => [n.rule.code, n.rule]),
  );
  for (const rule of docRules.values()) merged.push(documentRequest(rule));
  const ruleOf = (code: string) => applicable.get(code) ?? docRules.get(code)!;

  const findings: MergedFinding[] = merged.map((f) => {
    const rule = ruleOf(f.rule_code);
    const draft = rule.review_state === "draft" || rule.review_state === "legal_review";
    const guideline = rule.source_status === "guideline";
    // check_mode = hybrid: capped at a potential risk until the requested evidence is reviewed.
    const hybrid = rule.check_mode === "hybrid";
    const severity: Severity = draft || guideline || hybrid || rule.check_mode === "document" ? "warning" : f.severity;
    const finding_type: FindingType =
      hybrid && (f.finding_type === "confirmed_mismatch" || f.finding_type === "missing_required") ? "potential_risk" : f.finding_type;
    return {
      ...f,
      severity,
      finding_type,
      rule_id: rule.id,
      rule_draft: draft,
      citation: {
        rule_code: rule.code, rule_id: rule.id, source_id: rule.regulatory_source_id, article_ref: rule.article_ref,
        review_state: rule.review_state, pack: rule.pack, ...(f.values ? { values: f.values } : {}),
        // Phase 8: how the rule is checked, the evidence policy shown on the finding, and the rule version used.
        ...(rule.check_mode ? { check_mode: rule.check_mode } : {}),
        ...(rule.evidence_policy_ar ? { evidence_policy_ar: rule.evidence_policy_ar } : {}),
        ...(hybrid && rule.evidence_policy_ar ? { evidence_request_ar: rule.evidence_policy_ar } : {}),
        ...(rule.rule_version ? { rule_version: rule.rule_version } : {}),
        // Organisation brand-guideline rules (Phase 6.7) are labelled «سياسة داخلية», never as regulation.
        ...(rule.category === "internal" ? { internal_policy: true } : {}),
        // Claim fields at top level: the database resolves findings by citation->>'claim_key'.
        ...(f.rule_code === "SYS-CLAIMS" && f.values
          ? { claim_class: f.values["claim_class"], claim_id: f.values["claim_id"], claim_key: f.values["claim_key"], claim_version: f.values["claim_version"] }
          : {}),
      },
    };
  });

  // ---- Rule checks ----
  const partialMedia = input.media.transcriptionFailed || input.media.batchesFailed > 0 || (input.media.pdf?.unreadable ?? 0) > 0 ||
    (ctx.kind !== "text" && input.media.framesTotal > 0 && input.media.framesAnalyzed === 0);
  const modelRule = new Map((modelOk ? model!.rule_results : []).map((r) => [r.rule_code, r]));
  const ruleChecks: RuleCheckResult[] = [];
  for (const rule of selection.applicable) {
    const idx = findings.flatMap((f, i) => (f.rule_code === rule.code ? [i] : []));
    if (idx.length) {
      ruleChecks.push({ rule_id: rule.id, rule_code: rule.code, outcome: "failed", reason: null, finding_indexes: idx });
      continue;
    }
    let reason: string | null = null;
    const det = detResults.get(rule.code);
    if (det?.outcome === "unable_to_verify") reason = det.reason;
    if (!reason && FACT_RULES.has(rule.code) && facts.status === "draft_product") reason = "product_not_approved";
    if (!reason && (rule.check_kind === "llm" || rule.check_kind === "hybrid") && rule.pack !== "sa-system") {
      if (!modelOk) reason = input.modelStatus === "invalid" ? "model_output_invalid" : "coverage:model";
      else if (modelRule.get(rule.code)?.outcome === "unable_to_verify") reason = "model_unable";
    }
    // check_mode = content/hybrid: with incomplete analysis, «لا ملاحظة» is not «سليم» — «تعذّر التحقق».
    if (!reason && (rule.check_mode === "content" || rule.check_mode === "hybrid") && partialMedia) reason = "coverage:partial";
    ruleChecks.push({ rule_id: rule.id, rule_code: rule.code, outcome: reason ? "unable_to_verify" : "passed", reason, finding_indexes: [] });
  }
  for (const n of selection.notApplicable as NotApplicable[]) {
    if (n.reason === "document_required") {
      const idx = findings.flatMap((f, i) => (f.rule_code === n.rule.code ? [i] : []));
      ruleChecks.push({ rule_id: n.rule.id, rule_code: n.rule.code, outcome: "unable_to_verify", reason: "document_required", finding_indexes: idx });
    } else if (n.reason === "reviewer_checklist")
      // check_mode = workflow: never guessed — an item on the reviewer checklist.
      ruleChecks.push({ rule_id: n.rule.id, rule_code: n.rule.code, outcome: "unable_to_verify", reason: "reviewer_checklist", finding_indexes: [] });
    else ruleChecks.push({ rule_id: n.rule.id, rule_code: n.rule.code, outcome: "not_applicable", reason: n.reason, finding_indexes: [] });
  }

  // ---- Coverage ----
  const items: CoverageItem[] = [];
  const kind = ctx.kind;
  items.push({ modality: "caption", state: (ctx.caption ?? input.legacy.submission.caption ?? "").trim() ? "present" : "absent" });
  if (kind === "video")
    items.push({ modality: "audio", state: input.media.transcriptionFailed ? "transcription_failed" : input.legacy.audioMode ?? "no_audio" });
  if (kind === "pdf" && input.media.pdf) {
    const p = input.media.pdf;
    items.push({ modality: "pdf_pages", state: p.unreadable ? `unreadable:${p.unreadable}/${p.total}` : `text_layer:${p.textLayer}/${p.total}` });
  }
  if (kind === "video" || kind === "image" || kind === "pdf") {
    items.push({ modality: "frames", state: input.media.batchesFailed ? `batch_failed:${input.media.batchesFailed}` : `analyzed:${input.media.framesAnalyzed}/${input.media.framesTotal}` });
    items.push({ modality: "on_screen_text", state: !modelOk ? "failed" : model!.ocr.length ? "read" : "none_found" });
  }
  items.push({ modality: "product_facts", state: facts.status });
  items.push({ modality: "model", state: modelOk ? "ok" : input.modelStatus });
  const insurance = ctx.product?.regulator === "IA" || ctx.sector === "insurance";
  if (insurance && !input.rules.some((r) => r.pack === "sa-ia-insurance" && r.review_state !== "archived"))
    items.push({ modality: "rule_packs", state: "pack_not_available" });
  const partial = input.media.transcriptionFailed || input.media.batchesFailed > 0 || !modelOk || unreadablePdf ||
    (kind !== "text" && input.media.framesTotal > 0 && input.media.framesAnalyzed === 0);
  const packs: PackApplied[] = ctx.enabledPacks.map((p) => ({
    code: p.code,
    reason: p.reason ?? "default",
    include_drafts: p.includeDrafts,
    applicable: ruleChecks.filter((c) => c.outcome !== "not_applicable" && input.rules.find((r) => r.id === c.rule_id)?.pack === p.code).length,
    not_applicable: ruleChecks.filter((c) => c.outcome === "not_applicable" && input.rules.find((r) => r.id === c.rule_id)?.pack === p.code).length,
  }));
  const coverage: Coverage = { status: partial ? "partial" : "complete", items, packs };

  return { findings, ruleChecks, coverage, overallStatus: overallStatusV2(findings, coverage, ruleChecks), signals: [...signals], dropped, contentSectors: ctx.contentSectors };
}

/** §10: needs_fixes for a non-draft violation or a confirmed mismatch; review for anything else uncertain. */
export function overallStatusV2(
  findings: Pick<MergedFinding, "severity" | "rule_draft" | "finding_type">[],
  coverage: Pick<Coverage, "status">,
  ruleChecks: Pick<RuleCheckResult, "outcome">[],
): OverallStatus {
  if (findings.some((f) => (f.severity === "violation" && !f.rule_draft) || f.finding_type === "confirmed_mismatch")) return "needs_fixes";
  if (findings.length || coverage.status === "partial" || ruleChecks.some((r) => r.outcome === "unable_to_verify")) return "review";
  return "ready";
}

/** Facts status for the coverage chip (exported for the analyze function's logs). */
export type { FactsStatus };

/** check_mode = document: the document request finding. Text comes from the rule; nothing is inferred from the ad. */
function documentRequest(rule: RuleRow): DraftFinding {
  const policy = rule.evidence_policy_ar ? ` ${rule.evidence_policy_ar}` : "";
  return {
    rule_code: rule.code,
    finding_type: "needs_evidence",
    severity: "warning",
    confidence: 1,
    source: "deterministic",
    evidence: { modality: "metadata", quote: "", t_start: null, t_end: null },
    explanation_ar: `يحتاج مستنداً: ${rule.summary_ar ?? rule.title_ar}${policy}`,
    explanation_en: `Needs a document: ${rule.code}`,
    missing_information_ar: rule.evidence_policy_ar ?? null,
    suggested_fix_ar: "أرفق المستند المطلوب للمراجع، أو أوضح سبب عدم انطباقه.",
  };
}
