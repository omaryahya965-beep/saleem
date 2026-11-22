// Shared pipeline types. Pure TypeScript (no Deno/Node APIs) so they run in Edge Functions and Vitest.

import type { ProductKeyFacts } from "./products/key-facts.ts";
export type Severity = "violation" | "warning";
export type EvidenceType = "transcript" | "frame" | "caption" | "metadata";
export type FindingSource = "deterministic" | "llm";
export type OverallStatus = "ready" | "needs_fixes" | "review";
export type PipelineStep = "transcribe" | "deterministic" | "llm" | "merge" | "done";

export interface Finding {
  rule_code: string;
  severity: Severity;
  t_start: number | null;
  t_end: number | null;
  evidence_type: EvidenceType;
  evidence_text: string | null;
  /** Timestamp of the frame used as evidence (resolved to a frame id when persisted). */
  evidence_frame_t?: number | null;
  explanation_ar: string;
  explanation_en: string;
  fix_ar: string;
  fix_en: string;
  confidence: number;
  source: FindingSource;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** Text read from a frame (on-screen captions, overlays, packaging). */
export interface OnScreenText {
  t: number;
  text: string;
}

export interface SubmissionData {
  id: string;
  user_id?: string | null;
  is_demo: boolean;
  kind: "video" | "image" | "text" | "pdf";
  file_path?: string | null;
  audio_path?: string | null;
  text_content?: string | null;
  caption: string;
  platform: string;
  product_category: string;
  is_paid_ad: boolean;
  has_written_contract: boolean;
  ai_used: boolean;
  mawthooq_license_no?: string | null;
  sha256?: string | null;
  duration_seconds?: number | null;
  status: string;
  progress: number;
  current_step: PipelineStep;
  overall_status?: OverallStatus | null;
  /** Set by the pipeline after the transcription step (video only). */
  audio_mode?: "speech" | "music_no_speech" | "no_audio" | null;
  audio_probe?: unknown;
  image_count?: number | null;
}

export interface RuleRecord {
  code: string;
  category: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  source_name: string;
  source_url: string;
  check_type: string;
  default_severity: Severity;
  llm_instructions: string;
  applies_to_categories: string[];
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens?: number;
}

// ---------------------------------------------------------------------------------------------
// v2 rule engine (Phase 2). See docs/saleem-v2/04_AI_PIPELINE.md.
// ---------------------------------------------------------------------------------------------

export type FindingType = "confirmed_mismatch" | "potential_risk" | "missing_required" | "needs_evidence" | "unable_to_verify";
export type RuleOutcome = "passed" | "failed" | "not_applicable" | "unable_to_verify";
export type Modality = "speech" | "on_screen_text" | "caption" | "visual" | "pdf_text" | "metadata";
export type CheckKind = "deterministic" | "llm" | "hybrid" | "workflow";
export type ReviewState = "draft" | "legal_review" | "active" | "archived";

/** rules.applicability — all present keys must match (AND); a missing key or ["*"] means any. */
export interface Applicability {
  sectors?: string[];
  regulators?: string[];
  product_types?: string[];
  communication_types?: string[];
  channels?: string[];
  distribution?: string[];
  audiences_exclude?: string[];
  requires_product?: boolean;
  any_of?: Applicability[];
}

/** A rule row of the active release, joined with its source status (for guideline capping). */
/** Why a pack is applied to a run (shown in the report): creator default, always on, org choice, sector default. */
export type PackReason =
  | "creator_default"
  | "always_enabled"
  | "org_enabled"
  | "sector_default"
  | "default"
  /** D211: personal workspace — an authority the user selected, or one SALEEM recommended (automatic mode). */
  | "personal_selected"
  | "personal_recommended";

export interface RuleRow {
  id: string;
  code: string;
  category: string;
  pack: string | null;
  regulatory_source_id: string | null;
  source_status?: string | null;
  article_ref: string | null;
  title_ar: string;
  title_en: string;
  summary_ar: string | null;
  summary_en: string | null;
  check_kind: CheckKind | null;
  deterministic_check: string | null;
  finding_type_on_fail: FindingType | null;
  default_severity: Severity;
  applicability: Applicability;
  content_triggers: string[];
  llm_instructions: string;
  review_state: ReviewState;
  /** Phase 8 (CSV v0.1 rules): how the rule is checked. content = from the ad; document = needs a document, never a
   * violation from the ad alone; workflow = SALEEM records or a reviewer checklist item, never a model guess;
   * hybrid = content signal plus an evidence request, capped at potential risk. Absent on older rules. */
  check_mode?: "content" | "document" | "workflow" | "hybrid" | null;
  evidence_policy_ar?: string | null;
  applicability_ar?: string | null;
  /** A draft that may duplicate an existing rule (pending human mapping review): never applied. */
  possible_duplicate_of?: string | null;
  /** Release (rulebook version) the row belongs to, or the internal rule version: recorded on each finding. */
  rule_version?: string | null;
}

export interface AnalysisContext {
  submissionId: string;
  promotionId: string | null;
  versionNo: number | null;
  orgId: string | null;
  sector: string | null;
  communicationType: "financial_promotion" | "general_commercial" | "creator_sponsored" | "internal";
  channels: string[];
  distribution: "owned" | "agency" | "paid_media" | "influencer" | null;
  creatorLicenseNo: string | null;
  audience: string[];
  market: string;
  isPaid: boolean | null;
  caption: string | null;
  product: null | {
    id: string;
    nameAr: string;
    nameEn: string | null;
    aliases: string[];
    sector: string;
    productType: string;
    regulator: string;
    currency: string;
    status: "draft" | "approved" | "archived";
    keyFacts: ProductKeyFacts;
  };
  brandAliases: string[];
  enabledPacks: { code: string; includeDrafts: boolean; reason?: PackReason }[];
  /** D211: personal promotions — authorities the user selected (null = automatic) and the recommended ones. */
  selectedAuthorities?: string[] | null;
  recommendedAuthorities?: string[];
  kind: "video" | "image" | "text" | "pdf";
}

/** One piece of ad text with where it came from. `norm` = normalizeArabic(text). */
export interface ExtractedText {
  modality: Modality;
  text: string;
  norm: string;
  t_start: number | null;
  t_end: number | null;
  frame_ref?: string | null;
  page?: number | null;
}

export interface FindingEvidence {
  modality: Modality;
  quote: string;
  t_start: number | null;
  t_end: number | null;
  frame_ref?: string | null;
  page?: number | null;
}

/** A finding before it is attached to its rule row (merge v2 adds rule id, citation and caps). */
export interface DraftFinding {
  rule_code: string;
  finding_type: FindingType;
  severity: Severity;
  confidence: number;
  source: "deterministic" | "llm" | "facts";
  evidence: FindingEvidence;
  explanation_ar: string;
  explanation_en: string;
  missing_information_ar?: string | null;
  suggested_fix_ar: string;
  suggested_fix_en?: string;
  /** Extra citation data, e.g. the approved and stated values of a confirmed mismatch. */
  values?: Record<string, unknown>;
}
