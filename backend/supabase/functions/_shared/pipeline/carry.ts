// Carry-forward between versions (04_AI_PIPELINE §11). Pure: the analyze function persists the result.
import { normalizeArabic } from "../rules/arabic.ts";

export interface PrevFinding {
  id: string;
  rule_id: string | null;
  rule_code: string;
  finding_type: string | null;
  evidence_text: string | null;
  t_start: number | null;
  status: string;
}
export interface NextFinding {
  rule_id: string;
  rule_code: string;
  finding_type: string;
  quote: string;
  t_start: number | null;
}

export interface CarryResult {
  /** For each new finding: the previous finding it continues, or null. */
  carriedFrom: (string | null)[];
  /** Previous open/actioned/disputed findings with no match → resolved in the new version. */
  resolved: string[];
  /** New findings that reappear after a reviewer dismissed them or marked them not required. */
  previousDecisions: { nextIndex: number; prevId: string; status: string }[];
}

const OPEN = new Set(["open", "actioned", "disputed"]);
const DECIDED = new Set(["dismissed", "not_required"]);
const norm = (s: string | null) => normalizeArabic(s ?? "").slice(0, 160);

function sameIssue(p: PrevFinding, n: NextFinding): boolean {
  const sameRule = p.rule_id ? p.rule_id === n.rule_id || p.rule_code === n.rule_code : p.rule_code === n.rule_code;
  if (!sameRule) return false;
  if (p.finding_type && p.finding_type !== n.finding_type) return false;
  if (p.finding_type === "missing_required" && n.finding_type === "missing_required") return true;
  if (norm(p.evidence_text) && norm(p.evidence_text) === norm(n.quote)) return true;
  return p.t_start !== null && n.t_start !== null && Math.abs(p.t_start - n.t_start) <= 3;
}

export function matchCarryForward(prev: PrevFinding[], next: NextFinding[]): CarryResult {
  const used = new Set<string>();
  const carriedFrom: (string | null)[] = [];
  const previousDecisions: CarryResult["previousDecisions"] = [];
  next.forEach((n, i) => {
    const p = prev.find((x) => !used.has(x.id) && (OPEN.has(x.status) || DECIDED.has(x.status)) && sameIssue(x, n));
    if (!p) return carriedFrom.push(null);
    used.add(p.id);
    carriedFrom.push(p.id);
    if (DECIDED.has(p.status)) previousDecisions.push({ nextIndex: i, prevId: p.id, status: p.status });
  });
  const resolved = prev.filter((p) => OPEN.has(p.status) && !used.has(p.id)).map((p) => p.id);
  return { carriedFrom, resolved, previousDecisions };
}
