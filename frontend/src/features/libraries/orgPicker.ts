import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useAuth } from "@/lib/api/auth";
import { fetchMyMemberships, fetchMyOrgs } from "@/lib/api/features";
import { fetchPersonalWorkspace } from "@/lib/api/personal";
import type { OrgRole } from "@/lib/permissions";

// The active workspace is shared by the sidebar, the account menu's switcher and every page's org picker, and
// remembered per browser (a convenience only: membership, ownership and permissions are always checked by the server).
// It is an organisation id, or PERSONAL for the user's personal workspace (D211).
const KEY = "saleem.activeOrg";
export const PERSONAL = "personal";
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

/**
 * The user's workspaces and the active one: an organisation (stored, else the first) with the user's role in it, or
 * the personal workspace (chosen explicitly, or the only workspace of a user without an organisation).
 * `mode` is "personal" whenever no organisation is active; `personal.data` is null until the user chose personal use.
 */
export function useOrgPicker() {
  const { user } = useAuth();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs, enabled: Boolean(user) });
  // Own memberships: external partners/reviewers can read their own row but not the organisation.
  const mine = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: fetchMyMemberships,
    enabled: Boolean(user),
  });
  const personal = useQuery({
    queryKey: ["personal-workspace", user?.id],
    queryFn: fetchPersonalWorkspace,
    enabled: Boolean(user),
  });
  const stored = useSyncExternalStore(subscribe, () => current);
  const list = orgs.data ?? [];
  const external = list.length === 0 ? mine.data?.[0] : undefined;
  const wantsPersonal = stored === PERSONAL && Boolean(personal.data);
  const orgId = wantsPersonal
    ? ""
    : list.some((o) => o.id === stored)
      ? stored
      : (list[0]?.id ?? external?.org_id ?? "");
  const role = orgId
    ? ((list.find((o) => o.id === orgId)?.org_members.find((m) => m.user_id === user?.id)?.role as
        OrgRole | undefined) ??
      (external?.role as OrgRole | undefined) ??
      null)
    : null;
  const mode: "personal" | "organization" = orgId ? "organization" : "personal";
  return {
    orgs,
    mine,
    personal,
    orgId,
    setOrgId: setActiveOrg,
    role,
    mode,
    userId: user?.id ?? null,
  };
}

export type OrgPicker = ReturnType<typeof useOrgPicker>;
