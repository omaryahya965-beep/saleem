import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import {
  AUDIENCES,
  CHANNELS,
  COMMUNICATION_TYPES,
  DISTRIBUTIONS,
  type CommunicationType,
  type Product,
} from "@/lib/api/promotions";

export type { ContextValue } from "./model";
import type { ContextValue } from "./model";

/** Multi-select as a wrapping group of checkboxes (works with screen readers and on mobile). */
function CheckGroup({
  legend,
  options,
  value,
  onChange,
  labelOf,
}: {
  legend: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  labelOf: (o: string) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-fg">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((o) => (
          <Checkbox
            key={o}
            label={labelOf(o)}
            checked={value.includes(o)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Ad context for organisation promotions (05_UX_SPEC §3). */
export function ContextFields({
  value,
  onChange,
  products,
}: {
  value: ContextValue;
  onChange: (v: ContextValue) => void;
  products: Product[];
}) {
  const { t, lang } = useI18n();
  const set = <K extends keyof ContextValue>(k: K, v: ContextValue[K]) =>
    onChange({ ...value, [k]: v });
  const usable = products.filter((p) => p.status !== "archived");
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("promo.product")} hint={t("promo.productHint")}>
          <Select
            value={value.productId ?? ""}
            onChange={(e) => set("productId", e.target.value || null)}
          >
            <option value="">{t("promo.noProduct")}</option>
            {usable.map((p) => (
              <option key={p.id} value={p.id}>
                {(lang === "en" && p.name_en) || p.name_ar}
                {p.status === "draft" ? ` — ${t("products.status.draft")}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("promo.communicationType")}>
          <Select
            value={value.communicationType}
            onChange={(e) => set("communicationType", e.target.value as CommunicationType)}
          >
            {COMMUNICATION_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`promo.commType.${c}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <CheckGroup
        legend={t("promo.channels")}
        options={CHANNELS}
        value={value.channels}
        onChange={(v) => set("channels", v)}
        labelOf={(o) => t(`promo.channel.${o}` as TKey)}
      />
      <CheckGroup
        legend={t("promo.audience")}
        options={AUDIENCES}
        value={value.audience}
        onChange={(v) => set("audience", v)}
        labelOf={(o) => t(`promo.audienceOpt.${o}` as TKey)}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("promo.paid")}>
          <Select
            value={value.isPaid === null ? "" : String(value.isPaid)}
            onChange={(e) =>
              set("isPaid", e.target.value === "" ? null : e.target.value === "true")
            }
          >
            <option value="">{t("promo.unknown")}</option>
            <option value="true">{t("common.yes")}</option>
            <option value="false">{t("common.no")}</option>
          </Select>
        </Field>
        <Field label={t("promo.distribution")}>
          <Select
            value={value.distribution ?? ""}
            onChange={(e) =>
              set("distribution", (e.target.value || null) as ContextValue["distribution"])
            }
          >
            <option value="">{t("promo.unknown")}</option>
            {DISTRIBUTIONS.map((d) => (
              <option key={d} value={d}>
                {t(`promo.distributionOpt.${d}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
        {value.distribution === "influencer" && (
          <Field label={t("promo.creatorLicense")} hint={t("promo.creatorLicenseHint")}>
            <Input
              value={value.creatorLicenseNo ?? ""}
              onChange={(e) => set("creatorLicenseNo", e.target.value)}
              dir="ltr"
              maxLength={60}
              className="text-start rtl:text-end"
            />
          </Field>
        )}
        <Field label={t("promo.deadline")} optional optionalLabel={t("common.optional")}>
          <Input
            type="date"
            value={value.deadlineAt ? value.deadlineAt.slice(0, 10) : ""}
            onChange={(e) =>
              set(
                "deadlineAt",
                e.target.value ? new Date(`${e.target.value}T23:59:00`).toISOString() : null,
              )
            }
          />
        </Field>
      </div>

      <Field
        label={t("promo.reviewerNotes")}
        hint={t("promo.reviewerNotesHint")}
        optional
        optionalLabel={t("common.optional")}
      >
        <Textarea
          rows={3}
          value={value.reviewerNotes ?? ""}
          onChange={(e) => set("reviewerNotes", e.target.value)}
          maxLength={5000}
          dir="auto"
        />
      </Field>
    </div>
  );
}
