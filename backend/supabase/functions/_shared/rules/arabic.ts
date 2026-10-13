// Arabic text normalization used by every deterministic matcher, so patterns and input are
// compared in the same canonical form.

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const ARABIC_INDIC = /[٠-٩]/g;
const PERSIAN_INDIC = /[۰-۹]/g;

/**
 * - strips harakat and tatweel
 * - unifies alef forms (أ إ آ ٱ → ا), ى → ي, ؤ → و, ئ → ي
 * - converts Arabic-Indic / Persian digits to Latin
 * - lowercases Latin and collapses whitespace
 * Keeps ة as-is (merging ة/ه causes false matches in claim phrases).
 */
export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[：]/g, ":")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
