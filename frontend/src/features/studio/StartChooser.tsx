// /new (D207): the two ways to start an advertisement. Upload-and-check is the page itself; Create-with-AI opens
// SALEEM AI Studio, which ends in the same advertisement and review workflow.
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ScanSearch, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";

/** D219: checking an existing ad (this page) is shown first; creating one in the AI Studio second. */
export function StartChooser() {
  const { t } = useI18n();
  return (
    <div className="mb-6 grid gap-3 md:grid-cols-2" data-testid="start-chooser">
      <Link
        to="/studio"
        className="group flex items-start gap-4 rounded-lg border border-border bg-surface p-5 hover:border-ink hover:shadow-raised"
        data-testid="start-studio"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-mint">
          <Sparkles aria-hidden="true" className="size-5" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-2 font-bold">
            {t("studio.start.create")}
            <ArrowLeft
              aria-hidden="true"
              className="size-4 transition-transform group-hover:-translate-x-1 ltr:rotate-180 ltr:group-hover:translate-x-1"
            />
          </span>
          <span className="text-sm text-fg-muted">{t("studio.start.createBody")}</span>
        </span>
      </Link>
      <div
        aria-current="true"
        className="order-first flex items-start gap-4 rounded-lg border-2 border-green bg-green-bg/40 p-5"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-green text-white">
          <ScanSearch aria-hidden="true" className="size-5" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-bold">{t("studio.start.upload")}</span>
          <span className="text-sm text-fg-muted">{t("studio.start.uploadBody")}</span>
        </span>
      </div>
    </div>
  );
}
