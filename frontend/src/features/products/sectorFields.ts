// Sector-specific product attributes (V2 upgrade §4.2, D170). Stored under key_facts.<group> so financial key facts
// (apr, fees, term…) keep their existing shape and validation. Every attribute is optional: no fictional values.
import { SECTOR_MODEL, type Sector } from "@/lib/api/promotions";

export type FieldGroup = (typeof SECTOR_MODEL)[Sector]["fields"];
export const SECTOR_FIELDS: Record<Exclude<FieldGroup, "financial">, string[]> = {
  cosmetics: [
    "category",
    "ingredients",
    "intended_use",
    "usage_instructions",
    "warnings",
    "claim_evidence",
    "regulatory_classification",
  ],
  food_health: [
    "ingredients",
    "intended_use",
    "nutrition_or_dosage",
    "warnings",
    "claim_evidence",
    "regulatory_classification",
  ],
  tourism: [
    "destination",
    "duration",
    "price",
    "booking_conditions",
    "cancellation_terms",
    "included",
    "excluded",
  ],
  retail: ["specifications", "price", "warranty", "availability", "conditions"],
  basic: ["description"],
};
export const groupOf = (sector: string): FieldGroup =>
  SECTOR_MODEL[sector as Sector]?.fields ?? "basic";

/** Non-empty attributes for key_facts.<group>; empty when nothing was entered. */
export function attrsToFacts(
  sector: string,
  attrs: Record<string, string>,
): Record<string, unknown> {
  const g = groupOf(sector);
  if (g === "financial") return {};
  const kept = Object.fromEntries(
    SECTOR_FIELDS[g].map((k) => [k, (attrs[k] ?? "").trim()]).filter(([, v]) => v),
  );
  return Object.keys(kept).length ? { [g]: kept } : {};
}
export function factsToAttrs(sector: string, facts: unknown): Record<string, string> {
  const g = groupOf(sector);
  const o = (facts ?? {}) as Record<string, Record<string, string> | undefined>;
  return g === "financial" ? {} : { ...(o[g] ?? {}) };
}
