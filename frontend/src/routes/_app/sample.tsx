import { createFileRoute } from "@tanstack/react-router";
import { SamplePage } from "@/features/sample/SamplePage";

// Public, read-only sample report: the fictional «كريم ندى» advertisement (D182). The older herbal-tea demo stays
// reachable at /checks/<DEMO_ID> for existing links and tests.
export const Route = createFileRoute("/_app/sample")({
  component: SamplePage,
});
