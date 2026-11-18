// Product key facts: the approved figures of a financial product (APR, term, fees…).
// SHARED FILE: an identical copy lives in frontend/src/lib/key-facts.ts (a test keeps them in sync).
// No imports, so it runs in Deno (Edge Functions) and in the browser.

export type AprType = "fixed" | "variable";
export type FeeUnit = "percent" | "SAR";

export interface ProductFee {
  name_ar: string;
  amount: number;
  unit: FeeUnit;
  cap_sar?: number | null;
  vat_included?: boolean | null;
}

export interface ProductKeyFacts {
  apr?: { value: number; type: AprType | null } | null;
  term_months?: { min: number; max: number } | null;
  fees?: ProductFee[];
  min_requirements_ar?: string[];
  target_customers_ar?: string[];
  sharia_compliant?: boolean | null;
  sharia_approval_ref?: string | null;
}

/** Error keys are i18n keys under `products.errors.*`. */
export type KeyFactsError =
  | "apr_range"
  | "apr_type"
  | "term_range"
  | "term_order"
  | "fee_name"
  | "fee_amount"
  | "fee_unit"
  | "fee_percent_range"
  | "fee_cap"
  | "not_object"
  | "list_item";

export interface KeyFactsIssue {
  path: string;
  error: KeyFactsError;
}

/** Unvalidated input: every field optional and of unknown type. */
interface LooseFee {
  name_ar?: unknown;
  amount?: unknown;
  unit?: unknown;
  cap_sar?: unknown;
}
interface LooseFacts {
  apr?: { value?: unknown; type?: unknown } | null;
  term_months?: { min?: unknown; max?: unknown } | null;
  fees?: unknown;
  min_requirements_ar?: unknown;
  target_customers_ar?: unknown;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const strList = (v: unknown) =>
  Array.isArray(v) && v.every((x) => typeof x === "string" && x.trim().length > 0);

/** Validates key facts. Returns an empty list when valid. Unknown keys are rejected as `not_object`. */
export function validateKeyFacts(input: unknown): KeyFactsIssue[] {
  const issues: KeyFactsIssue[] = [];
  if (input === null || typeof input !== "object" || Array.isArray(input))
    return [{ path: "", error: "not_object" }];
  const f = input as LooseFacts;
  const allowed = new Set([
    "apr",
    "term_months",
    "fees",
    "min_requirements_ar",
    "target_customers_ar",
    "sharia_compliant",
    "sharia_approval_ref",
  ]);
  for (const k of Object.keys(f))
    if (!allowed.has(k)) issues.push({ path: k, error: "not_object" });

  if (f.apr != null) {
    const a = f.apr;
    if (!isNum(a.value) || a.value < 0 || a.value > 100)
      issues.push({ path: "apr.value", error: "apr_range" });
    if (a.type != null && a.type !== "fixed" && a.type !== "variable")
      issues.push({ path: "apr.type", error: "apr_type" });
  }
  if (f.term_months != null) {
    const t = f.term_months;
    const ok = (n: unknown) => isNum(n) && Number.isInteger(n) && n >= 1 && n <= 600;
    if (!ok(t.min) || !ok(t.max)) issues.push({ path: "term_months", error: "term_range" });
    else if ((t.min as number) > (t.max as number))
      issues.push({ path: "term_months", error: "term_order" });
  }
  if (f.fees != null) {
    if (!Array.isArray(f.fees)) issues.push({ path: "fees", error: "not_object" });
    else
      f.fees.forEach((raw, i) => {
        const fee = (raw ?? {}) as LooseFee;
        if (typeof fee.name_ar !== "string" || !fee.name_ar.trim())
          issues.push({ path: `fees.${i}.name_ar`, error: "fee_name" });
        if (!isNum(fee.amount) || fee.amount < 0)
          issues.push({ path: `fees.${i}.amount`, error: "fee_amount" });
        if (fee.unit !== "percent" && fee.unit !== "SAR")
          issues.push({ path: `fees.${i}.unit`, error: "fee_unit" });
        if (fee.unit === "percent" && isNum(fee.amount) && fee.amount > 100)
          issues.push({ path: `fees.${i}.amount`, error: "fee_percent_range" });
        if (fee.cap_sar != null && (!isNum(fee.cap_sar) || fee.cap_sar < 0))
          issues.push({ path: `fees.${i}.cap_sar`, error: "fee_cap" });
      });
  }
  for (const k of ["min_requirements_ar", "target_customers_ar"] as const) {
    if (f[k] != null && !strList(f[k])) issues.push({ path: k, error: "list_item" });
  }
  return issues;
}

/** Parses a number typed by a user: accepts Arabic-Indic digits, Arabic decimal/thousands separators and «٪». */
export function parseLocalizedNumber(text: string): number | null {
  const ascii = text
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, ".")
    .replace(/[\u066C,\s]/g, "")
    .replace(/[%\u066A]$/, "");
  if (!/^-?\d+(\.\d+)?$/.test(ascii)) return null;
  return Number(ascii);
}
