import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { Badge, Card, CardTitle, Skeleton, Switch, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { can, type OrgRole } from "@/lib/permissions";
import { pk, useOrgSettings } from "@/lib/api/promotions";
import {
  ADVANCED_ROLES,
  canDisableRole,
  ESSENTIAL_ROLES,
  getEnabledRoles,
  IMMUTABLE_ROLES,
} from "@/lib/roleConfig";
import { supabase } from "@/lib/supabase";

interface OrgRolesConfigCardProps {
  orgId: string;
  myRole: OrgRole | null;
}

export function OrgRolesConfigCard({ orgId, myRole }: OrgRolesConfigCardProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const isManager = Boolean(myRole && can(myRole, "manage_members"));

  // Query members of the active organisation to enforce safety guards
  const membersQ = useQuery({
    queryKey: ["org-members-roles", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_members")
        .select("role, user_id")
        .eq("org_id", orgId);
      if (error) throw error;
      return (data ?? []) as { role: OrgRole; user_id: string }[];
    },
  });

  const members = membersQ.data ?? [];
  const currentFeatures = (settings.data?.features ?? {}) as Record<string, unknown>;
  const enabledRoles = getEnabledRoles(currentFeatures, members);

  const saveRoles = useMutation({
    mutationFn: async (newRoles: OrgRole[]) => {
      const updatedFeatures = {
        ...currentFeatures,
        enabled_roles: newRoles,
      };
      const { error } = await supabase
        .from("org_settings")
        .update({ features: updatedFeatures })
        .eq("org_id", orgId);
      if (error) throw error;
      return updatedFeatures;
    },
    onSuccess: () => {
      toast.success(t("rolesConfig.saveSuccess"));
      void qc.invalidateQueries({ queryKey: pk.orgSettings(orgId) });
      void qc.invalidateQueries({ queryKey: ["org-members-roles", orgId] });
    },
    onError: (err) => {
      toast.error((err as Error).message || t("errors.generic"));
    },
  });

  const handleToggle = (role: OrgRole, enable: boolean) => {
    if (!isManager || saveRoles.isPending) return;

    if (!enable) {
      // Disabling: verify critical rules
      const check = canDisableRole(role, members);
      if (!check.canDisable) {
        toast.error(
          check.reason_ar ||
            t("rolesConfig.hasMembersWarning", { n: check.memberCount }),
        );
        return;
      }
      const next = enabledRoles.filter((r) => r !== role);
      saveRoles.mutate(next);
    } else {
      // Enabling
      const next = Array.from(new Set([...enabledRoles, role]));
      saveRoles.mutate(next);
    }
  };

  const renderRoleRow = (role: OrgRole, isEssential: boolean) => {
    const isEnabled = enabledRoles.includes(role);
    const isImmutable = IMMUTABLE_ROLES.includes(role);
    const memberCount = members.filter((m) => m.role === role).length;
    const check = canDisableRole(role, members);

    return (
      <li
        key={role}
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3.5 transition-colors ${
          isEnabled
            ? "border-border bg-card"
            : "border-border/60 bg-sunken/25 opacity-75"
        }`}
      >
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-fg">
              {t(`org.roles.${role}` as TKey)}
            </span>
            {isImmutable ? (
              <Badge variant="neutral" className="text-[10px]">
                {t("rolesConfig.immutableBadge")}
              </Badge>
            ) : isEnabled ? (
              <Badge variant="green" className="text-[10px]">
                {t("rolesConfig.enabledBadge")}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-fg-muted">
                {t("rolesConfig.disabledBadge")}
              </Badge>
            )}
            {memberCount > 0 && (
              <span className="text-xs text-fg-muted">
                • {t("rolesConfig.activeMembers", { n: memberCount })}
              </span>
            )}
          </div>
          <p className="text-xs text-fg-muted leading-relaxed">
            {t(`rolesPage.desc.${role}` as TKey)}
          </p>
          {!check.canDisable && isEnabled && !isImmutable && (
            <p className="flex items-center gap-1.5 text-[11px] text-amber-text mt-0.5">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{check.reason_ar}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          {isManager ? (
            <div className="flex items-center gap-2">
              <label
                htmlFor={`switch-role-${role}`}
                className="text-xs font-medium text-fg-muted cursor-pointer"
              >
                {isEnabled ? t("rolesConfig.enabledBadge") : t("rolesConfig.disabledBadge")}
              </label>
              <Switch
                id={`switch-role-${role}`}
                checked={isEnabled}
                disabled={isImmutable || (!isEnabled ? false : !check.canDisable) || saveRoles.isPending}
                onCheckedChange={(checked) => handleToggle(role, checked)}
                aria-label={t(`org.roles.${role}` as TKey)}
              />
            </div>
          ) : (
            <Badge variant={isEnabled ? "green" : "neutral"}>
              {isEnabled ? t("rolesConfig.enabledBadge") : t("rolesConfig.disabledBadge")}
            </Badge>
          )}
        </div>
      </li>
    );
  };

  return (
    <Card className="flex flex-col gap-5" data-testid="org-roles-config">
      <div className="flex flex-col gap-1 border-b border-border pb-3">
        <div className="flex items-center gap-2 font-bold text-base text-fg">
          <ShieldAlert className="size-5 text-green" />
          <CardTitle>{t("rolesConfig.title")}</CardTitle>
        </div>
        <p className="text-sm text-fg-muted">{t("rolesConfig.subtitle")}</p>
      </div>

      {settings.isPending || membersQ.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Group 1: Recommended Essential Roles */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 font-bold text-sm text-fg">
              <Sparkles className="size-4 text-green" />
              <h3>{t("rolesConfig.essentialGroup")}</h3>
            </div>
            <ul className="flex flex-col gap-2.5">
              {ESSENTIAL_ROLES.map((r) => renderRoleRow(r, true))}
            </ul>
          </div>

          {/* Group 2: Optional Advanced Roles */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-border/70">
            <div className="flex items-center gap-1.5 font-bold text-sm text-fg">
              <CheckCircle2 className="size-4 text-fg-muted" />
              <h3>{t("rolesConfig.advancedGroup")}</h3>
            </div>
            <ul className="flex flex-col gap-2.5">
              {ADVANCED_ROLES.map((r) => renderRoleRow(r, false))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
