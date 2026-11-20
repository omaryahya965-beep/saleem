// Sentence-level comparison for Arabic and English (V2 upgrade §16.3, D181): two readable panels instead of a
// mixed inline word diff. Sentences are matched after light normalisation (diacritics, digits, punctuation).
import { normalizeAr } from "@/features/reports/grouping";

export type SentenceOp = { op: "same" | "added" | "removed"; text: string };

export function splitSentences(s: string): string[] {
  return s
    .replace(/\r/g, "")
    .split(/(?<=[.!?؟۔…])\s+|\n+|(?<=،)\s+(?=\S{12,})/u)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** LCS over normalised sentences → previous side (same/removed) and current side (same/added). */
export function sentenceDiff(a: string, b: string): { before: SentenceOp[]; after: SentenceOp[] } {
  const A = splitSentences(a);
  const B = splitSentences(b);
  const na = A.map(normalizeAr);
  const nb = B.map(normalizeAr);
  const m = A.length;
  const n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i]![j] =
        na[i] === nb[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const before: SentenceOp[] = [];
  const after: SentenceOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (na[i] === nb[j]) {
      before.push({ op: "same", text: A[i]! });
      after.push({ op: "same", text: B[j]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) before.push({ op: "removed", text: A[i++]! });
    else after.push({ op: "added", text: B[j++]! });
  }
  while (i < m) before.push({ op: "removed", text: A[i++]! });
  while (j < n) after.push({ op: "added", text: B[j++]! });
  return { before, after };
}
