// Pure helpers for comments and version compare (Phase 4). No dependency: a small LCS word diff.

export type DiffOp = { op: "same" | "added" | "removed"; text: string };

/** Splits into words and whitespace so the diff can be re-joined exactly. */
export const tokenize = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];

/** Word-level diff (LCS). Fine for ad copy (a few hundred words); falls back to replace-all above 2,000 tokens. */
export function wordDiff(a: string, b: string): DiffOp[] {
  const x = tokenize(a);
  const y = tokenize(b);
  if (x.length * y.length > 4_000_000)
    return (
      [
        { op: "removed", text: a },
        { op: "added", text: b },
      ] as DiffOp[]
    ).filter((d) => d.text);
  const dp: number[][] = Array.from({ length: x.length + 1 }, () =>
    new Array<number>(y.length + 1).fill(0),
  );
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      dp[i]![j] = x[i] === y[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: DiffOp[] = [];
  const push = (op: DiffOp["op"], text: string) => {
    const last = out.at(-1);
    if (last && last.op === op) last.text += text;
    else out.push({ op, text });
  };
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      push("same", x[i]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) push("removed", x[i++]!);
    else push("added", y[j++]!);
  }
  while (i < x.length) push("removed", x[i++]!);
  while (j < y.length) push("added", y[j++]!);
  return out;
}

export type Anchor =
  | { kind: "image"; x: number; y: number }
  | { kind: "pdf"; page: number; x: number; y: number }
  | { kind: "video"; t: number }
  | { kind: "text"; start: number; end: number; quote: string };

const clamp01 = (n: number) => Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));

/** Click position inside an element → ratios in [0, 1] (stable under resize and zoom). */
export function ratioFromClick(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
) {
  return {
    x: clamp01((clientX - rect.left) / Math.max(1, rect.width)),
    y: clamp01((clientY - rect.top) / Math.max(1, rect.height)),
  };
}

/** Text anchor from a selection inside the caption (offsets on the text as displayed). */
export function textAnchor(text: string, start: number, end: number): Anchor | null {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(text.length, Math.max(start, end));
  if (e <= s) return null;
  return { kind: "text", start: s, end: e, quote: text.slice(s, e).slice(0, 200) };
}

export function isAnchor(a: unknown): a is Anchor {
  if (!a || typeof a !== "object") return false;
  const o = a as Record<string, unknown>;
  const r = (v: unknown) => typeof v === "number" && v >= 0 && v <= 1;
  if (o["kind"] === "image") return r(o["x"]) && r(o["y"]);
  if (o["kind"] === "pdf")
    return typeof o["page"] === "number" && o["page"] >= 1 && r(o["x"]) && r(o["y"]);
  if (o["kind"] === "video") return typeof o["t"] === "number" && o["t"] >= 0;
  if (o["kind"] === "text")
    return typeof o["start"] === "number" && typeof o["end"] === "number" && o["end"] > o["start"];
  return false;
}

export interface DiffFinding {
  id: string;
  rule_code: string;
  finding_type: string | null;
  carried_from_finding_id: string | null;
  resolved_in_submission_id: string | null;
}

/**
 * Findings diff between version A (older) and B (newer): fixed in B, still present, new in B.
 * Uses the carry-forward links when B directly follows A, else matches by rule and finding type.
 */
export function findingsDiff(a: DiffFinding[], b: DiffFinding[], bId: string) {
  const key = (f: DiffFinding) => `${f.rule_code}|${f.finding_type ?? ""}`;
  const linked =
    b.some((f) => f.carried_from_finding_id) || a.some((f) => f.resolved_in_submission_id === bId);
  const aIds = new Set(a.map((f) => f.id));
  const remaining = linked
    ? b.filter((f) => f.carried_from_finding_id && aIds.has(f.carried_from_finding_id))
    : b.filter((f) => a.some((x) => key(x) === key(f)));
  const added = b.filter((f) => !remaining.includes(f));
  const kept = new Set(
    linked
      ? remaining.map((f) => f.carried_from_finding_id)
      : a.filter((x) => b.some((f) => key(f) === key(x))).map((x) => x.id),
  );
  const fixed = a.filter((f) => !kept.has(f.id));
  return { fixed, remaining, added };
}
