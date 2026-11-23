// SALEEM Fix — deterministic in-browser renderer (D198). Plays the ORIGINAL video once, draws every frame onto a
// canvas with the edits (cover bands, disclosure overlay, subtitles; Arabic is shaped natively by the canvas), routes
// the original audio through a gain node that mutes the selected ranges (or all of it), mixes an optional corrected
// voiceover, and records canvas + audio with MediaRecorder. The result is a real, new media file; nothing is sent
// to any provider and nothing is charged. Rendering takes about the length of the video.
import { activeAt, isNoop, type MediaEdits } from "./mediaPlan";
import { recordStream, wrapText } from "@/lib/canvas";

export interface RenderResult {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
  duration: number;
  width: number;
  height: number;
}

/** Best container the browser can record: MP4 (H.264/AAC) when supported, else WebM. */
export function pickMime(): { mimeType: string; extension: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const [mimeType, extension] of [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ] as const)
    if (MediaRecorder.isTypeSupported(mimeType)) return { mimeType, extension };
  return null;
}

function drawBand(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  y: number,
  bandH: number,
  text: string,
  bg: string,
) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, y, w, bandH);
  if (!text) return;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(bandH * 0.42)}px "IBM Plex Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = /[؀-ۿ]/.test(text) ? "rtl" : "ltr";
  wrapText(ctx, text, w * 0.9, 3).forEach((line, i, all) =>
    ctx.fillText(line, w / 2, y + bandH / 2 + (i - (all.length - 1) / 2) * bandH * 0.45),
  );
  void h;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: CanvasImageSource,
  w: number,
  h: number,
  edits: MediaEdits,
  t: number,
) {
  ctx.drawImage(video, 0, 0, w, h);
  for (const c of activeAt(edits.covers, t)) {
    const bandH = h * 0.18;
    const y =
      c.position === "top" ? h * 0.08 : c.position === "bottom" ? h * 0.74 : (h - bandH) / 2;
    // Fully opaque: a cover must hide the misleading text completely (D207 — 0.92 let it show through).
    drawBand(ctx, w, h, y, bandH, c.text, "rgb(15, 23, 20)");
  }
  for (const o of activeAt(edits.overlays, t)) {
    const bandH = h * 0.07;
    drawBand(
      ctx,
      w,
      h,
      o.position === "top" ? h * 0.02 : h - bandH - h * 0.02,
      bandH,
      o.text,
      "rgba(11, 90, 60, 0.9)",
    );
  }
  for (const s of activeAt(edits.subtitles, t)) {
    const bandH = h * 0.12;
    drawBand(ctx, w, h, h - bandH - h * 0.11, bandH, s.text, "rgba(0, 0, 0, 0.62)");
  }
}

/**
 * Renders the corrected video. `sourceUrl` must be CORS-readable (Supabase signed URLs are) so the canvas is not
 * tainted. Must be started from a user gesture (audio playback).
 */
export async function renderCorrectedVideo(opts: {
  sourceUrl: string;
  edits: MediaEdits;
  voiceover?: Blob | null;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}): Promise<RenderResult> {
  if (isNoop(opts.edits) && !opts.voiceover) throw new Error("no_edits");
  const mime = pickMime();
  if (!mime) throw new Error("recorder_unsupported");
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.playsInline = true;
  video.src = opts.sourceUrl;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("source_unreadable"));
  });
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 1280;
  const duration = video.duration;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unsupported");

  const audio = new AudioContext();
  const dest = audio.createMediaStreamDestination();
  const source = audio.createMediaElementSource(video);
  const gain = audio.createGain();
  source.connect(gain).connect(dest);
  let voice: AudioBufferSourceNode | null = null;
  if (opts.voiceover) {
    const buf = await audio.decodeAudioData(await opts.voiceover.arrayBuffer());
    voice = audio.createBufferSource();
    voice.buffer = buf;
    voice.connect(dest);
  }
  const stream = new MediaStream([
    ...canvas.captureStream(30).getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);
  const { recorder, done } = recordStream(stream, mime.mimeType, 4_000_000);

  // Gain automation relative to the audio clock at play start.
  const schedule = (t0: number) => {
    gain.gain.setValueAtTime(opts.edits.replaceAudio ? 0 : 1, t0);
    if (!opts.edits.replaceAudio)
      for (const r of opts.edits.mute) {
        gain.gain.setValueAtTime(0, t0 + r.start);
        gain.gain.setValueAtTime(1, t0 + r.end);
      }
  };
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    video.pause();
    if (recorder.state !== "inactive") recorder.stop();
    voice?.stop();
  };
  opts.signal?.addEventListener("abort", stop);
  const tick = () => {
    if (stopped) return;
    drawFrame(ctx, video, w, h, opts.edits, video.currentTime);
    opts.onProgress?.(Math.min(1, video.currentTime / duration));
    if (video.ended) stop();
    else requestAnimationFrame(tick);
  };
  video.onended = () => {
    drawFrame(ctx, video, w, h, opts.edits, duration);
    setTimeout(stop, 120);
  };
  drawFrame(ctx, video, w, h, opts.edits, 0);
  recorder.start(250);
  await audio.resume();
  schedule(audio.currentTime);
  voice?.start(audio.currentTime);
  await video.play();
  requestAnimationFrame(tick);
  const blob = await done;
  await audio.close();
  if (opts.signal?.aborted) throw new Error("cancelled");
  if (blob.size < 1000) throw new Error("render_empty");
  return { blob, mimeType: blob.type, extension: mime.extension, duration, width: w, height: h };
}
