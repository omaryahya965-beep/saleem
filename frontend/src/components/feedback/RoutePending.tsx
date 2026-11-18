import { Page, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n";

/** Shown while a navigation is still loading (code or data) for more than a moment, instead of the stale page. */
export function RoutePending() {
  const { t } = useI18n();
  return (
    <Page className="flex flex-col gap-4" aria-busy="true" data-testid="route-pending">
      <span className="sr-only" role="status">
        {t("common.loading")}
      </span>
      <Skeleton className="h-9 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </Page>
  );
}
