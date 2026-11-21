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
  { evidence_type: "frame", t_start: 11, t_end: null },
  { evidence_type: "frame", t_start: 15, t_end: null },
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
    expect(e.covers.map((c) => [c.start, c.end])).toEqual([
      [10.5, 12.5],
      [14.5, 15],
    ]);
    expect(e.overlays[0]).toMatchObject({ start: 0, end: 15, text: "إعلان مدفوع" });
    expect(e.subtitles).toHaveLength(2);
    expect(isMuted(e, 3)).toBe(true);
    expect(isMuted(e, 12)).toBe(false);
    expect(activeAt(e.covers, 11).length).toBe(1);
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
