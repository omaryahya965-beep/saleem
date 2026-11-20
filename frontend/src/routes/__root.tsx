import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { useContext } from "react";
import { I18nProvider, useI18n, translate, type I18n } from "@/i18n";
import { AuthProvider } from "@/lib/api/auth";
import { reportError } from "@/lib/telemetry";
import { Button, EmptyState, ErrorState, Toaster } from "@/components/ui";

/**
 * Safe i18n hook: returns the real context when inside <I18nProvider>,
 * otherwise returns a minimal fallback so root-level error/404 components
 * never crash with "useI18n must be used inside <I18nProvider>".
 */
function useSafeI18n(): Pick<I18n, "t"> {
  // Access the context directly — useI18n() throws when ctx is null.
  try {
    return useI18n();
  } catch {
    return { t: (key, params) => translate("ar", key, params) };
  }
}

function NotFoundComponent() {
  const { t } = useSafeI18n();
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-xl items-center px-4">
      <EmptyState
        className="w-full"
        icon={<Compass />}
        title={t("errors.notFoundTitle")}
        body={t("errors.notFoundBody")}
        action={
          <Button asChild>
            <Link to="/">{t("errors.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const { t } = useSafeI18n();
  const router = useRouter();
  reportError(error, { source: "route" });
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-xl items-center px-4">
      <ErrorState
        className="w-full"
        title={t("errors.pageFailedTitle")}
        body={t("errors.pageFailedBody")}
        retryLabel={t("common.retry")}
        onRetry={() => {
          void router.invalidate();
          reset();
        }}
      />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <Outlet />
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
