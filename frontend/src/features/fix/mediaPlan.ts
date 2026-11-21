// SALEEM Fix media edits (V2 completion §15.4, D198) — pure timeline logic, unit-tested. The renderer
// (mediaRender.ts) applies these edits to the ORIGINAL footage in the browser; the original file is never changed.

export interface Range {
  start: number;
  end: number;
}
export interface CoverBand extends Range {
  /** Vertical position of the band covering on-screen text. */
  position: "top" | "middle" | "bottom";
  /** Replacement text shown on the band (may be empty: a plain band). */
  text: string;
}
export interface Overlay extends Range {
  text: string;
  position: "top" | "bottom";
}
export interface Subtitle extends Range {
  text: string;
}
export interface MediaEdits {
  mute: Range[];
  covers: CoverBand[];
  overlays: Overlay[];
  subtitles: Subtitle[];
  /** Replace the whole original audio with the voiceover (otherwise the voiceover plays over unmuted audio). */
  replaceAudio: boolean;
}

export interface EditableFinding {
  evidence_type: string;
  t_start: number | string | null;
  t_end?: number | string | null;
}

const num = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? null : Number(v);

/** Sorted, merged, clamped ranges (overlaps and touching ranges become one). */
export function mergeRanges(ranges: Range[], duration: number): Range[] {
  const xs = ranges
    .map((r) => ({
      start: Math.max(0, Math.min(r.start, duration)),
      end: Math.max(0, Math.min(r.end, duration)),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of xs) {
    const last = out.at(-1);
    if (last && r.start <= last.end + 0.1) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** Default edits from the findings: mute spoken claims, cover on-screen claims, add the disclosure. */
export function defaultEdits(
  findings: EditableFinding[],
  duration: number,
  opts: { disclosure: string; replacement: string; script: string },
): MediaEdits {
  const spoken = findings
    .filter((f) => f.evidence_type === "transcript" && num(f.t_start) !== null)
    .map((f) => ({ start: num(f.t_start)!, end: num(f.t_end) ?? num(f.t_start)! + 3 }));
  const onScreen = mergeRanges(
    findings
      .filter((f) => f.evidence_type === "frame" && num(f.t_start) !== null)
      .map((f) => ({
        start: Math.max(0, num(f.t_start)! - 0.5),
        end: num(f.t_end) ?? num(f.t_start)! + 1.5,
      })),
    duration,
  );
  return {
    mute: mergeRanges(spoken, duration),
    covers: onScreen.map((r) => ({ ...r, position: "middle", text: opts.replacement })),
    overlays: opts.disclosure.trim()
      ? [{ start: 0, end: duration, text: opts.disclosure.trim(), position: "top" }]
      : [],
    subtitles: subtitlesFor(opts.script, duration),
    replaceAudio: false,
  };
}

/** Splits a script into sentences and spreads them over the duration in proportion to their length. */
export function subtitlesFor(script: string, duration: number): Subtitle[] {
  const parts = script
    .split(/(?<=[.!?؟۔])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length || duration <= 0) return [];
  const total = parts.reduce((a, s) => a + s.length, 0);
  let t = 0;
  return parts.map((text) => {
    const len = (text.length / total) * duration;
    const s = {
      start: Number(t.toFixed(2)),
      end: Number(Math.min(duration, t + len).toFixed(2)),
      text,
    };
    t += len;
    return s;
  });
}

/** What is visible / audible at time t (used by the renderer and the preview). */
export function activeAt<T extends Range>(items: T[], t: number): T[] {
  return items.filter((x) => t >= x.start && t < x.end);
}
export const isMuted = (edits: MediaEdits, t: number) =>
  edits.replaceAudio || activeAt(edits.mute, t).length > 0;

/** True when the edits change nothing (the result would be the original video — never offered as a correction). */
export function isNoop(e: MediaEdits): boolean {
  return (
    !e.mute.length &&
    !e.covers.length &&
    !e.overlays.length &&
    !e.subtitles.length &&
    !e.replaceAudio
  );
}

/** Human-readable summary stored with the correction job (audit). */
export function editsSummary(e: MediaEdits, voice: "none" | "recorded" | "uploaded") {
  return {
    muted_ranges: e.mute.map((r) => [r.start, r.end]),
    covered_ranges: e.covers.map((r) => [r.start, r.end, r.position]),
    overlays: e.overlays.map((o) => o.text),
    subtitles: e.subtitles.length,
    audio: e.replaceAudio ? "replaced" : e.mute.length ? "partially_muted" : "original",
    voiceover: voice,
    renderer: "browser-canvas-mediarecorder",
  };
}
