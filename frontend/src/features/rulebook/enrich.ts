// D216: the public rulebook reads rules from the database, which carry their PACK, not an authority or sector code.
// Before this, the page filtered and counted on fields only the static fallback catalog had (authority, sector_code),
// so «GMEDIA» matched nothing and the authority counter showed 0. This maps every database rule to its authority
// (pack → rule_packs.authority, else its regulatory source), its rulebook sector, and its source's verification.
import type { RegulatoryRuleItem } from "./saudiRulesCatalog";

export interface PackRow {
  code: string;
  authority: string;
  name_ar: string;
  name_en: string;
}
export interface SourceRow {
  id: string;
  authority: string;
  title_ar: string;
  title_en: string | null;
  url: string;
  status: string;
  verification: string;
}

export const AUTHORITY_AR: Record<string, string> = {
  SAMA: "البنك المركزي السعودي (SAMA)",
  CMA: "هيئة السوق المالية (CMA)",
  MC: "وزارة التجارة (MC)",
  GMEDIA: "هيئة تنظيم الإعلام (GMEDIA)",
  SFDA: "الغذاء والدواء (SFDA)",
  REGA: "الهيئة العامة للعقار (REGA)",
  SDAIA: "سدايا (SDAIA)",
  IA: "هيئة التأمين (IA)",
  MT: "وزارة السياحة (MT)",
  MOHU: "وزارة الحج والعمرة (MOHU)",
  INTERNAL: "فحوص سَليم الداخلية",
};

/** Rulebook sector filter code of each pack (the filter's existing codes, plus AI, INS, HAJ and SYS). */
const PACK_SECTOR: Record<string, string> = {
  "sa-bank": "BANK",
  "sa-sama-advertising": "BANK",
  "sa-cma": "CMA",
  "sa-cma-securities": "CMA",
  "sa-gen": "GEN",
  "sa-mc-ecommerce": "GEN",
  "sa-sale": "SALE",
  "sa-comp": "COMP",
  "sa-media": "MEDIA",
  "sa-gmedia-creators": "MEDIA",
  "sa-re": "RE",
  "sa-food": "FOOD",
  "sa-drug": "DRUG",
  "sa-dev": "DEV",
  "sa-cos": "COS",
  "sa-tr": "TR",
  "sa-hot": "HOT",
  "sa-pd": "PD",
  "sa-sdaia-ai": "AI",
  "sa-ia-insurance": "INS",
  "sa-haj": "HAJ",
  "sa-system": "SYS",
};

export type EnrichedRule = RegulatoryRuleItem & {
  /** official_text_opened | official_status_unconfirmed | secondary_only | internal | null */
  source_verification: string | null;
  /** in_force | guideline | draft | superseded | unknown | null */
  source_status: string | null;
  source_title: string | null;
};

export function enrichRules(
  rules: Record<string, unknown>[],
  packs: PackRow[],
  sources: SourceRow[],
  sectorLabel: (code: string) => string,
): EnrichedRule[] {
  const pack = new Map(packs.map((p) => [p.code, p]));
  const source = new Map(sources.map((s) => [s.id, s]));
  return rules.map((raw) => {
    const r = raw as unknown as RegulatoryRuleItem & { regulatory_source_id?: string | null };
    const src = r.regulatory_source_id ? source.get(r.regulatory_source_id) : undefined;
    const authority = (r.authority ||
      pack.get(r.pack)?.authority ||
      src?.authority ||
      "OTHER") as string;
    const sector = r.sector_code || PACK_SECTOR[r.pack] || "OTHER";
    return {
      ...r,
      authority: authority as RegulatoryRuleItem["authority"],
      authority_ar: r.authority_ar || AUTHORITY_AR[authority] || authority,
      sector_code: sector,
      sector_ar: r.sector_ar || sectorLabel(sector),
      source_url: r.source_url || src?.url || null,
      source_verification: r.pack === "sa-system" ? "internal" : (src?.verification ?? null),
      source_status: src?.status ?? null,
      source_title: src ? src.title_ar : null,
    };
  });
}
