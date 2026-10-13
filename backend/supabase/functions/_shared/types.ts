// Shared pipeline types. Pure TypeScript (no Deno/Node APIs) so they run in Edge Functions and Vitest.

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
  kind: "video" | "image" | "text";
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
