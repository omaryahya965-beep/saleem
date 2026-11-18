// Rule selection (04_AI_PIPELINE §5). SALEEM decides which rules apply; the model only sees those.
import type { AnalysisContext, Applicability, RuleRow } from "../types.ts";

export interface NotApplicable {
  rule: RuleRow;
  reason: string;
}

const any = (xs: string[] | undefined) => !xs || xs.length === 0 || xs.includes("*");

/** Returns null when the grammar matches, else the reason (`context:<key>`, `audience_excluded`, `requires_product`). */
export function applicabilityMismatch(a: Applicability, ctx: AnalysisContext): string | null {
  const sector = ctx.product?.sector ?? ctx.sector;
  if (!any(a.sectors) && !(sector && a.sectors!.includes(sector))) return "context:sector";
  if (!any(a.regulators) && ctx.product && !a.regulators!.includes(ctx.product.regulator)) return "context:regulator";
  if (!any(a.communication_types) && !a.communication_types!.includes(ctx.communicationType)) return "context:communication_type";
  if (a.requires_product && !ctx.product) return "requires_product";
  if (!any(a.product_types) && !(ctx.product && a.product_types!.includes(ctx.product.productType))) return "context:product_type";
  if (!any(a.channels) && !ctx.channels.some((c) => a.channels!.includes(c))) return "context:channel";
  if (!any(a.distribution) && !(ctx.distribution && a.distribution!.includes(ctx.distribution))) return "context:distribution";
  if (a.audiences_exclude?.length && ctx.audience.some((x) => a.audiences_exclude!.includes(x))) return "audience_excluded";
  if (a.any_of?.length) {
    const reasons = a.any_of.map((sub) => applicabilityMismatch(sub, ctx));
    if (reasons.every((r) => r !== null)) return reasons[0]!;
  }
  return null;
}

export interface Selection {
  applicable: RuleRow[];
  notApplicable: NotApplicable[];
}

/**
 * Order: pack enabled → review state (archived never; drafts only when the org opted in) → workflow →
 * applicability grammar. Rules without a pack (legacy rows) apply as before.
 */
export function selectRules(ctx: AnalysisContext, rules: RuleRow[]): Selection {
  const packs = new Map(ctx.enabledPacks.map((p) => [p.code, p]));
  const applicable: RuleRow[] = [];
  const notApplicable: NotApplicable[] = [];
  for (const rule of rules) {
    if (rule.review_state === "archived") continue;
    const pack = rule.pack ? packs.get(rule.pack) : undefined;
    if (rule.pack && !pack) {
      notApplicable.push({ rule, reason: "pack_disabled" });
      continue;
    }
    if ((rule.review_state === "draft" || rule.review_state === "legal_review") && !pack?.includeDrafts) {
      notApplicable.push({ rule, reason: "draft_excluded" });
      continue;
    }
    if (rule.check_kind === "workflow") {
      notApplicable.push({ rule, reason: "workflow_rule" });
      continue;
    }
    const mismatch = applicabilityMismatch(rule.applicability ?? {}, ctx);
    if (mismatch) notApplicable.push({ rule, reason: mismatch });
    else applicable.push(rule);
  }
  return { applicable, notApplicable };
}

/** After extraction: rules whose content triggers are all absent become not applicable. */
export function applyTriggers(sel: Selection, signals: Set<string>): Selection {
  const applicable: RuleRow[] = [];
  const notApplicable = [...sel.notApplicable];
  for (const rule of sel.applicable) {
    const triggers = rule.content_triggers ?? [];
    if (triggers.length && !triggers.some((t) => signals.has(t))) {
      notApplicable.push({ rule, reason: `trigger_absent:${triggers[0]}` });
    } else applicable.push(rule);
  }
  return { applicable, notApplicable };
}

export const CREATOR_PACKS = ["sa-gmedia-creators", "sa-sdaia-ai", "sa-mc-ecommerce", "sa-system"];

/**
 * Packs enabled for a run: personal promotions get the creator defaults; org promotions use their
 * org_rule_packs rows, falling back to each pack's default (enabled_by_default and sector match).
 */
export function enabledPacksFor(
  orgId: string | null,
  sector: string | null,
  packs: { code: string; default_sectors: string[]; enabled_by_default: boolean; always_enabled: boolean }[],
  orgRows: { pack_code: string; enabled: boolean; include_draft_rules: boolean }[],
): { code: string; includeDrafts: boolean }[] {
  if (!orgId) return CREATOR_PACKS.map((code) => ({ code, includeDrafts: false }));
  const rows = new Map(orgRows.map((r) => [r.pack_code, r]));
  const out: { code: string; includeDrafts: boolean }[] = [];
  for (const p of packs) {
    const row = rows.get(p.code);
    const byDefault = p.enabled_by_default && (p.default_sectors.length === 0 || (sector !== null && p.default_sectors.includes(sector)));
    const enabled = p.always_enabled || (row ? row.enabled : byDefault);
    if (enabled) out.push({ code: p.code, includeDrafts: Boolean(row?.include_draft_rules) });
  }
  return out;
}
