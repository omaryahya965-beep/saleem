import { createFileRoute } from "@tanstack/react-router";
import { StudioPage } from "@/features/studio/StudioPage";
import { requireAuth } from "@/lib/guards";

// SALEEM AI Studio (D207): ?draft=<id> resumes a draft, ?from=<promotion id> starts a replacement advertisement.
export const Route = createFileRoute("/_app/studio")({
  beforeLoad: requireAuth,
  validateSearch: (s: Record<string, unknown>): { draft?: string; from?: string } => ({
    draft: typeof s["draft"] === "string" ? s["draft"] : undefined,
    from: typeof s["from"] === "string" ? s["from"] : undefined,
  }),
  component: StudioPage,
});
