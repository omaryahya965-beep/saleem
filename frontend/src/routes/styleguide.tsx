import { createFileRoute, notFound } from "@tanstack/react-router";
import { StyleguidePage } from "@/features/styleguide/StyleguidePage";

// Developer-only: 404 in production builds.
export const Route = createFileRoute("/styleguide")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: StyleguidePage,
});
