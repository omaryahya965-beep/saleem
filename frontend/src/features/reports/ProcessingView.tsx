import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleX, RotateCcw, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Dialog,
  Page,
  ProgressBar,
  Stepper,
  toast,
  type StepState,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { cancelSubmission, retrySubmission, type Submission } from "@/lib/api/data";
import { qk } from "@/lib/api/hooks";

const STEPS: { key: string; label: TKey }[] = [
  { key: "upload", label: "processing.stepUpload" },
  { key: "transcribe", label: "processing.stepTranscribe" },
  { key: "deterministic", label: "processing.stepDeterministic" },
  { key: "llm", label: "processing.stepLlm" },
  { key: "merge", label: "processing.stepMerge" },
];

export const CANCELLED = "cancelled_by_user";

function stepIndex(sub: Submission): number {
  if (sub.status === "queued") return 1;
  const i = STEPS.findIndex((s) => s.key === sub.current_step);
  return i < 0 ? (sub.current_step === "done" ? STEPS.length : 1) : i;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function ProcessingView({ submission: sub }: { submission: Submission }) {
  const { t, tn } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const now = useNow(1000);
  const failed = sub.status === "failed";
  const cancelled = failed && sub.error_message === CANCELLED;
  const current = stepIndex(sub);
  const progress = failed ? sub.progress : Math.max(sub.progress, 3);
  const isOwner = Boolean(user && sub.user_id === user.id);

  const elapsed = (now - new Date(sub.created_at).getTime()) / 1000;
  const remaining = progress > 8 ? Math.max(0, (elapsed * (100 - progress)) / progress) : null;
  const slow = elapsed > 240;

  const refresh = () => qc.invalidateQueries({ queryKey: qk.submission(sub.id) });

  const cancel = useMutation({
    mutationFn: () => cancelSubmission(sub.id),
    onSuccess: () => {
      setConfirmCancel(false);
      toast.message(t("processing.cancelled"));
      void refresh();
    },
    onError: () => toast.error(t("errors.generic")),
  });

  const retry = useMutation({
    mutationFn: () => retrySubmission(sub.id),
    onSuccess: () => {
      toast.message(t("processing.retrying"));
      void refresh();
    },
    onError: () => toast.error(t("errors.generic")),
  });

  const steps = STEPS.map((s, i) => {
    let state: StepState = i < current ? "done" : i === current ? "current" : "upcoming";
    if (failed && i === current) state = cancelled ? "upcoming" : "failed";
    return { key: s.key, label: t(s.label), state };
  });

  const failedStage = t(STEPS[Math.min(current, STEPS.length - 1)]!.label);

  return (
    <Page narrow className="flex flex-col gap-6">
      <Card className="flex flex-col gap-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span
            className={
              failed
                ? "grid size-12 shrink-0 place-items-center rounded-full bg-red-bg text-red"
                : "grid size-12 shrink-0 place-items-center rounded-full bg-green-bg text-green"
            }
          >
            {failed ? (
              <CircleX aria-hidden="true" className="size-6" />
            ) : (
              <ScanSearch aria-hidden="true" className="size-6" />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl" aria-live="polite">
              {cancelled
                ? t("processing.cancelledTitle")
                : failed
                  ? t("processing.failedTitle")
                  : t("processing.title")}
            </h1>
            <p className="mt-1 text-fg-muted">
              {failed
                ? cancelled
                  ? null
                  : t("processing.failedBody", { stage: failedStage })
                : t("processing.subtitle")}
            </p>
            {sub.title && <p className="mt-2 font-medium text-fg">{sub.title}</p>}
          </div>
        </div>

        {!failed && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="tabular font-medium text-fg">
                {t("processing.progress", { p: progress })}
              </span>
              <span className="text-fg-muted">
                {remaining === null
                  ? null
                  : remaining < 5
                    ? t("processing.estimateSoon")
                    : t("processing.estimate", {
                        time: tn("count.seconds", Math.ceil(remaining / 5) * 5),
                      })}
              </span>
            </div>
            <ProgressBar value={progress} label={t("processing.progressLabel")} />
            {slow && <p className="text-sm text-amber-text">{t("processing.slow")}</p>}
          </div>
        )}

        {failed && !cancelled && sub.error_message && (
          <div className="rounded-md border border-red/20 bg-red-bg/60 p-4 text-sm">
            <p className="font-bold text-red">{t("processing.reason")}</p>
            <p dir="auto" className="mt-1 break-words text-fg">
              {sub.error_message}
            </p>
          </div>
        )}

        <Stepper steps={steps} />

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          {failed ? (
            <>
              <Button asChild variant="secondary">
                <Link to="/new">{t("processing.startOver")}</Link>
              </Button>
              {isOwner && (
                <Button
                  icon={<RotateCcw />}
                  loading={retry.isPending}
                  onClick={() => retry.mutate()}
                >
                  {t("processing.retry")}
                </Button>
              )}
            </>
          ) : (
            isOwner && (
              <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                {t("processing.cancel")}
              </Button>
            )
          )}
        </div>
      </Card>

      <Dialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("processing.cancelTitle")}
        description={t("processing.cancelBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
              {t("processing.keepGoing")}
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              {t("processing.cancelConfirm")}
            </Button>
          </>
        }
      />
    </Page>
  );
}
