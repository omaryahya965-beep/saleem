// D176: finding grouping on the real Nada Cream V1 findings (manual test, 2026-11-20): five COM-01 rows from
// speech, caption and two frames must not read as five independent violations.
import { describe, expect, it } from "vitest";
import {
  claimFacet,
  diffGroups,
  groupFindings,
  groupKey,
  matchesFilter,
  type GroupableFinding,
} from "@/features/reports/grouping";

const f = (
  id: string,
  rule_code: string,
  severity: "violation" | "warning",
  evidence_type: string,
  evidence_text: string,
  t_start: number | null = null,
  status = "open",
): GroupableFinding => ({
  id,
  rule_code,
  severity,
  evidence_type,
  evidence_text,
  t_start,
  status,
  explanation_ar:
    rule_code === "COM-01" ? "ادعاء صحي مطلق أو مضمون النتيجة في محتوى ترويجي." : null,
});

export const NADA_V1: GroupableFinding[] = [
  f(
    "1",
    "COM-01",
    "violation",
    "transcript",
    "كريم ندى التجريبي يزيل التصبغات تماما خلال ثلاثة أيام فقط والنتيجة مضمونة لكل أنواع البشرة",
    0,
  ),
  f(
    "2",
    "COM-01",
    "violation",
    "caption",
    "ودّعي التصبغات مع كريم ندى! بشرة صافية خلال 3 أيام فقط، ونتائج مضمونة لجميع أنواع البشرة",
  ),
  f("3", "COM-01", "violation", "frame", "النتيجة مضمونة خلال ٣ أيام", 11),
  f(
    "4",
    "COM-01",
    "violation",
    "transcript",
    "والنتيجة مضمونة لكل أنواع البشرة بلا أي آثار جانبية",
    5.461,
  ),
  f("5", "COM-01", "violation", "frame", "النتيجة مضمونة خلال ٣ أيام", 15),
  f(
    "6",
    "MAW-01",
    "violation",
    "metadata",
    "تم تحديد «إعلان مدفوع»، ولا توجد كلمة «إعلان» في الوصف أو أول 5 ثوانٍ",
    0,
  ),
  f("7", "MAW-03", "warning", "metadata", "لا يوجد عقد مكتوب مع العلامة"),
  f("8", "MAW-04", "warning", "metadata", "لم يُدخل رقم رخصة موثوق"),
  f("9", "AI-01", "warning", "metadata", "تم تحديد «استخدمت الذكاء الاصطناعي» دون إفصاح في الوصف"),
];

describe("finding grouping", () => {
  it("consolidates repeated evidence but keeps distinct claims apart", () => {
    const groups = groupFindings(NADA_V1);
    const com = groups.filter((g) => g.ruleCode === "COM-01");
    // «complete removal / within three days» (speech, caption, two frames) and «no side effects» (speech).
    expect(com.map((g) => g.facet).sort()).toEqual(["absolute_or_fast_result", "no_side_effects"]);
    const fast = com.find((g) => g.facet === "absolute_or_fast_result")!;
    expect(fast.members.map((m) => m.id)).toEqual(["1", "3", "5", "2"]);
    expect(fast.sources.sort()).toEqual(["caption", "frame", "transcript"]);
    expect(fast.time).toBe(0);
    expect(groups).toHaveLength(6);
    // Every raw finding is in exactly one group.
    expect(groups.flatMap((g) => g.members.map((m) => m.id)).sort()).toEqual(
      NADA_V1.map((x) => x.id).sort(),
    );
  });

  it("orders violations first, then by time", () => {
    const g = groupFindings(NADA_V1);
    expect(g.slice(0, 3).every((x) => x.severity === "violation")).toBe(true);
    expect(g.at(-1)!.severity).toBe("warning");
  });

  it("keys are stable and whole-post rules collapse", () => {
    expect(groupKey(NADA_V1[2]!).key).toBe(groupKey(NADA_V1[4]!).key);
    expect(groupKey(NADA_V1[5]!).key).toBe("MAW-01");
    expect(claimFacet("بلا أي آثار جانبية")).toBe("no_side_effects");
    expect(claimFacet("نتيجة مضمونة")).toBe("guaranteed");
    expect(claimFacet("موافقة مضمونة على التمويل")).toBe("guaranteed_approval");
    expect(claimFacet("كريم مرطب للاستخدام اليومي")).toBeNull();
  });

  it("compares versions by key (Nada Cream V1 → V2: 7 rows no longer detected, MAW warnings remain)", () => {
    const v2 = [
      f("a", "MAW-03", "warning", "metadata", "لا يوجد عقد مكتوب مع العلامة"),
      f("b", "MAW-04", "warning", "metadata", "لم يُدخل رقم رخصة موثوق"),
    ];
    const d = diffGroups(NADA_V1, v2);
    expect(d.persistent.map((p) => p.after.ruleCode).sort()).toEqual(["MAW-03", "MAW-04"]);
    expect(d.added).toHaveLength(0);
    expect(d.noLongerDetected.flatMap((g) => g.members)).toHaveLength(7);
  });

  it("filters by review state", () => {
    const groups = groupFindings([
      f("x", "COM-01", "violation", "frame", "النتيجة مضمونة", 1, "not_required"),
      f("y", "AI-01", "warning", "metadata", "ai", null, "evidence_required"),
    ]);
    const answered = () => false;
    expect(groups.filter((g) => matchesFilter(g, "not_applicable", answered))).toHaveLength(1);
    expect(groups.filter((g) => matchesFilter(g, "needs_evidence", answered))).toHaveLength(1);
    expect(groups.filter((g) => matchesFilter(g, "resolved", answered))).toHaveLength(1);
    expect(groups.filter((g) => matchesFilter(g, "unanswered", answered))).toHaveLength(2);
  });
});
