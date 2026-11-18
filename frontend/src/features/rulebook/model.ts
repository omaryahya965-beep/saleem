import type { TKey } from "@/i18n";

type T = (k: TKey, v?: Record<string, string | number>) => string;

const VALUE_KEY: Record<string, string> = {
  sectors: "products.sectorOpt",
  product_types: "products.typeOpt",
  communication_types: "promo.commType",
  channels: "promo.channel",
  distribution: "promo.distributionOpt",
  audiences_exclude: "promo.audienceOpt",
  regulators: "products.regulatorOpt",
};

/** Applicability JSON rendered as readable lines («متى تنطبق»). */
export function applicabilityLines(app: Record<string, unknown>, t: T): string[] {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(app ?? {})) {
    if (k === "requires_product" && v) lines.push(t("rulebook2.app.requires_product"));
    else if (k === "any_of" && Array.isArray(v))
      lines.push(
        `${t("rulebook2.app.any_of")}: ${v.map((x) => applicabilityLines(x as Record<string, unknown>, t).join("، ")).join(" | ")}`,
      );
    else if (Array.isArray(v) && v.length) {
      const label = t(`rulebook2.app.${k}` as TKey);
      const vals = v.map((x) => {
        const key = `${VALUE_KEY[k]}.${x}` as TKey;
        const tr = VALUE_KEY[k] ? t(key) : String(x);
        return tr === key ? String(x) : tr;
      });
      lines.push(`${label}: ${vals.join("، ")}`);
    }
  }
  return lines;
}
