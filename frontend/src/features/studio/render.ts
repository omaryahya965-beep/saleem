// SALEEM AI Studio — deterministic template renderer (D207). Builds a real video from the marketer's own assets:
// per-scene product photo (cover-fit with a slow zoom) or a brand-colour background, on-screen text, a burnt-in
// disclosure band, subtitles from the narration, the logo, cross-fades, and the per-scene voiceover. Recorded in the
// browser with canvas.captureStream + Web Audio + MediaRecorder (same approach as the SALEEM Fix editor). Nothing is
// sent to any provider and nothing is charged. This is template rendering, not AI-generated footage.
import { pickMime } from "@/features/fix/mediaRender";
import { recordStream, wrapText } from "@/lib/canvas";

export type Aspect = "9:16" | "16:9" | "1:1";
export interface RenderScene {
  start: number;
  duration: number;
  onScreen: string;
  narration: string;
  image: CanvasImageSource | null;
  voice: AudioBuffer | null;
}
export interface RenderInput {
  aspect: Aspect;
  scenes: RenderScene[];
  disclosure: string;
  subtitles: boolean;
  colors: string[];
  logo: CanvasImageSource | null;
  title: string;
  voiceRate?: number;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}
export interface RenderOutput {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
  duration: number;
  width: number;
  height: number;
}

export const SIZES: Record<Aspect, { w: number; h: number }> = {
  "9:16": { w: 720, h: 1280 },
  "16:9": { w: 1280, h: 720 },
  "1:1": { w: 960, h: 960 },
};
const FADE = 0.45;
const FONT = `"IBM Plex Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif`;

/**
 * Final scene timing: each scene lasts at least as long as its narration (+0.4 s), so speech is never cut.
 * Pure — unit-tested.
 */
export function layoutScenes<T extends { duration: number; voiceSeconds: number | null }>(
  scenes: T[],
  rate = 1,
): (T & { start: number; duration: number })[] {
  let t = 0;
  return scenes.map((s) => {
    const need = s.voiceSeconds ? s.voiceSeconds / rate + 0.4 : 0;
    const duration = Math.round(Math.max(s.duration, need) * 10) / 10;
    const out = { ...s, start: Math.round(t * 10) / 10, duration };
    t += duration;
    return out;
  });
}

/** Index of the scene playing at t, and the local progress 0..1. */
export function sceneAt(
  scenes: { start: number; duration: number }[],
  t: number,
): { i: number; u: number } {
  for (let i = scenes.length - 1; i >= 0; i--) {
    const s = scenes[i]!;
    if (t >= s.start) return { i, u: Math.min(1, (t - s.start) / s.duration) };
  }
  return { i: 0, u: 0 };
}

const isRtl = (s: string) => /[؀-ۿ]/.test(s);

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  img: CanvasImageSource | null,
  u: number,
  colors: string[],
  title: string,
) {
  if (img) {
    const iw = (img as HTMLImageElement).naturalWidth || (img as ImageBitmap).width || w;
    const ih = (img as HTMLImageElement).naturalHeight || (img as ImageBitmap).height || h;
    const zoom = 1 + 0.08 * u; // slow push-in
    const scale = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2 - 10 * u, dw, dh);
    const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const a = colors[0] ?? "#0b6e4f";
  const b = colors[1] ?? "#07211a";
  const g = ctx.createLinearGradient(0, 0, w * (0.6 + 0.4 * u), h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(w * (0.75 - 0.1 * u), h * 0.3, Math.min(w, h) * 0.35, 0, Math.PI * 2);
  ctx.fill();
  if (title) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `bold ${Math.round(Math.min(w, h) * 0.09)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = isRtl(title) ? "rtl" : "ltr";
    wrapText(ctx, title, w * 0.8, 2, true).forEach((l, i, all) =>
      ctx.fillText(l, w / 2, h * 0.36 + (i - (all.length - 1) / 2) * Math.min(w, h) * 0.11),
    );
  }
}

/** Draws one frame at time t (exported for tests and for the poster). */
export function drawStudioFrame(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  w: number,
  h: number,
  t: number,
) {
  const { i, u } = sceneAt(input.scenes, t);
  const scene = input.scenes[i]!;
  drawBackground(ctx, w, h, scene.image, u, input.colors, scene.image ? "" : input.title);
  // Cross-fade from the previous scene.
  const since = t - scene.start;
  if (i > 0 && since < FADE) {
    const prev = input.scenes[i - 1]!;
    ctx.save();
    ctx.globalAlpha = 1 - since / FADE;
    drawBackground(ctx, w, h, prev.image, 1, input.colors, prev.image ? "" : input.title);
    ctx.restore();
  }
  const m = Math.min(w, h);
  // On-screen text: a brand band in the lower third.
  if (scene.onScreen) {
    ctx.font = `bold ${Math.round(m * 0.058)}px ${FONT}`;
    ctx.direction = isRtl(scene.onScreen) ? "rtl" : "ltr";
    const lines = wrapText(ctx, scene.onScreen, w * 0.78, 3, true);
    const lh = m * 0.075;
    const bandH = lines.length * lh + m * 0.06;
    const y = h * 0.62 - bandH / 2;
    const appear = Math.min(1, since / 0.35);
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.fillStyle = input.colors[0] ?? "#0b6e4f";
    roundRect(ctx, w * 0.07, y + (1 - appear) * 12, w * 0.86, bandH, m * 0.03);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((l, k) =>
      ctx.fillText(l, w / 2, y + (1 - appear) * 12 + m * 0.03 + lh * (k + 0.5)),
    );
    ctx.restore();
  }
  // Subtitles from the narration.
  if (input.subtitles && scene.narration) {
    ctx.font = `${Math.round(m * 0.038)}px ${FONT}`;
    ctx.direction = isRtl(scene.narration) ? "rtl" : "ltr";
    const lines = wrapText(ctx, scene.narration, w * 0.86, 2, true);
    const lh = m * 0.05;
    const bh = lines.length * lh + m * 0.03;
    const y = h - bh - h * 0.05;
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    roundRect(ctx, w * 0.05, y, w * 0.9, bh, m * 0.02);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((l, k) => ctx.fillText(l, w / 2, y + m * 0.015 + lh * (k + 0.5)));
  }
  // Disclosure band, always visible (burnt into every frame).
  if (input.disclosure) {
    ctx.font = `bold ${Math.round(m * 0.032)}px ${FONT}`;
    ctx.direction = isRtl(input.disclosure) ? "rtl" : "ltr";
    const tw = Math.min(w * 0.9, ctx.measureText(input.disclosure).width + m * 0.06);
    ctx.fillStyle = "rgba(7,33,26,0.88)";
    roundRect(ctx, (w - tw) / 2, h * 0.025, tw, m * 0.06, m * 0.03);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(input.disclosure, w / 2, h * 0.025 + m * 0.03, w * 0.86);
  }
  if (input.logo) {
    const s = m * 0.12;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(input.logo, w - s - m * 0.04, h * 0.025 + m * 0.08, s, s);
    ctx.globalAlpha = 1;
  }
}

/** Renders the advertisement in real time (about its length). Must start from a user gesture. */
export async function renderStudioVideo(input: RenderInput): Promise<RenderOutput> {
  const mime = pickMime();
  if (!mime) throw new Error("recorder_unsupported");
  if (!input.scenes.length) throw new Error("no_scenes");
  const { w, h } = SIZES[input.aspect];
  const total = input.scenes.reduce((a, s) => Math.max(a, s.start + s.duration), 0);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unsupported");
  const audio = new AudioContext();
  const dest = audio.createMediaStreamDestination();
  // A silent constant source keeps the audio track alive when a scene has no narration.
  const silence = audio.createConstantSource();
  const mute = audio.createGain();
  mute.gain.value = 0;
  silence.connect(mute).connect(dest);
  const stream = new MediaStream([
    ...canvas.captureStream(30).getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);
  const { recorder, done } = recordStream(stream, mime.mimeType, 5_000_000);
  drawStudioFrame(ctx, input, w, h, 0);
  await audio.resume();
  recorder.start(250);
  const t0 = audio.currentTime + 0.05;
  silence.start(t0);
  const sources: AudioBufferSourceNode[] = [];
  for (const s of input.scenes) {
    if (!s.voice) continue;
    const src = audio.createBufferSource();
    src.buffer = s.voice;
    src.playbackRate.value = input.voiceRate ?? 1;
    src.connect(dest);
    src.start(t0 + s.start + 0.15);
    sources.push(src);
  }
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* not started */
      }
    });
    silence.stop();
    if (recorder.state !== "inactive") recorder.stop();
  };
  input.signal?.addEventListener("abort", stop);
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (stopped) return resolve();
      const t = audio.currentTime - t0;
      drawStudioFrame(ctx, input, w, h, Math.max(0, Math.min(total, t)));
      input.onProgress?.(Math.min(1, Math.max(0, t / total)));
      if (t >= total + 0.2) {
        stop();
        resolve();
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const blob = await done;
  await audio.close();
  if (input.signal?.aborted) throw new Error("cancelled");
  if (blob.size < 2000) throw new Error("render_empty");
  return {
    blob,
    mimeType: blob.type,
    extension: mime.extension,
    duration: total,
    width: w,
    height: h,
  };
}
