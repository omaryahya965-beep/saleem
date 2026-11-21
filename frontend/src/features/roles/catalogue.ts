// Roles page catalogue (V2 completion §5, D195). Functional areas over the server-enforced actions. The first set
// comes from lib/permissions.ts (the matrix generated into pgTAP p8); the extra rows document RPC rules added in
// D172–D190 exactly as the database enforces them (pgTAP p9–p12). Display only: `can()` is unchanged.
import { ACTIONS, ORG_ROLES, type Action, type Cell, type OrgRole } from "@/lib/permissions";

const r = (...c: Cell[]): Record<OrgRole, Cell> =>
  Object.fromEntries(ORG_ROLES.map((role, i) => [role, c[i]!])) as Record<OrgRole, Cell>;

export interface CatalogueRow {
  key: string;
  cells: Record<OrgRole, Cell>;
  enforcedBy: string;
  /** i18n key of the condition, when any cell is conditional. */
  conditionKey?: string;
  conditionAr?: string;
}
// Order of ORG_ROLES: owner, admin, compliance_lead, reviewer, legal, creator, external_uploader, external_reviewer, viewer.
export const EXTRA: Record<string, CatalogueRow> = {
  respond_findings: {
    key: "respond_findings",
    cells: r("yes", "yes", "cond", "cond", "no", "yes", "cond", "no", "no"),
    enforcedBy: "respond_finding (uploader side)",
    conditionKey: "own_ad",
  },
  assess_findings: {
    key: "assess_findings",
    cells: r("cond", "cond", "cond", "cond", "no", "no", "no", "no", "no"),
    enforcedBy: "respond_finding (reviewer side)",
    conditionKey: "decider",
  },
  fulfil_conditions: {
    key: "fulfil_conditions",
    cells: r("yes", "yes", "cond", "cond", "no", "yes", "cond", "no", "no"),
    enforcedBy: "save_condition_response, submit_conditions",
    conditionKey: "own_ad",
  },
  verify_conditions: {
    key: "verify_conditions",
    cells: r("cond", "cond", "cond", "cond", "no", "no", "no", "no", "no"),
    enforcedBy: "verify_condition, finalize_conditional_approval",
    conditionKey: "decider",
  },
  self_approve: {
    key: "self_approve",
    cells: r("cond", "cond", "cond", "cond", "no", "cond", "cond", "no", "no"),
    enforcedBy: "can_self_approve",
    conditionKey: "self_approval",
  },
  verify_license: {
    key: "verify_license",
    cells: r("cond", "cond", "cond", "cond", "no", "no", "no", "no", "no"),
    enforcedBy: "verify_creator_license",
    conditionKey: "decider",
  },
  manage_partner_links: {
    key: "manage_partner_links",
    cells: r("yes", "yes", "no", "no", "no", "no", "no", "no", "no"),
    enforcedBy: "create_partner_link_v2, rotate_partner_link",
  },
  use_saleem_fix: {
    key: "use_saleem_fix",
    cells: r("yes", "yes", "cond", "no", "no", "yes", "cond", "no", "no"),
    enforcedBy: "can_fix_promotion",
    conditionKey: "own_ad_fix",
  },
  propose_claim: {
    key: "propose_claim",
    cells: r("yes", "yes", "yes", "yes", "no", "cond", "no", "no", "no"),
    enforcedBy: "save_claim, submit_claim",
    conditionKey: "own_claims",
  },
  approve_claim: {
    key: "approve_claim",
    cells: r("cond", "cond", "cond", "cond", "no", "no", "no", "no", "no"),
    enforcedBy: "review_claim",
    conditionKey: "not_author",
  },
  mention: {
    key: "mention",
    cells: r("yes", "yes", "yes", "yes", "cond", "cond", "no", "no", "no"),
    enforcedBy: "comment_participants, add_comment",
    conditionKey: "readers_only",
  },
};

export const AREAS: { key: string; actions: (Action | keyof typeof EXTRA)[] }[] = [
  { key: "advertisements", actions: ["view_promotions", "create_promotion", "submit_for_review"] },
  { key: "analysis", actions: ["respond_findings"] },
  {
    key: "review",
    actions: ["assess_findings", "request_changes_comment", "assign_reviewer", "verify_license"],
  },
  {
    key: "decisions",
    actions: ["decide_review", "verify_conditions", "self_approve", "accept_risk"],
  },
  { key: "conditions", actions: ["fulfil_conditions"] },
  { key: "products", actions: ["manage_products"] },
  { key: "claims", actions: ["propose_claim", "approve_claim"] },
  { key: "legal", actions: ["escalate_legal", "legal_opinion"] },
  { key: "organization", actions: ["manage_members", "manage_settings", "manage_rule_packs"] },
  { key: "external", actions: ["manage_partner_links"] },
  { key: "analytics", actions: ["view_analytics"] },
  { key: "ai", actions: ["use_saleem_fix"] },
  { key: "policies", actions: ["manage_company_rules", "approve_company_rules"] },
  { key: "collaboration", actions: ["comment", "mention"] },
];

export function rowOf(a: string): CatalogueRow {
  if (a in EXTRA) return EXTRA[a]!;
  const def = ACTIONS[a as Action] as {
    cells: Record<OrgRole, Cell>;
    enforcedBy: string;
    condition_ar?: string;
  };
  return { key: a, cells: def.cells, enforcedBy: def.enforcedBy, conditionAr: def.condition_ar };
}

export const PRIMARY_ROLES: OrgRole[] = ["admin", "creator", "reviewer", "external_uploader"];
export const ADDITIONAL_ROLES: OrgRole[] = [
  "owner",
  "compliance_lead",
  "legal",
  "external_reviewer",
  "viewer",
];
