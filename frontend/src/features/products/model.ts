import {
  parseLocalizedNumber,
  validateKeyFacts,
  type KeyFactsIssue,
  type ProductKeyFacts,
} from "@/lib/key-facts";
import { FINANCIAL_SECTORS, type Product, type ProductInput } from "@/lib/api/promotions";
import { attrsToFacts, factsToAttrs } from "./sectorFields";

/** Form state: numbers stay as typed text (Arabic or Latin digits) until submit. */
export interface FeeForm {
  name_ar: string;
  amount: string;
  unit: "percent" | "SAR";
  cap_sar: string;
  vat_included: boolean;
}

export interface ProductForm {
  nameAr: string;
  nameEn: string;
  aliases: string;
  sector: ProductInput["sector"];
  productType: ProductInput["productType"];
  regulator: ProductInput["regulator"];
  apr: string;
  aprType: "" | "fixed" | "variable";
  termMin: string;
  termMax: string;
  fees: FeeForm[];
  requirements: string;
  targetCustomers: string;
  sharia: boolean;
  shariaRef: string;
  /** Non-financial sector attributes (key_facts.<group>), all optional. */
  attrs: Record<string, string>;
}

export const emptyProductForm = (sector: ProductInput["sector"] = "banking"): ProductForm => ({
  nameAr: "",
  nameEn: "",
  aliases: "",
  sector,
  productType: "personal_finance",
  regulator: "SAMA",
  apr: "",
  aprType: "",
  termMin: "",
  termMax: "",
  fees: [],
  requirements: "",
  targetCustomers: "",
  sharia: false,
  shariaRef: "",
  attrs: {},
});

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const num = (s: string): number | null | undefined =>
  s.trim() ? parseLocalizedNumber(s) : undefined;

/** Converts the form into key facts. An unparsable number becomes NaN so validation reports it. */
export function formToKeyFacts(f: ProductForm): ProductKeyFacts {
  // D170: non-financial products never carry (or require) financial key facts.
  if (!FINANCIAL_SECTORS.has(f.sector)) return attrsToFacts(f.sector, f.attrs) as ProductKeyFacts;
  const facts: ProductKeyFacts = {};
  const apr = num(f.apr);
  if (apr !== undefined) facts.apr = { value: apr ?? Number.NaN, type: f.aprType || null };
  const tmin = num(f.termMin);
  const tmax = num(f.termMax);
  if (tmin !== undefined || tmax !== undefined)
    facts.term_months = { min: tmin ?? Number.NaN, max: tmax ?? Number.NaN };
  if (f.fees.length)
    facts.fees = f.fees.map((x) => ({
      name_ar: x.name_ar.trim(),
      amount: num(x.amount) ?? Number.NaN,
      unit: x.unit,
      cap_sar: x.cap_sar.trim() ? (num(x.cap_sar) ?? Number.NaN) : null,
      vat_included: x.vat_included,
    }));
  if (lines(f.requirements).length) facts.min_requirements_ar = lines(f.requirements);
  if (lines(f.targetCustomers).length) facts.target_customers_ar = lines(f.targetCustomers);
  if (f.sharia) {
    facts.sharia_compliant = true;
    facts.sharia_approval_ref = f.shariaRef.trim() || null;
  }
  return facts;
}

export function productToForm(p: Product): ProductForm {
  const k = (p.key_facts ?? {}) as ProductKeyFacts;
  return {
    nameAr: p.name_ar,
    nameEn: p.name_en ?? "",
    aliases: p.aliases.join("، "),
    sector: p.sector as ProductInput["sector"],
    productType: p.product_type as ProductInput["productType"],
    regulator: p.regulator as ProductInput["regulator"],
    apr: k.apr ? String(k.apr.value) : "",
    aprType: k.apr?.type ?? "",
    termMin: k.term_months ? String(k.term_months.min) : "",
    termMax: k.term_months ? String(k.term_months.max) : "",
    fees: (k.fees ?? []).map((x) => ({
      name_ar: x.name_ar,
      amount: String(x.amount),
      unit: x.unit,
      cap_sar: x.cap_sar == null ? "" : String(x.cap_sar),
      vat_included: Boolean(x.vat_included),
    })),
    requirements: (k.min_requirements_ar ?? []).join("\n"),
    targetCustomers: (k.target_customers_ar ?? []).join("\n"),
    sharia: Boolean(k.sharia_compliant),
    shariaRef: k.sharia_approval_ref ?? "",
    attrs: factsToAttrs(p.sector, p.key_facts),
  };
}

export type FormIssue = KeyFactsIssue | { path: "nameAr"; error: "name_required" };

export function validateProductForm(f: ProductForm): FormIssue[] {
  const issues: FormIssue[] = [];
  if (!f.nameAr.trim()) issues.push({ path: "nameAr", error: "name_required" });
  // Financial key facts are validated only for financial products (non-financial attributes are free text).
  if (!FINANCIAL_SECTORS.has(f.sector)) return issues;
  return [...issues, ...validateKeyFacts(formToKeyFacts(f))];
}

export const splitAliases = (s: string) =>
  s
    .split(/[,،\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
