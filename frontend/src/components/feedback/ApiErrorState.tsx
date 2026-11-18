import { Link } from "@tanstack/react-router";
import { Button, ErrorState } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { classifyError, type ErrorKind } from "@/lib/api/errors";

/** Arabic/English message for an error, by kind (never «الخادم غير متاح» for a permission or schema problem). */
export function useErrorText() {
  const { t } = useI18n();
  return (e: unknown) => t(`errors.kind.${classifyError(e)}.body` as TKey);
}

/**
 * Page-level error with the right title, explanation and recovery action for its kind:
 * retry (network, server, schema), sign in again (unauthorized), back to the dashboard (forbidden, not found).
 */
export function ApiErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const { t } = useI18n();
  const kind: ErrorKind = classifyError(error);
  const retry = onRetry && ["network", "server", "schema", "provider"].includes(kind);
  return (
    <div data-testid={`error-${kind}`} className="flex flex-col gap-3">
      <ErrorState
        title={title ?? t(`errors.kind.${kind}.title` as TKey)}
        body={t(`errors.kind.${kind}.body` as TKey)}
        onRetry={retry ? onRetry : undefined}
        retryLabel={t("common.retry")}
      />
      {kind === "unauthorized" && (
        <Button asChild variant="secondary" className="self-center">
          <Link to="/login">{t("errors.signInAgain")}</Link>
        </Button>
      )}
      {(kind === "forbidden" || kind === "not_found") && (
        <Button asChild variant="secondary" className="self-center">
          <Link to="/dashboard">{t("errors.backToDashboard")}</Link>
        </Button>
      )}
    </div>
  );
}
