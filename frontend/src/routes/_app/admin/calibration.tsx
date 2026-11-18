import { createFileRoute } from "@tanstack/react-router";
import { CalibrationPage } from "@/features/enterprise/CalibrationPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/admin/calibration")({
  beforeLoad: requireAuth,
  component: CalibrationPage,
});
