// Rule selection (04_AI_PIPELINE §5). SALEEM decides which rules apply; the model only sees those.
import type { AnalysisContext, Applicability, PackReason, RuleRow } from "../types.ts";

export interface NotApplicable {
  rule: RuleRow;
  reason: string;
}

const any = (xs: string[] | undefined) => !xs || xs.length === 0 || xs.includes("*");

/** Returns null when the grammar matches, else the reason (`context:<key>`, `audience_excluded`, `requires_product`). */
export function applicabilityMismatch(a: Applicability, ctx: AnalysisContext): string | null {
  const sector = ctx.product?.sector ?? ctx.sector;
  // D213: a rule of a sector the CONTENT points to applies too, whatever sector was selected.
  const sectors = [sector, ...(ctx.contentSectors ?? [])].filter((s): s is string => Boolean(s));
  if (!any(a.sectors) && !sectors.some((s) => a.sectors!.includes(s))) return "context:sector";
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
    const draft = rule.review_state === "draft" || rule.review_state === "legal_review";
    if (draft && !pack?.includeDrafts) {
      notApplicable.push({ rule, reason: "draft_excluded" });
      continue;
    }
    // A draft that may duplicate an existing rule waits for the human mapping review (never applied twice).
    if (draft && rule.possible_duplicate_of) {
      notApplicable.push({ rule, reason: `possible_duplicate:${rule.possible_duplicate_of}` });
      continue;
    }
    const mismatch = applicabilityMismatch(rule.applicability ?? {}, ctx);
    if (mismatch) {
      notApplicable.push({ rule, reason: mismatch });
      continue;
    }
    // In scope but not checked from the ad: a document request or a reviewer checklist item (never the model).
    if (rule.check_mode === "document") notApplicable.push({ rule, reason: "document_required" });
    else if (rule.check_mode === "workflow") notApplicable.push({ rule, reason: "reviewer_checklist" });
    else if (rule.check_kind === "workflow") notApplicable.push({ rule, reason: "workflow_rule" });
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
 * Packs enabled for a run: personal promotions consider every pack (D213); org promotions use their
 * org_rule_packs rows, falling back to each pack's default (enabled_by_default and sector match).
 */
export function enabledPacksFor(
  orgId: string | null,
  sector: string | null,
  packs: { code: string; default_sectors: string[]; enabled_by_default: boolean; always_enabled: boolean; authority?: string }[],
  orgRows: { pack_code: string; enabled: boolean; include_draft_rules: boolean }[],
): { code: string; includeDrafts: boolean; reason: PackReason }[] {
  if (!orgId) {
    // D213: a personal workspace considers EVERY supported authority automatically: all packs are enabled and rule
    // applicability (sector — selected and detected in the content —, channels, paid status, AI use…) decides which
    // rules apply. The user cannot select or exclude authorities. Draft rules are never included.
    return packs.map((p) => ({
      code: p.code,
      includeDrafts: false,
      reason: (p.always_enabled ? "always_enabled" : "personal_all") as PackReason,
    }));
  }
  const rows = new Map(orgRows.map((r) => [r.pack_code, r]));
  const out: { code: string; includeDrafts: boolean; reason: PackReason }[] = [];
  for (const p of packs) {
    const row = rows.get(p.code);
    const byDefault = p.enabled_by_default && (p.default_sectors.length === 0 || (sector !== null && p.default_sectors.includes(sector)));
    const enabled = p.always_enabled || (row ? row.enabled : byDefault);
    const reason: PackReason = p.always_enabled ? "always_enabled" : row ? "org_enabled" : p.default_sectors.length ? "sector_default" : "default";
    if (enabled) out.push({ code: p.code, includeDrafts: Boolean(row?.include_draft_rules), reason });
  }
  return out;
}

/** Org override patch (narrow only): exclusions or disabling for one rule (M8 `org_rule_overrides`). */
export interface RuleOverride {
  rule_code: string;
  applicability_patch: {
    disabled?: boolean;
    exclude_channels?: string[];
    exclude_product_types?: string[];
    exclude_communication_types?: string[];
    exclude_audiences?: string[];
  };
}

/** Applies org overrides after selection: they can only turn an applicable rule into not applicable. */
export function applyOverrides(sel: Selection, ctx: AnalysisContext, overrides: RuleOverride[]): Selection {
  if (!overrides.length) return sel;
  const byCode = new Map(overrides.map((o) => [o.rule_code, o.applicability_patch]));
  const applicable: RuleRow[] = [];
  const notApplicable = [...sel.notApplicable];
  for (const rule of sel.applicable) {
    const p = byCode.get(rule.code);
    const excluded =
      p &&
      !rule.code.startsWith("SYS-") &&
      (p.disabled ||
        (p.exclude_channels?.length && ctx.channels.length > 0 && ctx.channels.every((c) => p.exclude_channels!.includes(c))) ||
        (p.exclude_product_types?.length && ctx.product && p.exclude_product_types.includes(ctx.product.productType)) ||
        (p.exclude_communication_types?.length && p.exclude_communication_types.includes(ctx.communicationType)) ||
        (p.exclude_audiences?.length && ctx.audience.some((a) => p.exclude_audiences!.includes(a))));
    if (excluded) notApplicable.push({ rule, reason: "org_override" });
    else applicable.push(rule);
  }
  return { applicable, notApplicable };
}
