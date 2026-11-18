import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useAuth } from "@/lib/api/auth";
import { fetchMyMemberships, fetchMyOrgs } from "@/lib/api/features";
import type { OrgRole } from "@/lib/permissions";

// The active organisation is shared by the sidebar, the account menu's switcher and every page's org picker,
// and remembered per browser (a convenience only: membership and permissions are always checked by the server).
const KEY = "saleem.activeOrg";
const subs = new Set<() => void>();
let current = (() => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
})();
export function setActiveOrg(id: string) {
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable: keep it in memory */
  }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** Organisations the user belongs to, the active one (stored, else the first) and the user's role in it. */
export function useOrgPicker() {
  const { user } = useAuth();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs, enabled: Boolean(user) });
  // Own memberships: external partners/reviewers can read their own row but not the organisation.
  const mine = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: fetchMyMemberships,
    enabled: Boolean(user),
  });
  const stored = useSyncExternalStore(subscribe, () => current);
  const list = orgs.data ?? [];
  const external = list.length === 0 ? mine.data?.[0] : undefined;
  const orgId = list.some((o) => o.id === stored)
    ? stored
    : (list[0]?.id ?? external?.org_id ?? "");
  const role =
    (list.find((o) => o.id === orgId)?.org_members.find((m) => m.user_id === user?.id)?.role as
      OrgRole | undefined) ??
    (external?.role as OrgRole | undefined) ??
    null;
  return { orgs, mine, orgId, setOrgId: setActiveOrg, role, userId: user?.id ?? null };
}

export type OrgPicker = ReturnType<typeof useOrgPicker>;
