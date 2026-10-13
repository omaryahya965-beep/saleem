import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { I18nProvider, useI18n } from "@/i18n";
import { AuthProvider } from "@/lib/api/auth";
import { Button, EmptyState, ErrorState, Toaster } from "@/components/ui";

function NotFoundComponent() {
  const { t } = useI18n();
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
  const { t } = useI18n();
  const router = useRouter();
  console.error(error);
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
