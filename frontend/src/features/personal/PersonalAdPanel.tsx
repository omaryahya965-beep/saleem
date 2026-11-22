import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, Info, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardTitle, Dialog, toast } from "@/components/ui";
import { useI18n } from "@/i18n";
import { triggerAnalysis, type ReportBundle } from "@/lib/api/data";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";
import { RunCoverageTable, type RunCoverage } from "./RegulatoryCoverage";

/**
 * D211/D213: what a personal advertisement offers instead of the enterprise review workflow — its read-only
 * regulatory coverage (every supported authority, considered automatically), re-analysis, and downloading it. No approval exists here:
 * results are automated advice, unresolved findings are shown before a download, never hidden.
 */
export function PersonalAdPanel({
  promotion: p,
  latest,
  report,
}: {
  promotion: Promotion;
  latest: VersionSummary | null;
  report: ReportBundle | undefined;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [confirmDownload, setConfirmDownload] = useState(false);
  const run =
    (report?.run?.step_outputs as { authorities?: RunCoverage | null } | null | undefined)
      ?.authorities ?? null;
  const unresolved = (report?.findings ?? []).filter(
    (f) =>
      (f.severity === "violation" || f.severity === "warning") &&
      !["resolved", "dismissed", "not_required", "corrected"].includes(String(f.status)),
  );
  const done = latest?.status === "done";
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["promotion", p.id] });
    void qc.invalidateQueries({ queryKey: ["promotions"] });
    void qc.invalidateQueries({ queryKey: ["personal"] });
    void qc.invalidateQueries({ queryKey: ["report"] });
    void qc.invalidateQueries({ queryKey: ["submission"] });
  };

  const reanalyze = useMutation({
    mutationFn: async () => {
      if (!latest) return;
      if (!(await triggerAnalysis(latest.id))) throw new Error("start_failed");
    },
    onSuccess: () => {
      toast.message(t("personalAd.reanalyzing"));
      refresh();
    },
    onError: () => toast.error(t("personalAd.reanalyzeFailed")),
  });
  const download = async () => {
    setConfirmDownload(false);
    const s = report?.submission;
    try {
      let blob: Blob;
      let name = (p.title || "saleem-ad").replace(/[\\/:*?"<>|]+/g, " ").trim();
      if (report?.mediaUrl) {
        blob = await fetch(report.mediaUrl).then((r) => {
          if (!r.ok) throw new Error("download");
          return r.blob();
        });
        const ext = blob.type.includes("webm")
          ? "webm"
          : blob.type.includes("mp4")
            ? "mp4"
            : blob.type.split("/")[1] || "bin";
        name = `${name}.${ext}`;
      } else {
        blob = new Blob([[s?.text_content, s?.caption].filter(Boolean).join("\n\n")], {
          type: "text/plain;charset=utf-8",
        });
        name = `${name}.txt`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error(t("personalAd.downloadFailed"));
    }
  };

  return (
    <Card className="flex flex-col gap-4" data-testid="personal-ad-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{t("authority.report.title")}</CardTitle>
          <p className="text-xs text-fg-muted">{t("coverageRun.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {done && (
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw />}
              loading={reanalyze.isPending}
              onClick={() => reanalyze.mutate()}
              data-testid="personal-reanalyze"
            >
              {t("personalAd.reanalyze")}
            </Button>
          )}
          {latest && (
            <Button
              size="sm"
              icon={<Download />}
              onClick={() => (unresolved.length ? setConfirmDownload(true) : void download())}
              data-testid="personal-download"
            >
              {t("personalAd.download")}
            </Button>
          )}
        </div>
      </div>
      <RunCoverageTable run={done ? run : null} />
      <p
        className="flex items-start gap-2 text-xs leading-relaxed text-fg-muted"
        data-testid="personal-advisory"
      >
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        {t("personalAd.advisory")}
      </p>

      <Dialog
        open={confirmDownload}
        onOpenChange={setConfirmDownload}
        title={t("personalAd.downloadWarnTitle")}
        description={t("personalAd.downloadWarnBody", { n: unresolved.length })}
      >
        <div className="flex flex-col gap-4" data-testid="download-warning">
          <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto text-sm">
            {unresolved.slice(0, 8).map((f) => (
              <li key={f.id} className="flex items-start gap-2">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-amber-text"
                />
                <span>
                  <bdi className="font-medium">{f.rule_code}</bdi> —{" "}
                  {(lang === "en" ? f.explanation_en : f.explanation_ar) ?? f.explanation_ar ?? ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-fg-muted">
            {t("personalAd.downloadWarnNote")}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDownload(false)}>
              {t("personalAd.fixFirst")}
            </Button>
            <Button onClick={() => void download()} data-testid="download-anyway">
              {t("personalAd.downloadAnyway")}
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
