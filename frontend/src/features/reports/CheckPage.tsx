import { Link } from "@tanstack/react-router";
import { ApiErrorState } from "@/components/feedback/ApiErrorState";
import { FileQuestion } from "lucide-react";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkspaceContext } from "@/features/review/FindingsWorkspace";
import { Button, Card, EmptyState, ErrorState, Page, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ApiError } from "@/lib/api/data";
import { useReport, useSubmissionStatus } from "@/lib/api/hooks";
import { ProcessingView } from "./ProcessingView";
import { ReportView } from "./ReportView";

export function ReportSkeleton() {
  return (
    <Page className="flex flex-col gap-6">
      <Skeleton className="h-44 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-[5fr_7fr]">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex flex-col gap-3">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-12 w-full" />
            </Card>
          ))}
        </div>
      </div>
    </Page>
  );
}

export function NotFoundReport() {
  const { t } = useI18n();
  return (
    <Page narrow>
      <EmptyState
        icon={<FileQuestion />}
        title={t("report.notFoundTitle")}
        body={t("report.notFoundBody")}
        action={
          <Button asChild>
            <Link to="/dashboard">{t("nav.dashboard")}</Link>
          </Button>
        }
      />
    </Page>
  );
}

/** /checks/$id — shows live processing until the pipeline is done, then the report. */
export function CheckPage({
  id,
  startAt,
  workspace,
}: {
  id: string;
  startAt?: number;
  workspace?: WorkspaceContext | null;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const status = useSubmissionStatus(id);
  const done = status.data?.status === "done";
  // §6: when the pipeline reaches a terminal state, refresh every view that shows this version's state
  // (advertisement header, lists) once — never a new analysis request.
  const lastStatus = useRef(status.data?.status);
  useEffect(() => {
    const s = status.data?.status;
    if (s && lastStatus.current && s !== lastStatus.current && (s === "done" || s === "failed")) {
      void qc.invalidateQueries({ queryKey: ["promotion"] });
      void qc.invalidateQueries({ queryKey: ["promotions"] });
      void qc.invalidateQueries({ queryKey: ["submissions"] });
    }
    lastStatus.current = s;
  }, [status.data?.status, qc]);
  // Start the report alongside the status poll (most opened checks are already done);
  // refetch once if it was loaded before the pipeline finished.
  const report = useReport(id, done || status.isPending);
  const staleReport = done && report.data && report.data.submission.status !== "done";
  useEffect(() => {
    if (staleReport) void report.refetch();
  }, [staleReport, report]);

  if (status.isPending) return <ReportSkeleton />;
  if (status.isError) {
    if (status.error instanceof ApiError && status.error.code === "not_found")
      return <NotFoundReport />;
    return (
      <Page narrow>
        <ApiErrorState
          title={t("report.loadErrorTitle")}
          error={status.error}
          onRetry={() => void status.refetch()}
        />
      </Page>
    );
  }
  if (!done) return <ProcessingView submission={status.data} />;
  if (report.isError)
    return (
      <Page narrow>
        <ApiErrorState
          title={t("report.loadErrorTitle")}
          error={report.error}
          onRetry={() => void report.refetch()}
        />
      </Page>
    );
  // Never render a bundle loaded before the pipeline finished: it has no findings yet and would read
  // as a clean "no automated findings" report until the refetch lands (seen in a live Gemini run).
  if (report.isPending || staleReport) return <ReportSkeleton />;
  return <ReportView bundle={report.data} startAt={startAt} workspace={workspace} />;
}
