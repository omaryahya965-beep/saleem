import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/features/products/ProductsPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/products")({
  beforeLoad: requireAuth,
  component: ProductsPage,
});
