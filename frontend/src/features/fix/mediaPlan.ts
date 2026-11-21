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
  evidence_text?: string | null;
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

/** Frames are sampled every few seconds, so a sighting says nothing about the seconds around it. */
export const FRAME_GAP_S = 6;
export const FRAME_PAD_S = 1.5;
const normText = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/[ً-ٟـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * D207: cover ranges for on-screen claims. Sightings of the SAME text up to FRAME_GAP_S apart are one continuous
 * appearance (the text stays on screen between sampled frames); each appearance is padded by FRAME_PAD_S and runs
 * to the end when its last sighting is near the end. Found on the Nada correction: covering only ±1 s around the
 * sampled frames left «النتيجة مضمونة خلال ٣ أيام» fully visible between 12 s and 14.5 s.
 */
export function coverRanges(findings: EditableFinding[], duration: number): Range[] {
  const byText = new Map<string, number[]>();
  for (const f of findings) {
    const t = num(f.t_start);
    if (f.evidence_type !== "frame" || t === null) continue;
    const key = normText(f.evidence_text) || `@${t}`;
    byText.set(key, [...(byText.get(key) ?? []), t]);
  }
  const out: Range[] = [];
  for (const times of byText.values()) {
    const ts = [...times].sort((a, b) => a - b);
    let start = ts[0]!;
    let last = ts[0]!;
    const close = () => {
      const end = duration - last <= FRAME_GAP_S / 2 ? duration : last + FRAME_PAD_S;
      out.push({ start: Math.max(0, start - FRAME_PAD_S), end: Math.min(duration, end) });
    };
    for (const t of ts.slice(1)) {
      if (t - last <= FRAME_GAP_S) last = t;
      else {
        close();
        start = t;
        last = t;
      }
    }
    close();
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
  const onScreen = mergeRanges(coverRanges(findings, duration), duration);
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
export function editsSummary(
  e: MediaEdits,
  voice: "none" | "recorded" | "uploaded" | "generated-local",
) {
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
