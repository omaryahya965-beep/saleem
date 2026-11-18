import type { AnalysisContext, RuleRecord, RuleRow, SubmissionData, TokenUsage, TranscriptSegment } from "../types.ts";
import type { AnalysisOutput } from "../pipeline/schema.ts";
import type { ModelOutputV2 } from "../pipeline/schema-v2.ts";
import type { ProviderErrorInfo } from "./errors.ts";
import type { ScoredSegment } from "../rules/speech.ts";

export interface TranscriptionResult {
  full_text: string;
  segments: TranscriptSegment[];
  /** Same segments with confidence signals (no_speech_prob, avg_logprob, compression_ratio). */
  scored: ScoredSegment[];
  provider: string;
  model: string;
  /** Audio seconds billed. */
  seconds: number;
}

export interface FrameInput {
  t: number;
  /** HTTPS (signed) URL or data: URL of a JPEG ≤ 768 px. */
  url: string;
}

export interface AnalysisRequest {
  submission: SubmissionData;
  segments: TranscriptSegment[];
  rules: RuleRecord[];
  frames: FrameInput[];
  duration: number | null;
}

export interface AnalysisResult extends AnalysisOutput {
  provider: string;
  model: string;
  usage: TokenUsage;
  /** Raw model JSON per batch, kept for audit/debugging. */
  raw: unknown[];
  attempts: number;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audio: Blob, fileName: string): Promise<TranscriptionResult>;
}

export interface AnalysisProvider {
  readonly name: string;
  analyze(req: AnalysisRequest): Promise<AnalysisResult>;
  analyzeV2(req: AnalysisRequestV2): Promise<AnalysisResultV2>;
}

/** v2 request: context + only the applicable rules (the provider sends the model-evaluated ones). */
export interface AnalysisRequestV2 {
  submission: SubmissionData;
  ctx: AnalysisContext;
  segments: TranscriptSegment[];
  rules: RuleRow[];
  frames: FrameInput[];
  duration: number | null;
}

export interface AnalysisResultV2 {
  /** Merged output of the batches that validated; null when none did. */
  output: ModelOutputV2 | null;
  /** Batches whose output stayed invalid after one retry (coverage becomes partial). */
  batchesFailed: number;
  batches: number;
  provider: string;
  model: string;
  usage: TokenUsage;
  raw: unknown[];
  attempts: number;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
    /** Classified provider failure (code, status, error type, request id). */
    public readonly info?: ProviderErrorInfo,
  ) {
    super(message);
  }
}
