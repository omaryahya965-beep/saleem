import { ORG_ROLES, type OrgRole } from "./permissions";

/** Section A: The 4 everyday essential roles in SALEEM workflows. */
export const ESSENTIAL_ROLES: readonly OrgRole[] = [
  "admin",
  "creator",
  "reviewer",
  "external_uploader",
] as const;

/** Section B: The 5 advanced or specialized roles. */
export const ADVANCED_ROLES: readonly OrgRole[] = [
  "owner",
  "compliance_lead",
  "legal",
  "external_reviewer",
  "viewer",
] as const;

/** Core administrative roles that can never be disabled for an organization. */
export const IMMUTABLE_ROLES: readonly OrgRole[] = ["owner", "admin"] as const;

/** Default recommended roles for newly initialized workspaces. */
export const DEFAULT_WORKSPACE_ROLES: readonly OrgRole[] = [
  "owner",
  "admin",
  "creator",
  "reviewer",
  "external_uploader",
] as const;

export interface RoleConfigState {
  enabledRoles: OrgRole[];
  isConfigured: boolean;
}

/**
 * Returns the list of enabled roles for an organization.
 * - Always includes `owner` and `admin` to ensure governance.
 * - If an explicit `enabled_roles` list is stored in `features.enabled_roles`, that list is respected.
 * - Always keeps any role currently held by existing active members to prevent orphan states.
 * - Defaults to all roles if no configuration is present (preserving backward compatibility).
 */
export function getEnabledRoles(
  features?: Record<string, unknown> | null,
  currentMembers: { role: OrgRole }[] = [],
): OrgRole[] {
  const memberRoles = new Set(currentMembers.map((m) => m.role));
  const configured = features?.["enabled_roles"];

  let base: OrgRole[];
  if (Array.isArray(configured) && configured.length > 0) {
    base = (configured as string[]).filter((r): r is OrgRole =>
      ORG_ROLES.includes(r as OrgRole),
    );
  } else {
    // If not configured, all roles are available by default
    base = [...ORG_ROLES];
  }

  const set = new Set<OrgRole>(base);
  // Ensure mandatory owner and admin are never missing
  set.add("owner");
  set.add("admin");
  // Ensure any role currently held by an active member remains enabled
  for (const mr of memberRoles) {
    set.add(mr);
  }

  // Preserve canonical ORG_ROLES order
  return ORG_ROLES.filter((r) => set.has(r));
}

/**
 * Determines whether a role can be disabled in the organization settings.
 * - `owner` and `admin` cannot be disabled.
 * - A role currently assigned to active members cannot be disabled until members are reassigned.
 */
export function canDisableRole(
  role: OrgRole,
  currentMembers: { role: OrgRole }[] = [],
): { canDisable: boolean; memberCount: number; reason_ar?: string } {
  if (IMMUTABLE_ROLES.includes(role)) {
    return {
      canDisable: false,
      memberCount: 0,
      reason_ar: "دور إداري أساسي لا يمكن تعطيله لضمان استمرار إدارة المنظمة.",
    };
  }

  const count = currentMembers.filter((m) => m.role === role).length;
  if (count > 0) {
    return {
      canDisable: false,
      memberCount: count,
      reason_ar: `لا يمكن تعطيل هذا الدور لوجود ${count} عضو/أعضاء مسند إليهم حالياً. يجب إعادة تعيين أدوارهم أولاً.`,
    };
  }

  return { canDisable: true, memberCount: 0 };
}
