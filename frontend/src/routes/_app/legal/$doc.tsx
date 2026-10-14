import { createFileRoute, notFound } from "@tanstack/react-router";
import { LEGAL_DOCS, LegalPage, type LegalDoc } from "@/features/legal/LegalPage";

export const Route = createFileRoute("/_app/legal/$doc")({
  beforeLoad: ({ params }) => {
    if (!LEGAL_DOCS.includes(params.doc as LegalDoc)) throw notFound();
  },
  component: function LegalRoute() {
    const { doc } = Route.useParams();
    return <LegalPage key={doc} doc={doc as LegalDoc} />;
  },
});
