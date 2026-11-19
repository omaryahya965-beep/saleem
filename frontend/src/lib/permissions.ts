// The single permission matrix for organisation roles (Phase 8, step 5).
// Source of truth for: the UI (`can`), the SQL function `public.org_can` (hand-written to match), and the generated
// pgTAP test `backend/supabase/tests/p8_roles_matrix.test.sql` (backend/scripts/gen-permission-tests.mjs), which
// fails if the SQL and this file disagree. Conditional cells are enforced inside the RPC named in `enforcedBy`.
// Keep this file free of imports: the generator loads it with `node --experimental-strip-types`.

export const ORG_ROLES = [
  "owner",
  "admin",
  "compliance_lead",
  "reviewer",
  "legal",
  "creator",
  "external_uploader",
  "external_reviewer",
  "viewer",
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** yes = always; cond = only when the condition holds (checked by the RPC); no = never. */
export type Cell = "yes" | "cond" | "no";

export interface ActionDef {
  /** Roles in ORG_ROLES order. */
  cells: Record<OrgRole, Cell>;
  /** Arabic one-line condition shown on conditional cells and on disabled buttons. */
  condition_ar?: string;
  /** The SQL function or policy that enforces the action. */
  enforcedBy: string;
}

const row = (
  owner: Cell,
  admin: Cell,
  compliance_lead: Cell,
  reviewer: Cell,
  legal: Cell,
  creator: Cell,
  external_uploader: Cell,
  external_reviewer: Cell,
  viewer: Cell,
): Record<OrgRole, Cell> => ({
  owner,
  admin,
  compliance_lead,
  reviewer,
  legal,
  creator,
  external_uploader,
  external_reviewer,
  viewer,
});

export const ACTIONS = {
  view_promotions: {
    cells: row("yes", "yes", "yes", "yes", "yes", "cond", "cond", "cond", "yes"),
    condition_ar: "إعلاناته فقط (أو ما شُورك معه)",
    enforcedBy: "can_read_promotion",
  },
  create_promotion: {
    cells: row("yes", "yes", "no", "no", "no", "yes", "cond", "no", "no"),
    condition_ar: "عبر رابط الشريك فقط",
    enforcedBy: "promotions_insert / partner_create_promotion",
  },
  submit_for_review: {
    cells: row("yes", "yes", "cond", "cond", "cond", "yes", "cond", "no", "no"),
    condition_ar: "لإعلاناته فقط",
    enforcedBy: "can_submit",
  },
  request_changes_comment: {
    cells: row("yes", "yes", "yes", "yes", "no", "no", "no", "no", "no"),
    enforcedBy: "add_comment (change_request)",
  },
  comment: {
    cells: row("yes", "yes", "yes", "yes", "yes", "cond", "cond", "cond", "no"),
    condition_ar: "على إعلان يستطيع رؤيته",
    enforcedBy: "add_comment",
  },
  decide_review: {
    cells: row("cond", "cond", "cond", "cond", "no", "no", "no", "no", "no"),
    condition_ar:
      "ليس رافع الإعلان، والمراجع للحالات المُسندة إليه فقط، ولا يوجد مسار اعتماد متعدد المراحل",
    enforcedBy: "can_decide",
  },
  assign_reviewer: {
    // Reviewers never assign, not even to themselves (D169).
    cells: row("yes", "yes", "yes", "no", "no", "no", "no", "no", "no"),
    enforcedBy: "assign_reviewer",
  },
  escalate_legal: {
    cells: row("cond", "cond", "cond", "cond", "no", "no", "no", "no", "no"),
    condition_ar: "الإعلان قيد المراجعة وليس رافعه",
    enforcedBy: "escalate_promotion",
  },
  legal_opinion: {
    cells: row("no", "no", "no", "no", "yes", "no", "no", "no", "no"),
    enforcedBy: "respond_escalation",
  },
  accept_risk: {
    cells: row("cond", "cond", "cond", "cond", "cond", "no", "no", "no", "no"),
    condition_ar: "يملك صلاحية «قابل المخاطر» وفُعّلت الميزة",
    enforcedBy: "set_risk_acceptor / accept_risk",
  },
  manage_members: {
    cells: row("yes", "cond", "no", "no", "no", "no", "no", "no", "no"),
    condition_ar: "لا يمنح دور المالك ولا يغيّر مالكاً",
    enforcedBy: "set_org_member_role / create_org_invite",
  },
  manage_rule_packs: {
    cells: row("yes", "yes", "yes", "no", "no", "no", "no", "no", "no"),
    enforcedBy: "set_org_rule_pack / set_rule_override",
  },
  manage_company_rules: {
    cells: row("yes", "yes", "yes", "no", "no", "no", "no", "no", "no"),
    enforcedBy: "can_manage_internal_rules",
  },
  approve_company_rules: {
    cells: row("cond", "cond", "cond", "no", "no", "no", "no", "no", "no"),
    condition_ar: "ليس كاتب القاعدة",
    enforcedBy: "approve_internal_rule",
  },
  manage_products: {
    cells: row("yes", "yes", "no", "no", "no", "no", "no", "no", "no"),
    enforcedBy: "products_insert / approve_product",
  },
  manage_settings: {
    cells: row("yes", "yes", "no", "no", "no", "no", "no", "no", "no"),
    enforcedBy: "org_settings update / presets / API keys / webhooks / partners",
  },
  view_analytics: {
    cells: row("yes", "yes", "yes", "no", "no", "no", "no", "no", "yes"),
    enforcedBy: "org_metrics",
  },
} as const satisfies Record<string, ActionDef>;
export type Action = keyof typeof ACTIONS;

export function cell(role: OrgRole | null | undefined, action: Action): Cell {
  if (!role) return "no";
  return ACTIONS[action].cells[role];
}

/** True when the role may attempt the action (conditional cells are checked by the server). */
export function can(role: OrgRole | null | undefined, action: Action): boolean {
  return cell(role, action) !== "no";
}

/** The Arabic condition of a conditional action, if any. */
export function conditionOf(action: Action): string | undefined {
  return (ACTIONS[action] as ActionDef).condition_ar;
}
