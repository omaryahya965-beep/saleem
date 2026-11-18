import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckPage, ReportSkeleton } from "@/features/reports/CheckPage";
import { versionLocation } from "@/lib/api/promotions";

// Public route: RLS decides visibility (own checks, or is_demo sample reports).
// v2: a check is a version of a promotion → redirect to /promotions/$id?v=N. Rows the caller can't
// resolve (not found, no access) keep today's page, which shows the right empty/error state.
export const Route = createFileRoute("/_app/checks/$id")({
  component: function CheckRoute() {
    const { id } = Route.useParams();
    const loc = useQuery({
      queryKey: ["version-location", id],
      queryFn: () => versionLocation(id),
    });
    if (loc.isPending) return <ReportSkeleton />;
    if (loc.data)
      return (
        <Navigate
          to="/promotions/$id"
          params={{ id: loc.data.promotionId }}
          search={{ v: loc.data.versionNo }}
          replace
        />
      );
    return <CheckPage key={id} id={id} />;
  },
});
