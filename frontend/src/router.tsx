import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { classifyError } from "@/lib/api/errors";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Don't retry definitive answers (missing rows, RLS denials); retry transient failures twice.
        // (classified: only network and server errors are worth retrying; 4xx, RLS and schema errors are not).
        retry: (count, err) => ["network", "server"].includes(classifyError(err)) && count < 2,
        refetchOnWindowFocus: false,
      },
    },
  });

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
  });
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
