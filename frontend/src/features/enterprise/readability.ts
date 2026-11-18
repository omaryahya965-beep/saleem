// v2 Phase 7.7: Arabic readability hints. Advisory only — never a compliance finding.

export interface ReadabilityHint {
  kind: "long_sentence" | "dense_footnotes";
  words: number;
  excerpt: string;
}

const LONG_SENTENCE_WORDS = 35;
const FOOTNOTE_MARKER = /(\*{1,3}|†|‡|¹|²|³)/gu;
const TERMS = /(تطبق الشروط والأحكام|الشروط والأحكام|terms and conditions apply)/gi;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Very long sentences (> 35 words) and dense footnotes (3+ markers, or a footnote block over 60 words). */
export function readabilityHints(text: string): ReadabilityHint[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: ReadabilityHint[] = [];
  for (const s of clean.split(/(?<=[.!؟?؛;])\s+|\n+/)) {
    const n = words(s);
    if (n > LONG_SENTENCE_WORDS)
      out.push({
        kind: "long_sentence",
        words: n,
        excerpt: s.split(/\s+/).slice(0, 12).join(" ") + " …",
      });
  }
  const markers = (clean.match(FOOTNOTE_MARKER) ?? []).length + (clean.match(TERMS) ?? []).length;
  const firstMarker = clean.search(/(\*|†|‡|¹|²|³)/u);
  const tail = firstMarker >= 0 ? clean.slice(firstMarker) : "";
  if (markers >= 3 || (tail && words(tail) > 60)) {
    out.push({
      kind: "dense_footnotes",
      words: tail ? words(tail) : markers,
      excerpt: (tail || clean).split(/\s+/).slice(0, 12).join(" ") + " …",
    });
  }
  return out;
}
