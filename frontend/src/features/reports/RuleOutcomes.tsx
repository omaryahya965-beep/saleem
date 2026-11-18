import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Info,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import type { ReportBundle } from "@/lib/api/data";
import { coverageGaps, reasonKey, type CoverageView } from "./model";

type CheckRow = ReportBundle["ruleChecks"][number];

function outcomeCounts(checks: CheckRow[]) {
  const m = { passed: 0, failed: 0, unable_to_verify: 0, not_applicable: 0 };
  for (const c of checks) {
    const o = c.outcome as keyof typeof m;
    if (o in m) m[o]++;
  }
  return m;
}

function coverageOf(bundle: ReportBundle): CoverageView | null {
  const run = bundle.run;
  if (!run?.coverage || typeof run.coverage !== "object") return null;
  const cov = run.coverage as Partial<CoverageView>;
  if (cov.status !== "complete" && cov.status !== "partial") return null;
  return cov as CoverageView;
}

function stateLabel(t: (k: TKey, v?: Record<string, string | number>) => string, state: string) {
  const [name, arg] = state.split(":");
  if (name === "analyzed" && arg) {
    const [n, m] = arg.split("/");
    return t("report2.state.analyzed", { n: n ?? "0", m: m ?? "0" });
  }
  if (name === "batch_failed") return t("report2.state.batch_failed", { n: arg ?? "1" });
  return t(`report2.state.${name}` as TKey);
}

/** Coverage banner (first thing above the findings) and the draft-rules call to action. */
export function CoverageBanner({ bundle }: { bundle: ReportBundle }) {
  const { t } = useI18n();
  const coverage = coverageOf(bundle);
  const draftExcluded = bundle.ruleChecks.some((c) => c.reason_code === "draft_excluded");
  if (!coverage && !draftExcluded) return null;
  const gaps = coverageGaps(coverage);
  return (
    <div className="flex flex-col gap-3">
      {coverage && (
        <div
          role="status"
          data-testid="coverage-banner"
          className={
            coverage.status === "partial"
              ? "rounded-md border border-amber/30 bg-amber-bg px-4 py-3 text-sm"
              : "flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm"
          }
        >
          {coverage.status === "partial" ? (
            <>
              <p className="flex items-center gap-2 font-bold text-amber-text">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                {t("report2.coverage_partial")}
              </p>
              <p className="mt-1 text-fg">{t("report2.coveragePartialBody")}</p>
              <ul className="mt-2 list-inside list-disc text-fg">
                {gaps.map((g) => (
                  <li key={g.modality}>
                    {t(`report2.modality.${g.modality}` as TKey)}: {stateLabel(t, g.state)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <ShieldCheck aria-hidden="true" className="size-4 text-green" />
              <span className="font-medium text-fg">{t("report2.coverage_complete")}</span>
            </>
          )}
        </div>
      )}
      {draftExcluded && (
        <div
          data-testid="draft-cta"
          className="flex flex-col gap-2 rounded-md border border-border bg-sunken px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-bold text-fg">{t("report2.draftCtaTitle")}</p>
            <p className="mt-1 text-fg-muted">{t("report2.draftCtaBody")}</p>
          </div>
          <Button asChild size="sm" variant="secondary" icon={<BookOpen />}>
            <Link to="/rules" search={{ q: undefined }}>
              {t("report2.draftCtaAction")}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/** Per-rule outcomes & «القواعد والحزم المطبقة ولماذا». */
export function RuleOutcomes({ bundle }: { bundle: ReportBundle }) {
  const { t, lang } = useI18n();
  const checks = bundle.ruleChecks;

  const counts = outcomeCounts(checks);
  const title = (ruleId: string) => {
    const r = bundle.rulesById.get(ruleId);
    return r ? `${r.code} · ${lang === "en" ? r.title_en : r.title_ar}` : ruleId;
  };

  const reason = (code: string | null) => {
    const { key, signal, code: dup } = reasonKey(code);
    if (dup) return t(key, { code: dup });
    return t(key, signal ? { signal: t(`report2.signal.${signal}` as TKey) } : undefined);
  };

  const checklist = checks.filter((c) => c.reason_code === "reviewer_checklist");
  const policy = (ruleId: string) =>
    (bundle.rulesById.get(ruleId) as { evidence_policy_ar?: string | null } | undefined)
      ?.evidence_policy_ar ?? null;

  const packs = coverageOf(bundle)?.packs ?? [];

  // Internal company rules identified in findings
  const companyFindings = bundle.findings.filter(
    (f) =>
      f.rule_code.startsWith("INT-") ||
      (f.citation as { internal_policy?: boolean })?.internal_policy,
  );

  const list = (
    outcome: "not_applicable" | "unable_to_verify",
    heading: string,
    testId: string,
  ) => {
    const rows = checks.filter(
      (c) => c.outcome === outcome && c.reason_code !== "reviewer_checklist",
    );
    if (!rows.length) return null;
    return (
      <details
        data-testid={testId}
        className="rounded-lg border border-border bg-surface px-4 py-3"
      >
        <summary className="cursor-pointer font-bold text-fg">
          {heading} ({rows.length})
        </summary>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-0.5 border-b border-border/40 pb-1.5 last:border-b-0"
            >
              <span className="text-fg font-medium">
                <bdi>{title(c.rule_id)}</bdi>
              </span>
              <span className="text-xs text-fg-muted">{reason(c.reason_code)}</span>
            </li>
          ))}
        </ul>
      </details>
    );
  };

  return (
    <section
      aria-labelledby="rule-outcomes"
      className="flex flex-col gap-4 border-t border-border pt-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="rule-outcomes" className="text-xl font-bold flex items-center gap-2 text-fg">
          <Layers className="size-5 text-green" />
          القواعد والحزم المطبقة ولماذا
        </h2>
        <p className="text-xs text-fg-muted">
          تفصيل شامل للحزم والأنظمة السعودية وقواعد الشركة التي تم فحص الإعلان بموجبها وأسباب
          انطباقها أو استبعادها.
        </p>
      </div>

      {/* Outcome count badges */}
      {checks.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="inverse">
            مخالفات وملاحظات رُصدت: <bdi className="font-bold">{counts.failed}</bdi>
          </Badge>
          <Badge variant="green">
            قواعد محققة بنجاح: <bdi className="font-bold">{counts.passed}</bdi>
          </Badge>
          <Badge variant="amber">
            تتطلب دليلاً أو معلومات إضافية:{" "}
            <bdi className="font-bold">{counts.unable_to_verify}</bdi>
          </Badge>
          <Badge variant="outline">
            قواعد مستبعدة لعدم الانطباق: <bdi className="font-bold">{counts.not_applicable}</bdi>
          </Badge>
        </div>
      )}

      {/* 1. Applied Regulatory Packages */}
      {packs.length > 0 && (
        <details
          data-testid="packs-applied"
          className="rounded-lg border border-border bg-surface px-4 py-3"
          open
        >
          <summary className="cursor-pointer font-bold text-fg flex items-center gap-2">
            <ShieldCheck className="size-4 text-green" />
            الحزم التنظيمية الحكومية المطبقة ({packs.length})
          </summary>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 text-sm">
            {packs.map((p) => (
              <li
                key={p.code}
                className="flex flex-col gap-1 rounded-md border border-border bg-sunken/30 p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-fg">
                    <bdi dir="ltr">{p.code}</bdi>
                  </span>
                  {p.include_drafts && (
                    <Badge variant="neutral" className="text-[10px]">
                      {t("report2.packDrafts")}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-fg font-medium">
                  سبب الانطباق: {t(`report2.packReason.${p.reason}` as TKey)}
                </span>
                <span className="text-[11px] text-fg-muted">
                  {t("report2.packCounts", { a: p.applicable, n: p.not_applicable })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 2. Applied Company Rules and Internal Policies */}
      <details
        data-testid="company-rules-applied"
        className="rounded-lg border border-border bg-surface px-4 py-3"
        open
      >
        <summary className="cursor-pointer font-bold text-fg flex items-center gap-2">
          <FileText className="size-4 text-green" />
          سياسات وقواعد الشركة المفحوصة (
          {companyFindings.length > 0 ? companyFindings.length : "مطبقة"})
        </summary>
        <div className="mt-3 text-sm flex flex-col gap-2">
          {companyFindings.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {companyFindings.map((cf) => (
                <li
                  key={cf.id}
                  className="flex flex-col gap-1 rounded-md border border-border bg-sunken/30 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Badge mono>{cf.rule_code}</Badge>
                    <Badge variant="neutral">سياسة داخلية للمؤسسة</Badge>
                  </div>
                  <p className="text-xs text-fg leading-relaxed" dir="auto">
                    {cf.explanation_ar || "فحص مطابقة سياسات الهوية والعلامة التجارية الداخلية."}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-fg-muted">
              تم فحص ومطابقة سياسات الشركة والهوية المعتمدة بنجاح دون رصد أي مخالفات داخلية.
            </p>
          )}
        </div>
      </details>

      {/* 3. Reviewer Checklist (Evidence Needed) */}
      {checklist.length > 0 && (
        <details
          data-testid="reviewer-checklist"
          className="rounded-lg border border-border bg-surface px-4 py-3"
          open
        >
          <summary className="cursor-pointer font-bold text-fg flex items-center gap-2">
            <Info className="size-4 text-amber-text" />
            قواعد تتطلب توثيقاً أو مراجعة بشرية ({checklist.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {checklist.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-1 rounded-md border border-border bg-amber-bg/20 p-2.5"
              >
                <span className="text-fg font-medium">
                  ☐ <bdi>{title(c.rule_id)}</bdi>
                </span>
                {policy(c.rule_id) && (
                  <span className="text-xs text-fg-muted">الدليل المطلوب: {policy(c.rule_id)}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 4. Unable to Verify list */}
      {list("unable_to_verify", "قواعد تعذّر التحقق التلقائي منها", "unable-list")}

      {/* 5. Excluded / Not Applicable Rules and Why */}
      {list("not_applicable", "قواعد استُبعدت لعدم انطباق الشروط والسياق", "not-applicable-list")}
    </section>
  );
}
