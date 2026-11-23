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

/** Official authority names (D219: full names; the code is shown beside them). */
export const AUTHORITY_NAMES: Record<string, { ar: string; en: string }> = {
  GMEDIA: { ar: "الهيئة العامة لتنظيم الإعلام", en: "General Authority for Media Regulation" },
  MC: { ar: "وزارة التجارة", en: "Ministry of Commerce" },
  SAMA: { ar: "البنك المركزي السعودي", en: "Saudi Central Bank" },
  SFDA: { ar: "هيئة الغذاء والدواء", en: "Saudi Food and Drug Authority" },
  CMA: { ar: "هيئة السوق المالية", en: "Capital Market Authority" },
  REGA: { ar: "الهيئة العامة للعقار", en: "Real Estate General Authority" },
  SDAIA: {
    ar: "الهيئة السعودية للبيانات والذكاء الاصطناعي",
    en: "Saudi Data and AI Authority",
  },
  IA: { ar: "هيئة التأمين", en: "Insurance Authority" },
  MT: { ar: "وزارة السياحة", en: "Ministry of Tourism" },
  MOHU: { ar: "وزارة الحج والعمرة", en: "Ministry of Hajj and Umrah" },
  INTERNAL: { ar: "فحوص سَليم الداخلية", en: "SALEEM system checks" },
};
export const AUTHORITY_AR: Record<string, string> = Object.fromEntries(
  Object.entries(AUTHORITY_NAMES).map(([k, v]) => [k, v.ar]),
);

/**
 * D219: the status a reader sees, derived only from real data (never an approval SALEEM did not record):
 * active → «سارية» (applied in automatic analysis); a draft whose official source was opened and is in force →
 * «تحتاج مراجعة» (awaiting legal review); any other draft → «قيد التحقق» (its source is still being verified);
 * pending_review → «تحتاج مراجعة»; superseded and archived as they are. Only «سارية» rules are ever evaluated.
 */
export type DisplayStatus = "active" | "needs_review" | "verifying" | "superseded" | "archived";
export function displayStatus(
  r: Pick<EnrichedRule, "review_state" | "source_verification">,
): DisplayStatus {
  switch (r.review_state) {
    case "active":
      return "active";
    case "archived":
      return "archived";
    case "superseded":
      return "superseded";
    case "pending_review":
      return "needs_review";
    default:
      return r.source_verification === "official_text_opened" ? "needs_review" : "verifying";
  }
}

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
