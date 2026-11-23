// Shared canvas/recording helpers for the two in-browser video renderers (smart correction media edit and the
// AI Studio).

/**
 * Splits text into lines that fit `max` pixels with the context's current font, keeping at most `maxLines`.
 * With `ellipsis`, a truncated last line ends with «…».
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  max: number,
  maxLines: number,
  ellipsis = false,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  if (ellipsis) kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}

/** Records a canvas+audio stream; `done` resolves with the whole recording once the recorder stops. */
export function recordStream(
  stream: MediaStream,
  mimeType: string,
  videoBitsPerSecond: number,
): { recorder: MediaRecorder; done: Promise<Blob> } {
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>(
    (resolve) =>
      (recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }))),
  );
  return { recorder, done };
}
