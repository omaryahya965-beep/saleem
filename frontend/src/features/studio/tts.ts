// SALEEM AI Studio — voice providers (D207). Capability-based and honest:
//   - local-piper: open-source Piper voices (MIT) running in the browser via ONNX Runtime (@diffusionstudio/vits-web).
//                  Produces a real WAV file. The text never leaves the device; the voice model (~60 MB) is downloaded
//                  once from Hugging Face and cached in the browser (OPFS). Free.
//   - recorded / uploaded: the marketer's own voice (existing, free).
//   - gemini-tts / elevenlabs / heygen: need paid API access and a server adapter — reported unavailable, never faked.
// Browser speechSynthesis is NOT offered: it speaks through the speakers and cannot be exported as a file.

export type VoiceGender = "male" | "female";
export interface LocalVoice {
  id:
    | "ar_JO-kareem-medium"
    | "ar_JO-kareem-low"
    | "en_US-hfc_female-medium"
    | "en_US-hfc_male-medium";
  lang: "ar" | "en";
  gender: VoiceGender;
  label: string;
  /** Approximate one-time download. */
  sizeMb: number;
}
export const LOCAL_VOICES: LocalVoice[] = [
  {
    id: "ar_JO-kareem-medium",
    lang: "ar",
    gender: "male",
    label: "Kareem · العربية (جودة متوسطة)",
    sizeMb: 63,
  },
  {
    id: "ar_JO-kareem-low",
    lang: "ar",
    gender: "male",
    label: "Kareem · العربية (خفيف)",
    sizeMb: 28,
  },
  {
    id: "en_US-hfc_female-medium",
    lang: "en",
    gender: "female",
    label: "HFC female · English",
    sizeMb: 63,
  },
  {
    id: "en_US-hfc_male-medium",
    lang: "en",
    gender: "male",
    label: "HFC male · English",
    sizeMb: 63,
  },
];

export type VoiceProviderId =
  "local-piper" | "recorded" | "uploaded" | "gemini-tts" | "elevenlabs" | "heygen";
export const VOICE_PROVIDER_STATUS: { id: VoiceProviderId; available: boolean; free: boolean }[] = [
  { id: "local-piper", available: true, free: true },
  { id: "recorded", available: true, free: true },
  { id: "uploaded", available: true, free: true },
  { id: "gemini-tts", available: false, free: false },
  { id: "elevenlabs", available: false, free: false },
  { id: "heygen", available: false, free: false },
];

/** Voices for a language; Arabic has a male voice only (no open Arabic female Piper voice is published). */
export function voicesFor(lang: "ar" | "en", gender?: VoiceGender): LocalVoice[] {
  const all = LOCAL_VOICES.filter((v) => v.lang === lang);
  const exact = gender ? all.filter((v) => v.gender === gender) : all;
  return exact.length ? exact : all;
}

export interface SynthProgress {
  loaded: number;
  total: number;
}

/** Synthesises one text to a WAV blob in the browser. Lazy-loads the runtime only when used. */
export async function synthesize(
  text: string,
  voiceId: LocalVoice["id"],
  onProgress?: (p: SynthProgress) => void,
): Promise<Blob> {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) throw new Error("empty_text");
  const { predict } = await import("@diffusionstudio/vits-web");
  return predict({ text: clean, voiceId }, (p) =>
    onProgress?.({ loaded: p.loaded, total: p.total }),
  );
}
