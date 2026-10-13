// supabase/functions/_shared/providers/transcription.ts

import type { TranscriptSegment } from "../types.ts";

export interface TranscriptionResult {
  full_text: string;
  segments: TranscriptSegment[];
  provider: string;
}

export async function transcribeAudio(
  audioBuffer: ArrayBuffer | null,
  fileName: string = "audio.wav",
  asrModel: string = "whisper-1"
): Promise<TranscriptionResult> {
  const getEnv = (k: string) => (typeof Deno !== "undefined" ? Deno.env.get(k) : process.env[k]);
  const apiKey = getEnv("OPENAI_API_KEY");

  // If no OpenAI key is configured or no audio buffer is provided, provide deterministic fallback
  if (!apiKey || !audioBuffer || audioBuffer.byteLength === 0) {
    console.log("[TranscriptionProvider] Using mock/demo Arabic transcription (no API key or empty audio)");
    return {
      full_text: "هلا والله يا جماعة، اليوم بجرب لكم شاي جديد... هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع ومضمون بدون أعراض جانبية. استخدموا كود SALEEM20 والرابط في البايو، اطلبوا الحين.",
      segments: [
        { start: 0.0, end: 4.5, text: "هلا والله يا جماعة، اليوم بجرب لكم شاي جديد" },
        { start: 4.5, end: 12.0, text: "صراحة طعمه حلو وريحته تجنن" },
        { start: 12.0, end: 19.0, text: "هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع" },
        { start: 19.0, end: 24.0, text: "ومضمون بدون أعراض جانبية" },
        { start: 24.0, end: 33.0, text: "استخدموا كود SALEEM20 والرابط في البايو" },
        { start: 33.0, end: 42.0, text: "اطلبوا الحين قبل لا يخلص" },
      ],
      provider: "mock-demo",
    };
  }

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: "audio/wav" });
  formData.append("file", blob, fileName);
  formData.append("model", asrModel);
  formData.append("language", "ar");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Whisper transcription failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawSegments = data.segments || [];

  const segments: TranscriptSegment[] = rawSegments.map((s: { start?: number; end?: number; text?: string }) => ({
    start: Number(s.start || 0),
    end: Number(s.end || 0),
    text: String(s.text || "").trim(),
  }));

  return {
    full_text: data.text || "",
    segments,
    provider: "openai-whisper",
  };
}
