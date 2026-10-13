import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleCheck, CircleX, FileClock, Printer, TriangleAlert } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Brand, Button, EmptyState, ErrorState, Page, Skeleton } from "@/components/ui";
import { formatClock, useI18n } from "@/i18n";
import { ApiError } from "@/lib/api/data";
import { useReport, useSubmissionStatus } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { NotFoundReport } from "@/features/reports/CheckPage";
import {
  countBySeverity,
  diffFindings,
  sortIssues,
  toIssueViews,
  verificationId,
} from "@/features/reports/model";

function useQr(text: string) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void QRCode.toString(text, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#0E2620", light: "#00000000" },
    }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [text]);
  return svg;
}

export function LogPage({ id }: { id: string }) {
  const { t, tn, lang, formatDate } = useI18n();
  const status = useSubmissionStatus(id);
  const done = status.data?.status === "done";
  const report = useReport(id, done);
  const verifyUrl = `${window.location.origin}/verify/${id}`;
  const qr = useQr(verifyUrl);

  const issues = useMemo(
    () =>
      report.data ? sortIssues(toIssueViews(report.data.findings, report.data.rules, lang)) : [],
    [report.data, lang],
  );

  if (status.isPending || (done && report.isPending)) {
    return (
      <Page narrow>
        <Skeleton className="mx-auto aspect-[210/297] w-full max-w-[794px] rounded-sm" />
      </Page>
    );
  }
  if (status.isError) {
    if (status.error instanceof ApiError && status.error.code === "not_found")
      return <NotFoundReport />;
    return (
      <Page narrow>
        <ErrorState
          title={t("report.loadErrorTitle")}
          retryLabel={t("common.retry")}
          onRetry={() => void status.refetch()}
        />
      </Page>
    );
  }
  if (!done || !report.data) {
    return (
      <Page narrow>
        <EmptyState
          icon={<FileClock />}
          title={t("log.notReadyTitle")}
          body={t("log.notReadyBody")}
          action={
            <Button asChild variant="secondary">
              <Link to="/checks/$id" params={{ id }}>
                {t("log.backToReport")}
              </Link>
            </Button>
          }
        />
      </Page>
    );
  }

  const { submission: sub, run, log, parent, parentFindings, findings, rules } = report.data;
  const status_ = sub.overall_status ?? "ready";
  const counts = countBySeverity(findings);
  const fixed = parent ? diffFindings(parentFindings, findings).fixed : [];
  const Icon = status_ === "ready" ? CircleCheck : status_ === "review" ? TriangleAlert : CircleX;
  const hash = log?.content_hash ?? sub.sha256 ?? "—";

  const facts: { k: string; v: string; ltr?: boolean; mono?: boolean }[] = [
    { k: t("log.verificationId"), v: verificationId(sub.id), ltr: true, mono: true },
    { k: t("log.content"), v: sub.title || t("dashboard.untitled") },
    { k: t("log.platform"), v: t(`platforms.${sub.platform}`) },
    { k: t("log.checkedAt"), v: formatDate(sub.analyzed_at ?? sub.created_at, true) },
    { k: t("log.rulebook"), v: report.data.rulebookVersion ?? "—", ltr: true },
    {
      k: t("log.model"),
      v: [run?.llm_model, run?.asr_model].filter(Boolean).join(" · ") || "—",
      ltr: true,
    },
    ...(sub.mawthooq_license_no
      ? [{ k: t("log.license"), v: sub.mawthooq_license_no, ltr: true }]
      : []),
    ...(parent
      ? [{ k: t("log.recheckOf"), v: verificationId(parent.id), ltr: true, mono: true }]
      : []),
  ];

  return (
    <Page className="flex flex-col items-center gap-5 print:p-0">
      <div className="no-print flex w-full max-w-[794px] flex-wrap items-center justify-between gap-3">
        <Link
          to="/checks/$id"
          params={{ id }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-green hover:underline"
        >
          <ArrowRight aria-hidden="true" className="size-4 ltr:rotate-180" />
          {t("log.backToReport")}
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-fg-muted sm:inline">{t("log.printHint")}</span>
          <Button icon={<Printer />} onClick={() => window.print()}>
            {t("log.savePdf")}
          </Button>
        </div>
      </div>

      <article
        aria-label={t("log.title")}
        className="print-area w-full max-w-[794px] bg-white px-6 py-8 text-ink shadow-raised sm:px-14 sm:py-12 print:max-w-none print:p-0 print:shadow-none"
      >
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-5">
          <div>
            <h1
              className={cn(
                "text-3xl font-bold",
                lang === "ar" ? "font-display" : "tracking-tight",
              )}
            >
              {t("log.title")}
            </h1>
            <p className="mt-1 text-sm text-muted">{t("brand.tagline")}</p>
          </div>
          <Brand />
        </header>

        <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_132px]">
          <dl className="grid gap-y-2.5 text-sm">
            {facts.map((f) => (
              <div key={f.k} className="grid grid-cols-[150px_minmax(0,1fr)] gap-3">
                <dt className="text-muted">{f.k}</dt>
                <dd
                  dir={f.ltr ? "ltr" : undefined}
                  className={cn(
                    "m-0 font-medium break-words rtl:text-end",
                    f.mono && "font-mono text-[13px]",
                  )}
                >
                  {f.v}
                </dd>
              </div>
            ))}
            <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3">
              <dt className="text-muted">{t("log.fileHash")}</dt>
              <dd
                dir="ltr"
                className="m-0 font-mono text-[12px] leading-relaxed break-all rtl:text-end"
              >
                {hash}
              </dd>
            </div>
          </dl>
          <figure className="m-0 flex flex-col items-center gap-2 self-start">
            <div
              className="size-[132px]"
              aria-hidden="true"
              dangerouslySetInnerHTML={qr ? { __html: qr } : undefined}
            />
            <figcaption className="text-center text-[11px] leading-snug text-muted">
              {t("log.scanToVerify")}
            </figcaption>
          </figure>
        </div>

        <section
          aria-label={t("log.result")}
          className={cn(
            "mt-7 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-5 py-4 print:border",
            status_ === "ready" && "bg-green-bg text-ready print:border-green",
            status_ === "review" && "bg-amber-bg text-amber-text print:border-amber",
            status_ === "needs_fixes" && "bg-red-bg text-red print:border-red",
          )}
        >
          <Icon aria-hidden="true" className="size-6" />
          <strong className="text-xl">{t(`status.${status_}`)}</strong>
          <span className="text-sm text-ink">
            {tn("count.violations", counts.violations)} · {tn("count.warnings", counts.warnings)}
          </span>
        </section>

        <h2 className="mt-8 mb-3 text-base font-bold">{t("log.findings")}</h2>
        {issues.length === 0 ? (
          <p className="text-sm text-muted">{t("log.noFindings")}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-paper text-start text-xs text-muted">
                <th scope="col" className="w-24 px-2 py-2 text-start font-medium">
                  {t("log.colRule")}
                </th>
                <th scope="col" className="px-2 py-2 text-start font-medium">
                  {t("log.colIssue")}
                </th>
                <th scope="col" className="w-16 px-2 py-2 text-start font-medium">
                  {t("log.colTime")}
                </th>
                <th scope="col" className="w-20 px-2 py-2 text-start font-medium">
                  {t("log.colSeverity")}
                </th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id} className="border-b border-line align-top break-inside-avoid">
                  <td className="px-2 py-2.5 font-mono text-[12px]" dir="ltr">
                    {i.ruleCode}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="block font-medium">{i.ruleTitle}</span>
                    <span className="block text-muted">{i.title}</span>
                  </td>
                  <td className="tabular px-2 py-2.5">
                    {i.time === null ? "—" : formatClock(i.time)}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2.5 font-medium",
                      i.severity === "violation" ? "text-red" : "text-amber-text",
                    )}
                  >
                    {t(`severity.${i.severity}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {fixed.length > 0 && (
          <p className="mt-4 text-sm text-ready">
            {t("log.fixedInVersion", {
              list: [...new Set(fixed.map((f) => f.rule_code))].join(lang === "ar" ? "، " : ", "),
            })}
          </p>
        )}

        <footer className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          <p>
            {t("brand.disclaimer")} {t("report.illustrativeNote")}
          </p>
          <p className="mt-1">
            {t("log.generatedAt", { date: formatDate(log?.generated_at ?? sub.analyzed_at, true) })}{" "}
            · <span dir="ltr">{verifyUrl}</span>
          </p>
        </footer>
      </article>
    </Page>
  );
}
