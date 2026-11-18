import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IssueCard, type IssueView } from "@/components/ui";
import { I18nProvider } from "@/i18n";
import ar from "@/i18n/ar.json";
import en from "@/i18n/en.json";
import { coverageGaps, reasonKey } from "@/features/reports/model";
import type { ReportBundle } from "@/lib/api/data";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}));
const { CoverageBanner, RuleOutcomes } = await import("@/features/reports/RuleOutcomes");

/** Strings that imply approval by SALEEM or a regulator (00_MASTER_PROMPT §2.1 rule 3). */
const FORBIDDEN = [
  /متوافق\s*100/,
  /\bcompliant\b/i,
  /معتمد من البنك المركزي/,
  /approved by sama/i,
  /مطابق للأنظمة/,
  /جاهز للنشر/,
  /ready to publish/i,
];

function strings(o: unknown): string[] {
  if (typeof o === "string") return [o];
  if (o && typeof o === "object") return Object.values(o).flatMap(strings);
  return [];
}

describe("copy rules", () => {
  it("no forbidden approval wording in ar.json or en.json", () => {
    const hits = [...strings(ar), ...strings(en)].filter((s) => FORBIDDEN.some((re) => re.test(s)));
    expect(hits).toEqual([]);
  });
  it("the advisory line exists in both languages", () => {
    expect(ar.promo.advisory).toBe("هذه نتيجة فحص آلي استرشادي، والاعتماد قرار يتخذه مسؤول مخوّل.");
    expect(en.promo.advisory).toMatch(/advisory/);
  });
});

const issue: IssueView = {
  id: "f1",
  severity: "warning",
  time: null,
  title: "لم يذكر الإعلان معدل النسبة السنوي.",
  ruleCode: "SAMA-ADV-03-8",
  ruleTitle: "معدل النسبة السنوي ومدة التمويل",
  sourceName: "ضوابط الإعلان",
  sourceUrl: "https://rulebook.sama.gov.sa/en/node/1715",
  evidenceType: "caption",
  evidence: "تمويل شخصي",
  fix: "أضف معدل النسبة السنوي.",
  v2: {
    findingType: "missing_required",
    draftRule: true,
    articleRef: "3.8",
    verification: "official_text_opened",
    missingInformation: "معدل النسبة السنوي",
    carriedFromVersion: 1,
  },
};

describe("finding card v2", () => {
  for (const lang of ["ar", "en"] as const) {
    it(`shows type, draft label, article, verification and carried badge (${lang})`, () => {
      render(
        <I18nProvider initialLang={lang}>
          <IssueCard issue={issue} />
        </I18nProvider>,
      );
      const d = lang === "ar" ? ar : en;
      expect(screen.getByText(d.findingType.missing_required)).toBeInTheDocument();
      expect(screen.getByText(d.findingType.rule_draft)).toBeInTheDocument();
      expect(screen.getByTestId("citation")).toHaveTextContent("3.8");
      expect(screen.getByText(d.findingType.verification.official_text_opened)).toBeInTheDocument();
      expect(screen.getByText(d.findingType.carried.replace("{n}", "1"))).toBeInTheDocument();
    });
  }
  it("legacy findings (no type) show the legacy label", () => {
    render(
      <I18nProvider initialLang="ar">
        <IssueCard
          issue={{ ...issue, v2: { ...issue.v2!, findingType: null, draftRule: false } }}
        />
      </I18nProvider>,
    );
    expect(screen.getByText(ar.findingType.legacy)).toBeInTheDocument();
  });
});

const bundle = {
  findings: [],
  run: {
    coverage: {
      status: "partial",
      items: [
        { modality: "model", state: "invalid" },
        { modality: "caption", state: "present" },
      ],
    },
  },
  ruleChecks: [
    { id: 1, rule_id: "r1", outcome: "not_applicable", reason_code: "context:product_type" },
    { id: 2, rule_id: "r2", outcome: "not_applicable", reason_code: "draft_excluded" },
    { id: 3, rule_id: "r3", outcome: "unable_to_verify", reason_code: "model_output_invalid" },
    {
      id: 4,
      rule_id: "r4",
      outcome: "not_applicable",
      reason_code: "trigger_absent:mentions_free",
    },
  ],
  rulesById: new Map([
    [
      "r1",
      {
        code: "SAMA-ADV-03-8",
        title_ar: "معدل النسبة السنوي ومدة التمويل",
        title_en: "APR and finance term",
      },
    ],
    ["r3", { code: "SAMA-ADV-01", title_ar: "الوضوح وعدم المبالغة", title_en: "Clarity" }],
  ]),
} as unknown as ReportBundle;

describe("rule outcomes and coverage", () => {
  it("lists non-applicable and unverified rules with Arabic reasons", () => {
    render(
      <I18nProvider initialLang="ar">
        <RuleOutcomes bundle={bundle} />
      </I18nProvider>,
    );
    expect(screen.getByTestId("not-applicable-list")).toHaveTextContent(
      ar.report2.reason.context_product_type,
    );
    expect(screen.getByTestId("not-applicable-list")).toHaveTextContent("ذكر المجاني أو بدون رسوم");
    expect(screen.getByTestId("unable-list")).toHaveTextContent(
      ar.report2.reason.model_output_invalid,
    );
  });
  it("partial coverage banner lists the gaps; drafts excluded shows the call to action", () => {
    render(
      <I18nProvider initialLang="ar">
        <CoverageBanner bundle={bundle} />
      </I18nProvider>,
    );
    expect(screen.getByTestId("coverage-banner")).toHaveTextContent(ar.report2.coverage_partial);
    expect(screen.getByTestId("coverage-banner")).toHaveTextContent(ar.report2.modality.model);
    expect(screen.getByTestId("draft-cta")).toBeInTheDocument();
  });
  it("helpers", () => {
    expect(reasonKey("context:sector").key).toBe("report2.reason.context_sector");
    expect(reasonKey("trigger_absent:promo_offer")).toEqual({
      key: "report2.reason.trigger_absent",
      signal: "promo_offer",
    });
    expect(
      coverageGaps({
        status: "partial",
        items: [
          { modality: "frames", state: "analyzed:0/12" },
          { modality: "audio", state: "speech" },
        ],
      }),
    ).toHaveLength(1);
  });
});
