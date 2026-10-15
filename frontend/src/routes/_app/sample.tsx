import { createFileRoute } from "@tanstack/react-router";
import { CheckPage } from "@/features/reports/CheckPage";
import { DEMO_ID } from "@/features/landing/LandingPage";

// Short, shareable link to the public sample report (instead of /checks/<uuid>).
export const Route = createFileRoute("/_app/sample")({
  component: () => <CheckPage id={DEMO_ID} />,
});
