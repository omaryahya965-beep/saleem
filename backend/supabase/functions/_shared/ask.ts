// v2 Phase 7.4: Ask SALEEM helpers (pure). The assistant only reads with the caller's JWT and cites links.

export interface AskSource {
  kind: "rule" | "promotion" | "finding";
  id: string;
  title: string;
  detail: string;
  link: string;
}

const STOP = new Set(["ما", "هل", "كم", "عن", "في", "من", "على", "إلى", "the", "a", "an", "of", "in", "is", "are", "what", "how", "which", "for", "to", "و", "أو", "لماذا", "متى", "اين", "أين"]);

/** Search terms from a question (Arabic or English), longest first, at most five; rule codes kept as is. */
export function terms(question: string): string[] {
  const codes = question.match(/\b[A-Z]{2,6}-[A-Z0-9-]{1,12}\b/g) ?? [];
  const words = question
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^(ال|و|ب|ل|ف)(?=\p{L}{3,})/u, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
  return [...new Set([...codes, ...words])].sort((a, b) => b.length - a.length).slice(0, 5);
}

/** PostgREST `or` filter matching any term in the given columns (terms are sanitised for the filter grammar). */
export function orFilter(columns: string[], ts: string[]): string {
  const safe = ts.map((t) => t.replace(/[,()*%]/g, "")).filter(Boolean);
  return columns.flatMap((c) => safe.map((t) => `${c}.ilike.*${t}*`)).join(",");
}

/** Answer without a model: what was found, as numbered sources. */
export function plainAnswer(sources: AskSource[], lang: "ar" | "en"): string {
  if (!sources.length) return lang === "ar" ? "لم أجد ما يطابق سؤالك فيما يمكنك الاطلاع عليه." : "I found nothing matching your question in what you can access.";
  const head = lang === "ar" ? "هذا ما وجدته فيما يمكنك الاطلاع عليه:" : "This is what I found in what you can access:";
  return [head, ...sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.detail}`)].join("\n");
}

export const ASK_INSTRUCTIONS = `You answer questions for a marketing-compliance team using ONLY the numbered sources given.
Answer in the user's language, in at most 6 short sentences. Cite sources as [n]. If the sources do not answer the
question, say so. Never give legal advice, never invent rules, articles or numbers, never say something is approved.`;
