import { describe, expect, it } from "vitest";
import { decideAudioMode, filterSegments, isHallucinationPhrase, shouldTranscribe } from "../supabase/functions/_shared/rules/speech.ts";

const seg = (text: string, m: { nsp?: number; lp?: number; cr?: number } = {}) => ({
  start: 0, end: 2, text, no_speech_prob: m.nsp ?? 0.05, avg_logprob: m.lp ?? -0.25, compression_ratio: m.cr ?? 1.2,
});

describe("isHallucinationPhrase", () => {
  it.each([
    "شكراً للمشاهدة",
    "شكرا على المشاهدة",
    "اشتركوا في القناة",
    "لا تنسوا الاشتراك في القناة",
    "ترجمة نانسي قنقر",
    "Subtitles by the Amara.org community",
    "Thank you for watching!",
    "[موسيقى]",
    "(Music)",
    "♪ ♪",
    "...",
  ])("flags %s", (t) => expect(isHallucinationPhrase(t)).toBe(true));
  it.each(["هذا الشاي ينحف وتنزلين خمس كيلو", "إعلان مدفوع بالتعاون مع متجر نخلة", "شكراً لمتجر نخلة على الهدية"])(
    "keeps real speech: %s",
    (t) => expect(isHallucinationPhrase(t)).toBe(false),
  );
});

describe("filterSegments", () => {
  it("drops music/silence by no_speech_prob + low logprob, keeps confident speech", () => {
    const r = filterSegments([seg("هلا والله يا جماعة"), seg("يا ليل يا عين", { nsp: 0.85, lp: -0.9 }), seg("ممم", { lp: -1.4 })]);
    expect(r.kept.map((s) => s.text)).toEqual(["هلا والله يا جماعة"]);
    expect(r.dropped.map((d) => d.reason)).toEqual(["no_speech_prob", "low_logprob"]);
  });
  it("drops repetition loops and hallucinated outros", () => {
    const r = filterSegments([seg("لا لا لا لا لا لا لا لا", { cr: 3.1 }), seg("شكراً للمشاهدة")]);
    expect(r.kept).toEqual([]);
    expect(r.dropped.map((d) => d.reason)).toEqual(["repetition", "hallucination_phrase"]);
  });
  it("is stricter when the probe suspected no speech", () => {
    const shaky = seg("كلمات غير واضحة", { nsp: 0.4, lp: -0.7 });
    expect(filterSegments([shaky]).kept).toHaveLength(1);
    expect(filterSegments([shaky], { strict: true }).kept).toHaveLength(0);
  });
  it("tolerates models without confidence fields", () => {
    expect(filterSegments([{ start: 0, end: 1, text: "إعلان مدفوع" }]).kept).toHaveLength(1);
  });
});

describe("audio mode decisions", () => {
  it("no audio stream → no_audio and no API call", () => {
    expect(decideAudioMode({ hasAudioStream: false, kept: [] })).toBe("no_audio");
    expect(shouldTranscribe({ has_audio: false, verdict: "silent" }, false)).toBe(false);
  });
  it("silent track → skip transcription; music with nothing reliable → music_no_speech", () => {
    expect(shouldTranscribe({ has_audio: true, verdict: "silent" }, true)).toBe(false);
    expect(shouldTranscribe({ has_audio: true, verdict: "no_speech_likely" }, true)).toBe(true);
    expect(decideAudioMode({ hasAudioStream: true, kept: [] })).toBe("music_no_speech");
    expect(decideAudioMode({ hasAudioStream: true, kept: [seg("آه")] })).toBe("music_no_speech");
  });
  it("speech with reliable words → speech", () => {
    expect(decideAudioMode({ hasAudioStream: true, kept: [seg("إعلان مدفوع بالتعاون")] })).toBe("speech");
    expect(shouldTranscribe(null, true)).toBe(true);
  });
});

import { runDeterministicChecks } from "../supabase/functions/_shared/rules/deterministic.ts";

describe("no-speech clips: disclosure must be written", () => {
  const sub = {
    id: "s", is_demo: false, kind: "video" as const, caption: "شاي التنحيف 🔥", platform: "tiktok", product_category: "health",
    is_paid_ad: true, has_written_contract: true, ai_used: false, mawthooq_license_no: "MW-1", status: "analyzing", progress: 0, current_step: "deterministic" as const,
  };
  it("explains written disclosure when there is no speech", () => {
    const r = runDeterministicChecks(sub, [], [{ t: 6, text: "ينحف ٥ كيلو في أسبوع" }], { audioMode: "music_no_speech" });
    const maw = r.findings.find((f) => f.rule_code === "MAW-01");
    expect(maw?.explanation_ar).toContain("بدون كلام");
    expect(maw?.fix_ar).toContain("على الشاشة");
    expect(maw?.explanation_en).toMatch(/no speech/);
  });
  it("on-screen «إعلان» in the first 5 s satisfies disclosure", () => {
    const r = runDeterministicChecks(sub, [], [{ t: 1, text: "إعلان مدفوع" }], { audioMode: "no_audio" });
    expect(r.findings.map((f) => f.rule_code)).not.toContain("MAW-01");
  });
  it("speech clips keep the spoken wording", () => {
    const r = runDeterministicChecks(sub, [{ start: 0, end: 3, text: "هلا والله" }], [], { audioMode: "speech" });
    expect(r.findings.find((f) => f.rule_code === "MAW-01")?.explanation_ar).not.toContain("بدون كلام");
  });
});
