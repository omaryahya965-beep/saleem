// Client-side media inspection and validation for uploads.

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 90;

export const ACCEPT = {
  video: ["video/mp4", "video/quicktime", "video/webm"],
  image: ["image/jpeg", "image/png", "image/webp"],
} as const;

export type MediaKind = keyof typeof ACCEPT;

export type MediaError =
  | { code: "type" }
  | { code: "size"; bytes: number }
  | { code: "duration"; seconds: number }
  | { code: "read" };

export interface InspectedMedia {
  file: File;
  kind: MediaKind;
  bytes: number;
  /** Seconds, video only. */
  duration: number | null;
  width: number | null;
  height: number | null;
  /** Object URL of a JPEG poster frame (video) or the image itself. Revoke when done. */
  previewUrl: string | null;
}

/** Pure validation of type and size (duration needs the decoded media). */
export function validateBasics(
  file: { type: string; size: number; name: string },
  kind: MediaKind,
): MediaError | null {
  const allowed: readonly string[] = ACCEPT[kind];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extOk =
    kind === "video"
      ? ["mp4", "mov", "webm"].includes(ext)
      : ["jpg", "jpeg", "png", "webp"].includes(ext);
  if (!allowed.includes(file.type) && !(file.type === "" && extOk)) return { code: "type" };
  if (file.size > MAX_FILE_BYTES) return { code: "size", bytes: file.size };
  return null;
}

export function validateDuration(seconds: number): MediaError | null {
  return seconds > MAX_VIDEO_SECONDS + 0.5 ? { code: "duration", seconds } : null;
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("video decode failed"));
    v.src = url;
  });
}

/**
 * Some files (notably WebM from MediaRecorder) report duration = Infinity until the browser
 * has scanned to the end. Seeking far ahead forces the real duration to be computed.
 */
export async function resolveDuration(v: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(v.duration)) return v.duration;
  await new Promise<void>((resolve) => {
    const done = () => {
      if (!Number.isFinite(v.duration)) return;
      v.removeEventListener("durationchange", done);
      resolve();
    };
    v.addEventListener("durationchange", done);
    v.currentTime = 1e101;
    setTimeout(resolve, 5000);
  });
  v.currentTime = 0;
  return Number.isFinite(v.duration) ? v.duration : NaN;
}

export function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      resolve();
    };
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.8): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}

/** Draws the current video frame scaled so the long side is ≤ maxSide. */
export async function grabFrame(
  v: HTMLVideoElement,
  maxSide = 768,
  quality = 0.8,
): Promise<Blob | null> {
  const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(v.videoWidth * scale);
  canvas.height = Math.round(v.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, quality);
}

/** Validates and inspects a file. Resolves with media info or a typed error. */
export async function inspectMedia(
  file: File,
  kind: MediaKind,
): Promise<{ ok: true; media: InspectedMedia } | { ok: false; error: MediaError }> {
  const basic = validateBasics(file, kind);
  if (basic) return { ok: false, error: basic };

  const url = URL.createObjectURL(file);
  try {
    if (kind === "image") {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      return {
        ok: true,
        media: {
          file,
          kind,
          bytes: file.size,
          duration: null,
          width: img.naturalWidth,
          height: img.naturalHeight,
          previewUrl: url,
        },
      };
    }
    const v = await loadVideo(url);
    const duration = await resolveDuration(v);
    if (!Number.isFinite(duration)) {
      URL.revokeObjectURL(url);
      return { ok: false, error: { code: "read" } };
    }
    const durationError = validateDuration(duration);
    if (durationError) {
      URL.revokeObjectURL(url);
      return { ok: false, error: durationError };
    }
    await seek(v, Math.min(0.5, duration / 2));
    const poster = await grabFrame(v, 480, 0.75);
    URL.revokeObjectURL(url);
    return {
      ok: true,
      media: {
        file,
        kind,
        bytes: file.size,
        duration,
        width: v.videoWidth,
        height: v.videoHeight,
        previewUrl: poster ? URL.createObjectURL(poster) : null,
      },
    };
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, error: { code: "read" } };
  }
}
