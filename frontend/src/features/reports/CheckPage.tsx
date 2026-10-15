import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { useEffect } from "react";
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
export function CheckPage({ id }: { id: string }) {
  const { t } = useI18n();
  const status = useSubmissionStatus(id);
  const done = status.data?.status === "done";
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
        <ErrorState
          title={t("report.loadErrorTitle")}
          body={t("errors.network")}
          retryLabel={t("common.retry")}
          onRetry={() => void status.refetch()}
        />
      </Page>
    );
  }
  if (!done) return <ProcessingView submission={status.data} />;
  if (report.isPending) return <ReportSkeleton />;
  if (report.isError)
    return (
      <Page narrow>
        <ErrorState
          title={t("report.loadErrorTitle")}
          body={t("errors.network")}
          retryLabel={t("common.retry")}
          onRetry={() => void report.refetch()}
        />
      </Page>
    );
  return <ReportView bundle={report.data} />;
}
