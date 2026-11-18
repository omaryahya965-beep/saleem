// Phase 8 step 4: evidence policy on findings, «الحزم المطبّقة ولماذا», reviewer checklist, duplicate reason.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IssueCard, type IssueView } from "@/components/ui";
import { I18nProvider } from "@/i18n";
import ar from "@/i18n/ar.json";
import type { ReportBundle } from "@/lib/api/data";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}));
const { RuleOutcomes } = await import("@/features/reports/RuleOutcomes");

const issue = (v2: Partial<NonNullable<IssueView["v2"]>>): IssueView => ({
  id: "f1",
  severity: "warning",
  time: 3,
  title: "x",
  ruleCode: "SA-SALE-002",
  ruleTitle: "الترخيص",
  sourceName: "ضوابط",
  sourceUrl: null,
  evidenceType: "caption",
  evidence: "خصم 50%",
  fix: "y",
  v2: {
    findingType: "potential_risk",
    draftRule: true,
    articleRef: "2",
    verification: "official_status_unconfirmed",
    missingInformation: null,
    carriedFromVersion: null,
    ...v2,
  },
});
const ui = (node: React.ReactNode) => render(<I18nProvider initialLang="ar">{node}</I18nProvider>);

describe("finding card: evidence policy", () => {
  it("shows the rule's evidence policy and the draft label", () => {
    ui(<IssueCard issue={issue({ evidencePolicy: "يكفي ظهور رقم الترخيص" })} />);
    expect(screen.getByTestId("evidence-policy")).toHaveTextContent("يكفي ظهور رقم الترخيص");
    expect(screen.getByText(ar.findingType.rule_draft)).toBeInTheDocument();
    expect(ar.findingType.rule_draft).toBe("قاعدة مسودة — قيد المراجعة القانونية");
  });
  it("hybrid: shows the evidence requested before a decision instead", () => {
    ui(<IssueCard issue={issue({ evidencePolicy: "p", evidenceRequest: "أرفق الترخيص" })} />);
    expect(screen.getByTestId("evidence-request")).toHaveTextContent("أرفق الترخيص");
    expect(screen.queryByTestId("evidence-policy")).toBeNull();
  });
});

describe("report: packs and checklist", () => {
  const bundle = {
    findings: [],
    run: {
      coverage: {
        status: "complete",
        items: [],
        packs: [
          {
            code: "sa-system",
            reason: "always_enabled",
            include_drafts: false,
            applicable: 3,
            not_applicable: 0,
          },
          {
            code: "sa-sale",
            reason: "org_enabled",
            include_drafts: true,
            applicable: 2,
            not_applicable: 3,
          },
        ],
      },
    },
    ruleChecks: [
      { id: 1, rule_id: "w", outcome: "unable_to_verify", reason_code: "reviewer_checklist" },
      {
        id: 2,
        rule_id: "d",
        outcome: "not_applicable",
        reason_code: "possible_duplicate:SAMA-ADV-01",
      },
      { id: 3, rule_id: "o", outcome: "not_applicable", reason_code: "context:sector" },
    ],
    rulesById: new Map([
      [
        "w",
        {
          code: "SA-SALE-009",
          title_ar: "سجل الأسعار",
          title_en: "x",
          evidence_policy_ar: "يطلب المراجع سجل الأسعار",
        },
      ],
      ["d", { code: "SA-BANK-001", title_ar: "المبالغة", title_en: "x" }],
      ["o", { code: "SA-RE-001", title_ar: "العقار", title_en: "x" }],
    ]),
  } as unknown as ReportBundle;

  it("lists the packs applied and why, the reviewer checklist, and why rules do not apply", () => {
    ui(<RuleOutcomes bundle={bundle} />);
    const packs = screen.getByTestId("packs-applied");
    expect(packs).toHaveTextContent(ar.report2.packReason.always_enabled);
    expect(packs).toHaveTextContent(ar.report2.packReason.org_enabled);
    expect(packs).toHaveTextContent(ar.report2.packDrafts);
    const list = screen.getByTestId("reviewer-checklist");
    expect(list).toHaveTextContent("سجل الأسعار");
    expect(list).toHaveTextContent("يطلب المراجع سجل الأسعار");
    expect(screen.queryByTestId("unable-list")).toBeNull(); // checklist items are not «تعذّر التحقق»
    const na = screen.getByTestId("not-applicable-list");
    expect(na).toHaveTextContent("تكرار محتمل للقاعدة SAMA-ADV-01");
    expect(na).toHaveTextContent(ar.report2.reason.context_sector);
  });
});
