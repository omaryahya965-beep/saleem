// SALEEM Fix voice / video providers (V2 completion §15.5–15.6, D198). Extensible interface; only providers that
// genuinely work are marked available. Recording or uploading a corrected voiceover is free and local. Third-party
// text-to-speech and replacement-video generation need an authorised API, credentials and (usually) a paid plan —
// none is configured, so they report «يتطلب إعداداً» and never return simulated media.

export type VoiceProviderId = "recorded" | "uploaded" | "gemini_tts" | "heygen" | "elevenlabs";
export interface VoiceProvider {
  id: VoiceProviderId;
  available: boolean;
  languages: ("ar" | "en")[];
  /** Why it is unavailable / what it needs (documented in docs/saleem-v2/SALEEM_FIX_PROVIDERS.md). */
  requirementKey: string;
}
export const VOICE_PROVIDERS: VoiceProvider[] = [
  {
    id: "recorded",
    available: true,
    languages: ["ar", "en"],
    requirementKey: "fix2.voice.recorded",
  },
  {
    id: "uploaded",
    available: true,
    languages: ["ar", "en"],
    requirementKey: "fix2.voice.uploaded",
  },
  {
    id: "gemini_tts",
    available: false,
    languages: ["ar", "en"],
    requirementKey: "fix2.voice.gemini_tts",
  },
  { id: "heygen", available: false, languages: ["ar", "en"], requirementKey: "fix2.voice.heygen" },
  {
    id: "elevenlabs",
    available: false,
    languages: ["ar", "en"],
    requirementKey: "fix2.voice.elevenlabs",
  },
];

export type VideoProviderId = "veo" | "heygen_video" | "runway";
export const VIDEO_PROVIDERS: { id: VideoProviderId; available: false; requirementKey: string }[] =
  [
    { id: "veo", available: false, requirementKey: "fix2.video.veo" },
    { id: "heygen_video", available: false, requirementKey: "fix2.video.heygen_video" },
    { id: "runway", available: false, requirementKey: "fix2.video.runway" },
  ];

/** Records a voiceover from the microphone (browser permission prompt). */
export async function startRecording(): Promise<{ stop: () => Promise<Blob>; cancel: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: rec.mimeType }));
        };
        rec.stop();
      }),
    cancel: () => {
      rec.stop();
      release();
    },
  };
}
