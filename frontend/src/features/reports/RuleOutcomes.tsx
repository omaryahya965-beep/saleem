import { Link } from "@tanstack/react-router";
import { AlertTriangle, BookOpen, ShieldCheck } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import type { ReportBundle } from "@/lib/api/data";
import { coverageGaps, outcomeCounts, reasonKey, type CoverageView } from "./model";

function coverageOf(bundle: ReportBundle): CoverageView | null {
  return (bundle.run?.coverage as CoverageView | null) ?? null;
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
                <AlertTriangle aria-hidden="true" className="size-4" />
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
            <Link to="/rules">{t("report2.draftCtaAction")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/** Per-rule outcomes: counts, «قواعد لم تنطبق» and «تعذّر التحقق» with reasons. */
export function RuleOutcomes({ bundle }: { bundle: ReportBundle }) {
  const { t, lang } = useI18n();
  const checks = bundle.ruleChecks;
  if (!checks.length) {
    return bundle.findings.length ? (
      <p className="text-sm text-fg-muted">{t("report2.noChecks")}</p>
    ) : null;
  }
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
  // check_mode = workflow: shown as the reviewer's checklist, not as «تعذّر التحقق».
  const checklist = checks.filter((c) => c.reason_code === "reviewer_checklist");
  const policy = (ruleId: string) =>
    (bundle.rulesById.get(ruleId) as { evidence_policy_ar?: string | null } | undefined)
      ?.evidence_policy_ar ?? null;
  const packs = coverageOf(bundle)?.packs ?? [];
  const list = (outcome: "not_applicable" | "unable_to_verify", heading: TKey, testId: string) => {
    const rows = checks.filter(
      (c) => c.outcome === outcome && c.reason_code !== "reviewer_checklist",
    );
    if (!rows.length) return null;
    return (
      <details
        data-testid={testId}
        className="rounded-md border border-border bg-surface px-4 py-3"
      >
        <summary className="cursor-pointer font-bold text-fg">
          {t(heading, { n: rows.length })}
        </summary>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5">
              <span className="text-fg">
                <bdi>{title(c.rule_id)}</bdi>
              </span>
              <span className="text-fg-muted">{reason(c.reason_code)}</span>
            </li>
          ))}
        </ul>
      </details>
    );
  };
  return (
    <section aria-labelledby="rule-outcomes" className="flex flex-col gap-3">
      <h2 id="rule-outcomes" className="text-lg font-bold">
        {t("report2.outcomesTitle")}
      </h2>
      <p className="flex flex-wrap gap-2">
        {(["failed", "passed", "unable_to_verify", "not_applicable"] as const).map((o) => (
          <Badge key={o}>
            {t(`report2.outcome.${o}`)}: <bdi>{counts[o]}</bdi>
          </Badge>
        ))}
      </p>
      {packs.length > 0 && (
        <details
          data-testid="packs-applied"
          className="rounded-md border border-border bg-surface px-4 py-3"
          open
        >
          <summary className="cursor-pointer font-bold text-fg">
            {t("report2.packsTitle", { n: packs.length })}
          </summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {packs.map((p) => (
              <li key={p.code} className="flex flex-col gap-0.5">
                <span className="text-fg">
                  <bdi dir="ltr">{p.code}</bdi>
                  {p.include_drafts && (
                    <Badge variant="neutral" className="ms-2">
                      {t("report2.packDrafts")}
                    </Badge>
                  )}
                </span>
                <span className="text-fg-muted">
                  {t(`report2.packReason.${p.reason}` as TKey)} ·{" "}
                  {t("report2.packCounts", { a: p.applicable, n: p.not_applicable })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {checklist.length > 0 && (
        <details
          data-testid="reviewer-checklist"
          className="rounded-md border border-border bg-surface px-4 py-3"
        >
          <summary className="cursor-pointer font-bold text-fg">
            {t("report2.checklistTitle", { n: checklist.length })}
          </summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {checklist.map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5">
                <span className="text-fg">
                  ☐ <bdi>{title(c.rule_id)}</bdi>
                </span>
                {policy(c.rule_id) && <span className="text-fg-muted">{policy(c.rule_id)}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
      {list("unable_to_verify", "report2.unableTitle", "unable-list")}
      {list("not_applicable", "report2.notApplicableTitle", "not-applicable-list")}
    </section>
  );
}
