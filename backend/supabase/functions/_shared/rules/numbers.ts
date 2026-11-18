// Numbers in ad text (v2). Pure: runs in Deno and Vitest.
// Handles Arabic-Indic / Eastern digits, Arabic decimal «٫» and thousands «٬»/«,», percent «٪»/«%»,
// currencies and durations. Spelled-out Arabic numbers are out of scope (04_AI_PIPELINE §4).

export type NumberUnit = "percent" | "SAR" | "USD" | "EUR" | "months" | "years" | null;

export interface ExtractedNumber {
  value: number;
  unit: NumberUnit;
  raw: string;
  /** Index of the match in the digit-normalised text. */
  index: number;
}

/** Converts digits to ASCII and joins thousands/decimal separators inside numbers. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/(\d)٫(\d)/g, "$1.$2")
    .replace(/(\d)[٬,](\d{3})(?!\d)/g, "$1$2")
    .replace(/(\d)[٬,](\d{3})(?!\d)/g, "$1$2")
    .replace(/٪/g, "%");
}

const UNIT_AFTER: [RegExp, NumberUnit][] = [
  [/^\s*(%|بالمئة|بالمائة|بالمية|في المئة|في المائة|percent)/i, "percent"],
  [/^\s*(ريال|ر\.?\s?س|sar|⃁|﷼)/i, "SAR"],
  [/^\s*(دولار|usd|\$)/i, "USD"],
  [/^\s*(يورو|eur|€)/i, "EUR"],
  [/^\s*(شهر|اشهر|أشهر|شهور|months?)/i, "months"],
  [/^\s*(سنة|سنه|سنوات|سنين|عام|اعوام|أعوام|years?)/i, "years"],
];

/** Extracts numbers with their unit (just after the number, or `$`/`€` just before it). */
export function extractNumbers(text: string): ExtractedNumber[] {
  const s = normalizeDigits(text);
  const out: ExtractedNumber[] = [];
  const re = /(\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 14);
    const before = s.slice(Math.max(0, m.index - 2), m.index);
    let unit: NumberUnit = null;
    for (const [pat, u] of UNIT_AFTER) {
      if (pat.test(after)) {
        unit = u;
        break;
      }
    }
    if (!unit && /\$\s?$/.test(before)) unit = "USD";
    if (!unit && /€\s?$/.test(before)) unit = "EUR";
    out.push({ value: Number(m[0]), unit, raw: m[0], index: m.index });
  }
  return out;
}

/** Months for a duration number (years × 12); null for other units. */
export const toMonths = (n: ExtractedNumber): number | null =>
  n.unit === "months" ? n.value : n.unit === "years" ? n.value * 12 : null;

/** Equal to 2 decimals (APR comparison; tolerance in percentage points, default 0). */
export const sameRate = (a: number, b: number, tolerance = 0) =>
  Math.abs(Math.round(a * 100) - Math.round(b * 100)) <= Math.round(tolerance * 100);
