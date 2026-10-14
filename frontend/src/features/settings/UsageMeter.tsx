import { useQuery } from "@tanstack/react-query";
import { Badge, ProgressBar } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { fetchUsage, type Usage } from "@/lib/api/features";
import { cn } from "@/lib/utils";

export function useUsage() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["usage", user?.id],
    queryFn: fetchUsage,
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

/** Plan usage for the current month: label, meter, numbers, reset date. */
export function UsageMeter({ usage, compact }: { usage: Usage; compact?: boolean }) {
  const { t, lang, formatDate } = useI18n();
  const ratio = usage.monthly_checks ? usage.used / usage.monthly_checks : 0;
  const near = ratio >= 0.8;
  return (
    <div className={cn("flex flex-col gap-2", compact && "gap-1.5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm">
          <Badge variant="green">{lang === "ar" ? usage.plan_name_ar : usage.plan_name_en}</Badge>
          <span className="tabular text-fg">
            {t("plans.used", { used: usage.used, limit: usage.monthly_checks })}
          </span>
        </span>
        <span className="text-xs text-fg-muted">
          {t("plans.resets", { date: formatDate(usage.period_end) })}
        </span>
      </div>
      <ProgressBar
        value={ratio * 100}
        label={t("plans.meterLabel")}
        tone={ratio >= 1 ? "red" : "green"}
      />
      {near && (
        <p className={cn("text-sm", ratio >= 1 ? "text-red" : "text-amber-text")}>
          {ratio >= 1 ? t("plans.exhausted") : t("plans.nearLimit")}
        </p>
      )}
      {!compact && (
        <p className="text-xs text-fg-muted">
          {t("plans.limits", { batch: usage.max_batch })}{" "}
          {usage.orgs_allowed ? t("plans.orgsYes") : t("plans.orgsNo")}
        </p>
      )}
    </div>
  );
}
