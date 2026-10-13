import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";

export const Route = createFileRoute("/_app")({
  component: () => (
    <SiteShell>
      <Outlet />
    </SiteShell>
  ),
});
