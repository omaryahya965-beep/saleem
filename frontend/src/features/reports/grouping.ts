// Semantic grouping of findings (V2 upgrade §5.1, D176). Repeated evidence of the same claim — spoken, on
// screen, in several frames, in the caption — becomes one consolidated finding with all its evidence. Different
// claims under the same rule stay separate. Raw findings are never changed: a group only references them, so
// responses, decisions and integrity hashes keep working on the raw rows.
//
// The key is deterministic (rule + claim facet, or rule + normalised explanation) so the same claim gets the same
// key in every version — the comparison tab relies on that.

/** Minimal shape needed to group (DB findings and the public sample fixture both satisfy it). */
export interface GroupableFinding {
  id: string;
  rule_code: string;
  severity: "violation" | "warning";
  finding_type?: string | null;
  evidence_type: string;
  evidence_text: string | null;
  explanation_ar: string | null;
  explanation_en?: string | null;
  t_start: number | string | null;
  status?: string | null;
}

export interface FindingGroup<F extends GroupableFinding = GroupableFinding> {
  key: string;
  ruleCode: string;
  facet: ClaimFacet | null;
  severity: "violation" | "warning";
  members: F[];
  /** Earliest timestamp among the members (null when none has one). */
  time: number | null;
  /** Distinct evidence sources (transcript, frame, caption, metadata …). */
  sources: string[];
}

export type ClaimFacet =
  | "no_side_effects"
  | "absolute_or_fast_result"
  | "universal_result"
  | "guaranteed"
  | "cure"
  | "weight_loss"
  | "guaranteed_return"
  | "guaranteed_approval";

/** Same normalisation as the backend `normalizeArabic` (enough for matching): diacritics, alef/ya/ta marbuta, digits. */
export function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Ordered: the first matching facet wins, so one finding belongs to exactly one group.
const FACETS: { facet: ClaimFacet; re: RegExp }[] = [
  { facet: "guaranteed_approval", re: /(موافقه|قبول|تمويل) مضمون/ },
  {
    facet: "guaranteed_return",
    re: /(ربح|ارباح|عايد|عائد|دخل) (يومي )?مضمون|عايد يومي|ارباح يوميه/,
  },
  {
    facet: "no_side_effects",
    re: /(بلا|بدون|ما له|ما لها|خالي من|لا) (اي )?(اثار|اعراض) جانبي|no side effects?/,
  },
  {
    facet: "absolute_or_fast_result",
    re: /(يزيل|تزيل|يخفي|تخفي|يمحو|ازاله|اختفاء) .*(تماما|نهاييا|نهائيا|كليا|كامل)|خلال (\d+|يوم|يومين|ثلاث|ثلاثه|اربع|خمس|سبع|اسبوع|اسبوعين) ?(ايام|يوم|اسبوع|اسابيع|ساعات|ساعه)?|in \d+ days?/,
  },
  { facet: "cure", re: /(يعالج|تعالج|يشفي|تشفي)|علاج نهايي|شفاء تام/ },
  { facet: "weight_loss", re: /ينحف|يحرق الدهون|يذوب الدهون|تنزل(ين|ون|ي)? \S+ (كيلو|كغ|kg)/ },
  { facet: "universal_result", re: /(لكل|لجميع|كل) انواع البشره|for all skin types/ },
  { facet: "guaranteed", re: /مضمون|ضمان ?100|guarantee/ },
];

/** Rules that concern the whole post (one finding per rule however many times the evidence repeats). */
const WHOLE_POST = new Set(["MAW-01", "MAW-02", "MAW-03", "MAW-04", "AI-01"]);

export function claimFacet(text: string | null | undefined): ClaimFacet | null {
  if (!text) return null;
  const n = normalizeAr(text);
  return FACETS.find((f) => f.re.test(n))?.facet ?? null;
}

/** Stable group key for one finding. */
export function groupKey(f: GroupableFinding): { key: string; facet: ClaimFacet | null } {
  if (WHOLE_POST.has(f.rule_code)) return { key: f.rule_code, facet: null };
  const facet = claimFacet(f.evidence_text);
  if (facet) return { key: `${f.rule_code}|${facet}`, facet };
  // No recognised claim: the explanation (same wording ⇒ same issue), else the evidence itself.
  const basis = normalizeAr(f.explanation_ar || f.explanation_en || f.evidence_text || "").slice(
    0,
    80,
  );
  return { key: `${f.rule_code}|${f.finding_type ?? ""}|${basis}`, facet: null };
}

const time = (f: GroupableFinding) =>
  f.t_start === null || f.t_start === "" ? null : Number(f.t_start);

/** Groups findings; order: violations first, then by earliest time. */
export function groupFindings<F extends GroupableFinding>(findings: F[]): FindingGroup<F>[] {
  const map = new Map<string, FindingGroup<F>>();
  for (const f of findings) {
    const { key, facet } = groupKey(f);
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        ruleCode: f.rule_code,
        facet,
        severity: f.severity,
        members: [],
        time: null,
        sources: [],
      };
      map.set(key, g);
    }
    g.members.push(f);
    if (f.severity === "violation") g.severity = "violation";
    const t = time(f);
    if (t !== null && (g.time === null || t < g.time)) g.time = t;
    if (!g.sources.includes(f.evidence_type)) g.sources.push(f.evidence_type);
  }
  for (const g of map.values())
    g.members.sort((a, b) => (time(a) ?? Infinity) - (time(b) ?? Infinity));
  return [...map.values()].sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "violation" ? -1 : 1) ||
      (a.time ?? Infinity) - (b.time ?? Infinity) ||
      a.key.localeCompare(b.key),
  );
}

export interface GroupDiff<F extends GroupableFinding> {
  /** In the previous version, not detected in the current one (not the same as legally resolved). */
  noLongerDetected: FindingGroup<F>[];
  persistent: { before: FindingGroup<F>; after: FindingGroup<F> }[];
  added: FindingGroup<F>[];
}

/** Compares two versions by group key (stable across versions). */
export function diffGroups<F extends GroupableFinding>(before: F[], after: F[]): GroupDiff<F> {
  const a = groupFindings(before);
  const b = groupFindings(after);
  const bKeys = new Map(b.map((g) => [g.key, g]));
  const aKeys = new Set(a.map((g) => g.key));
  return {
    noLongerDetected: a.filter((g) => !bKeys.has(g.key)),
    persistent: a
      .filter((g) => bKeys.has(g.key))
      .map((g) => ({ before: g, after: bKeys.get(g.key)! })),
    added: b.filter((g) => !aKeys.has(g.key)),
  };
}

export type ReviewFilter =
  | "all"
  | "violations"
  | "warnings"
  | "unanswered"
  | "needs_correction"
  | "needs_evidence"
  | "confirmed"
  | "not_applicable"
  | "resolved";

const STATUS_OF: Record<
  Exclude<ReviewFilter, "all" | "violations" | "warnings" | "unanswered">,
  string[]
> = {
  needs_correction: ["actioned", "corrected", "clarification_required"],
  needs_evidence: ["evidence_required", "evidence_provided"],
  confirmed: ["actioned", "evidence_required", "clarification_required", "verified"],
  not_applicable: ["not_required", "dismissed"],
  resolved: ["resolved", "verified", "not_required", "dismissed"],
};

/** Status of a group: the "least done" member decides (one open member ⇒ open). */
export function groupStatus(g: FindingGroup): string {
  const order = [
    "open",
    "disputed",
    "clarification_required",
    "evidence_required",
    "evidence_provided",
    "actioned",
    "corrected",
    "verified",
    "not_required",
    "dismissed",
    "resolved",
  ];
  return (
    g.members
      .map((m) => m.status ?? "open")
      .sort((x, y) => order.indexOf(x) - order.indexOf(y))[0] ?? "open"
  );
}

export function matchesFilter(
  g: FindingGroup,
  filter: ReviewFilter,
  answered: (g: FindingGroup) => boolean,
): boolean {
  if (filter === "all") return true;
  if (filter === "violations") return g.severity === "violation";
  if (filter === "warnings") return g.severity === "warning";
  if (filter === "unanswered") return !answered(g);
  return STATUS_OF[filter].includes(groupStatus(g));
}
