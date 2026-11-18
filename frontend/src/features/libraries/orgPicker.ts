import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/api/auth";
import { fetchMyOrgs } from "@/lib/api/features";

/** Organisation picker shared by the library pages (orgs where the user is a member). */
export function useOrgPicker() {
  const { user } = useAuth();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs, enabled: Boolean(user) });
  const [orgId, setOrgId] = useState("");
  useEffect(() => {
    if (!orgId && orgs.data?.[0]) setOrgId(orgs.data[0].id);
  }, [orgs.data, orgId]);
  const role =
    orgs.data?.find((o) => o.id === orgId)?.org_members.find((m) => m.user_id === user?.id)?.role ??
    null;
  return { orgs, orgId, setOrgId, role, userId: user?.id ?? null };
}

export type OrgPicker = ReturnType<typeof useOrgPicker>;
