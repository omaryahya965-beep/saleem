// D198: SALEEM Fix media edits — defaults from findings, merging, subtitles, no-op detection.
import { describe, expect, it } from "vitest";
import {
  activeAt,
  defaultEdits,
  editsSummary,
  isMuted,
  isNoop,
  mergeRanges,
  subtitlesFor,
} from "@/features/fix/mediaPlan";

const NADA = [
  { evidence_type: "transcript", t_start: 0, t_end: 5.4 },
  { evidence_type: "transcript", t_start: 5.461, t_end: 10 },
  { evidence_type: "frame", evidence_text: "النتيجة مضمونة خلال ٣ أيام", t_start: 11, t_end: null },
  { evidence_type: "frame", evidence_text: "النتيجة مضمونة خلال ٣ أيام", t_start: 15, t_end: null },
  { evidence_type: "caption", t_start: null },
];

describe("media plan", () => {
  it("mutes spoken claims, covers on-screen ones and adds the disclosure (Nada Cream V1)", () => {
    const e = defaultEdits(NADA, 15, {
      disclosure: "إعلان مدفوع",
      replacement: "",
      script: "إعلان مدفوع. كريم ندى للعناية اليومية بالبشرة.",
    });
    expect(e.mute).toEqual([{ start: 0, end: 10 }]);
    // D207: one continuous cover — the claim stays on screen between the sampled frames.
    expect(e.covers.map((c) => [c.start, c.end])).toEqual([[9.5, 15]]);
    expect(e.overlays[0]).toMatchObject({ start: 0, end: 15, text: "إعلان مدفوع" });
    expect(e.subtitles).toHaveLength(2);
    expect(isMuted(e, 3)).toBe(true);
    expect(isMuted(e, 12)).toBe(false);
    expect(activeAt(e.covers, 11).length).toBe(1);
    expect(activeAt(e.covers, 13).length).toBe(1);
  });
  it("merges and clamps ranges", () => {
    expect(
      mergeRanges(
        [
          { start: 4, end: 6 },
          { start: -1, end: 2 },
          { start: 5, end: 30 },
        ],
        10,
      ),
    ).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 10 },
    ]);
  });
  it("spreads subtitles over the whole duration", () => {
    const s = subtitlesFor("جملة أولى. جملة ثانية أطول قليلاً!", 10);
    expect(s[0]!.start).toBe(0);
    expect(s.at(-1)!.end).toBe(10);
  });
  it("never offers an unchanged video as a correction", () => {
    expect(isNoop({ mute: [], covers: [], overlays: [], subtitles: [], replaceAudio: false })).toBe(
      true,
    );
    const e = defaultEdits([], 10, { disclosure: "", replacement: "", script: "" });
    expect(isNoop(e)).toBe(true);
    expect(editsSummary({ ...e, replaceAudio: true }, "recorded")).toMatchObject({
      audio: "replaced",
      voiceover: "recorded",
    });
  });
});

// D207: found by inspecting the corrected Nada video — the on-screen claim stayed visible between sampled frames.
import { coverRanges, defaultEdits as defaultEdits2 } from "@/features/fix/mediaPlan";
describe("cover ranges between sampled frames", () => {
  const claim = "النتيجة مضمونة خلال ٣ أيام";
  it("treats sightings of the same text ≤ 6 s apart as one appearance, through to the end", () => {
    const r = coverRanges(
      [
        { evidence_type: "frame", evidence_text: claim, t_start: 11 },
        { evidence_type: "frame", evidence_text: claim, t_start: 15 },
      ],
      15.17,
    );
    expect(r).toEqual([{ start: 9.5, end: 15.17 }]);
  });
  it("keeps different texts and distant sightings separate", () => {
    const r = coverRanges(
      [
        { evidence_type: "frame", evidence_text: "أ", t_start: 2 },
        { evidence_type: "frame", evidence_text: "أ", t_start: 20 },
        { evidence_type: "frame", evidence_text: "ب", t_start: 10 },
        { evidence_type: "transcript", evidence_text: "أ", t_start: 3 },
      ],
      60,
    );
    expect(r).toHaveLength(3);
    expect(r.find((x) => x.start === 0.5)).toEqual({ start: 0.5, end: 3.5 });
  });
  it("is what the editor proposes by default", () => {
    const e = defaultEdits2(
      [
        { evidence_type: "frame", evidence_text: claim, t_start: 11 },
        { evidence_type: "frame", evidence_text: claim, t_start: 15 },
      ],
      15.17,
      { disclosure: "إعلان مدفوع", replacement: "", script: "" },
    );
    expect(e.covers.map((c) => [c.start, c.end])).toEqual([[9.5, 15.17]]);
  });
});
