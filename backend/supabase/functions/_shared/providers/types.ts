import type { RuleRecord, SubmissionData, TokenUsage, TranscriptSegment } from "../types.ts";
import type { AnalysisOutput } from "../pipeline/schema.ts";

export interface TranscriptionResult {
  full_text: string;
  segments: TranscriptSegment[];
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
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
  }
}
