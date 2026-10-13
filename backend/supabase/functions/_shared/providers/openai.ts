// OpenAI providers: transcription (segment timestamps) and vision + reasoning analysis
// via the Responses API with strict Structured Outputs.

import { ANALYSIS_SCHEMA, SchemaError, parseModelJson, validateAnalysis, type AnalysisOutput } from "../pipeline/schema.ts";
import type { TokenUsage, TranscriptSegment } from "../types.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.ts";
import {
  ProviderError,
  type AnalysisProvider,
  type AnalysisRequest,
  type AnalysisResult,
  type TranscriptionProvider,
  type TranscriptionResult,
} from "./types.ts";

const API = "https://api.openai.com/v1";

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    throw new ProviderError(`network error calling OpenAI: ${(e as Error).message}`, true);
  } finally {
    clearTimeout(id);
  }
}

async function fail(res: Response, what: string): Promise<never> {
  const body = (await res.text()).slice(0, 400);
  // 408/409/429/5xx are transient; 400/401/403/404 are configuration or input errors.
  throw new ProviderError(`${what} failed (${res.status}): ${body}`, res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500, res.status);
}

/** Retries transient failures with exponential backoff + jitter. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, attempts = 3, baseMs = 800): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (e) {
      last = e;
      if (!(e instanceof ProviderError) || !e.retryable || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i + Math.random() * 250));
    }
  }
  throw last;
}

// ---------------------------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------------------------

interface RawSegment {
  start?: number;
  end?: number;
  text?: string;
}

export function normalizeSegments(raw: RawSegment[]): TranscriptSegment[] {
  return raw
    .map((s) => ({ start: Number(s.start ?? 0), end: Number(s.end ?? s.start ?? 0), text: String(s.text ?? "").trim() }))
    .filter((s) => s.text.length > 0 && Number.isFinite(s.start))
    .sort((a, b) => a.start - b.start);
}

export class OpenAITranscription implements TranscriptionProvider {
  readonly name = "openai";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fallbackModel = "whisper-1",
  ) {}

  private async call(model: string, audio: Blob, fileName: string): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append("file", audio, fileName);
    form.append("model", model);
    form.append("language", "ar");
    if (model.includes("diarize")) {
      form.append("response_format", "diarized_json");
      form.append("chunking_strategy", "auto");
    } else if (model.startsWith("whisper")) {
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "segment");
      form.append("prompt", "مقطع باللهجة السعودية لصانع محتوى، قد يتضمن إعلاناً أو كود خصم.");
    } else {
      throw new ProviderError(`transcription model ${model} does not return segment timestamps`, false);
    }
    const res = await fetchWithTimeout(`${API}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}` }, body: form }, 120_000);
    if (!res.ok) await fail(res, `transcription (${model})`);
    const data = (await res.json()) as { text?: string; segments?: RawSegment[]; duration?: number; usage?: { seconds?: number } };
    const segments = normalizeSegments(data.segments ?? []);
    const seconds = Number(data.duration ?? data.usage?.seconds ?? segments.at(-1)?.end ?? 0);
    return {
      full_text: (data.text ?? segments.map((s) => s.text).join(" ")).trim(),
      segments,
      provider: this.name,
      model,
      seconds,
    };
  }

  async transcribe(audio: Blob, fileName: string): Promise<TranscriptionResult> {
    try {
      return await withRetry(() => this.call(this.model, audio, fileName));
    } catch (e) {
      // Configuration errors (unknown model, unsupported format) fall back to whisper-1 once.
      if (e instanceof ProviderError && !e.retryable && this.model !== this.fallbackModel) {
        console.warn(JSON.stringify({ event: "transcription_fallback", from: this.model, reason: e.message.slice(0, 200) }));
        return withRetry(() => this.call(this.fallbackModel, audio, fileName));
      }
      throw e;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Vision + reasoning analysis
// ---------------------------------------------------------------------------------------------

export const FRAMES_PER_BATCH = 32;

interface ResponsesOutput {
  output?: { type: string; content?: { type: string; text?: string }[] }[];
  output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
  status?: string;
  incomplete_details?: { reason?: string };
}

function outputText(d: ResponsesOutput): string {
  if (typeof d.output_text === "string" && d.output_text) return d.output_text;
  for (const item of d.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) if (c.type === "output_text" && c.text) return c.text;
    for (const c of item.content ?? []) if (c.type === "refusal") throw new ProviderError("model refused the request", false);
  }
  return "";
}

export class OpenAIAnalysis implements AnalysisProvider {
  readonly name = "openai";
  /** Cleared when the model rejects the reasoning parameter (non-reasoning models). */
  private reasoningEffort: string | null;
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    reasoningEffort: string = "medium",
  ) {
    this.reasoningEffort = reasoningEffort === "none" ? null : reasoningEffort;
  }

  private async callOnce(req: AnalysisRequest, frames: AnalysisRequest["frames"], batch: { index: number; total: number }, usage: TokenUsage): Promise<{ json: unknown; parsed: AnalysisOutput }> {
    const content: unknown[] = [
      { type: "input_text", text: buildUserPrompt(req.submission, req.segments, req.rules, frames.map((f) => f.t), batch) },
      ...frames.map((f) => ({ type: "input_image", image_url: f.url, detail: "low" })),
    ];
    const body = {
      model: this.model,
      instructions: SYSTEM_PROMPT,
      input: [{ role: "user", content }],
      ...(this.reasoningEffort ? { reasoning: { effort: this.reasoningEffort } } : {}),
      text: { format: { type: "json_schema", name: "saleem_analysis", strict: true, schema: ANALYSIS_SCHEMA } },
      max_output_tokens: 12_000,
      store: false,
    };
    const res = await fetchWithTimeout(
      `${API}/responses`,
      { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
      140_000,
    );
    if (res.status === 400 && this.reasoningEffort) {
      const text = await res.clone().text();
      if (text.includes("reasoning")) {
        console.warn(JSON.stringify({ event: "reasoning_unsupported", model: this.model }));
        this.reasoningEffort = null;
        return this.callOnce(req, frames, batch, usage);
      }
    }
    if (!res.ok) await fail(res, `analysis (${this.model})`);
    const data = (await res.json()) as ResponsesOutput;
    usage.input_tokens += data.usage?.input_tokens ?? 0;
    usage.output_tokens += data.usage?.output_tokens ?? 0;
    usage.cached_input_tokens = (usage.cached_input_tokens ?? 0) + (data.usage?.input_tokens_details?.cached_tokens ?? 0);
    if (data.status === "incomplete") throw new SchemaError(`incomplete response: ${data.incomplete_details?.reason ?? "unknown"}`);
    const json = parseModelJson(outputText(data));
    return { json, parsed: validateAnalysis(json, req.duration) };
  }

  async analyze(req: AnalysisRequest): Promise<AnalysisResult> {
    const usage: TokenUsage = { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 };
    const batches: AnalysisRequest["frames"][] = [];
    for (let i = 0; i < req.frames.length; i += FRAMES_PER_BATCH) batches.push(req.frames.slice(i, i + FRAMES_PER_BATCH));
    if (batches.length === 0) batches.push([]);

    const result: AnalysisResult = { findings: [], on_screen_text: [], provider: this.name, model: this.model, usage, raw: [], attempts: 0 };
    for (const [index, frames] of batches.entries()) {
      // Transport errors retry with backoff; a schema-invalid answer gets exactly one more try.
      let out;
      try {
        result.attempts++;
        out = await withRetry(() => this.callOnce(req, frames, { index, total: batches.length }, usage));
      } catch (e) {
        if (!(e instanceof SchemaError)) throw e;
        console.warn(JSON.stringify({ event: "schema_retry", batch: index, reason: e.message }));
        result.attempts++;
        out = await withRetry(() => this.callOnce(req, frames, { index, total: batches.length }, usage));
      }
      result.raw.push(out.json);
      result.findings.push(...out.parsed.findings);
      result.on_screen_text.push(...out.parsed.on_screen_text);
    }
    return result;
  }
}
