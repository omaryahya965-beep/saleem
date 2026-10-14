// In-browser media preparation, so the Edge Function never decodes video:
//  • frames: 1 per second (max 60) + first + last, long side ≤ 768 px, JPEG
//  • audio: mono 16 kHz 16-bit PCM WAV (≈ 1.9 MB per minute)

import { grabFrame, resolveDuration, seek } from "./media";
import { NO_AUDIO_PROBE, probeSpeech, type SpeechProbe } from "./speech";

export const FRAME_MAX_SIDE = 768;
export const MAX_SAMPLED_FRAMES = 60;
export const AUDIO_SAMPLE_RATE = 16_000;

export interface ExtractedFrame {
  t: number;
  blob: Blob;
}

/** Frame timestamps: first (0), every second up to 60 samples, and the last frame. */
export function frameTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const last = Math.max(0, duration - 0.05);
  const step = duration > MAX_SAMPLED_FRAMES ? duration / MAX_SAMPLED_FRAMES : 1;
  const times = new Set<number>([0]);
  for (let t = step; t < last && times.size <= MAX_SAMPLED_FRAMES; t += step)
    times.add(Math.round(t * 1000) / 1000);
  times.add(Math.round(last * 1000) / 1000);
  return [...times].sort((a, b) => a - b);
}

export async function extractFrames(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractedFrame[]> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video decode failed"));
      video.src = url;
    });
    const times = frameTimes(await resolveDuration(video));
    const frames: ExtractedFrame[] = [];
    for (const [i, t] of times.entries()) {
      await seek(video, t);
      const blob = await grabFrame(video, FRAME_MAX_SIDE, 0.78);
      if (blob) frames.push({ t, blob });
      onProgress?.(i + 1, times.length);
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resizes a still image to ≤ 768 px for the vision model. */
export async function imageToFrame(file: File): Promise<ExtractedFrame | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, FRAME_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return blob ? { t: 0, blob } : null;
}

/** Encodes mono float samples as 16-bit PCM WAV bytes. */
export function encodeWavBuffer(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  return new Blob([encodeWavBuffer(samples, sampleRate)], { type: "audio/wav" });
}

/**
 * Decodes the file's audio track and resamples to mono 16 kHz WAV.
 * Returns null when the file has no decodable audio (the server then falls back to the original file).
 */
export interface AudioExtraction {
  /** 16 kHz mono WAV, or null when the file has no decodable audio. */
  wav: Blob | null;
  /** Speech-presence probe; null when we couldn't tell (server then transcribes and filters). */
  probe: SpeechProbe | null;
}

/** True/false when the browser can tell whether the video has an audio track, null if unknown. */
async function hasAudioTrack(file: File): Promise<boolean | null> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error("decode"));
      v.src = url;
    });
    const el = v as HTMLVideoElement & {
      audioTracks?: { length: number };
      mozHasAudio?: boolean;
      captureStream?: () => MediaStream;
    };
    if (el.audioTracks) return el.audioTracks.length > 0;
    if (typeof el.mozHasAudio === "boolean") return el.mozHasAudio;
    if (el.captureStream) return el.captureStream().getAudioTracks().length > 0;
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Decodes the audio track, resamples to mono 16 kHz WAV and runs the speech-presence probe.
 * No audio stream → { wav: null, probe: NO_AUDIO_PROBE } (the server skips transcription).
 */
export async function extractAudioWithProbe(file: File): Promise<AudioExtraction> {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC || typeof OfflineAudioContext === "undefined") return { wav: null, probe: null };
  const ctx = new AC();
  try {
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    const length = Math.ceil(decoded.duration * AUDIO_SAMPLE_RATE);
    if (length <= 0) return { wav: null, probe: NO_AUDIO_PROBE };
    const offline = new OfflineAudioContext(1, length, AUDIO_SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    return {
      wav: encodeWav(samples, AUDIO_SAMPLE_RATE),
      probe: probeSpeech(samples, AUDIO_SAMPLE_RATE),
    };
  } catch {
    // Decoding failed: either there is no audio stream, or this browser can't decode the codec.
    const has = await hasAudioTrack(file);
    return has === false ? { wav: null, probe: NO_AUDIO_PROBE } : { wav: null, probe: null };
  } finally {
    void ctx.close();
  }
}

/** Back-compat: the WAV only. */
export async function extractAudio(file: File): Promise<Blob | null> {
  return (await extractAudioWithProbe(file)).wav;
}
