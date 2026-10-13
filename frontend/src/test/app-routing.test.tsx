import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering.
describe("App routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  it.each([
    ["/", "/_app/"],
    ["/dashboard", "/_app/dashboard"],
    ["/new", "/_app/new"],
    ["/rules", "/_app/rules"],
    ["/login", "/_app/login"],
    ["/checks/abc", "/_app/checks/$id"],
    ["/checks/abc/log", "/_app/checks_/$id/log"],
  ])("%s → %s", (path, id) => {
    const leaf = router.matchRoutes(path).at(-1);
    expect(leaf?.routeId).not.toBe(rootRouteId);
    expect(leaf?.routeId).toBe(id);
  });
});
