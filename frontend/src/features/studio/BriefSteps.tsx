// Studio steps 1–3 (D207): product and campaign, creative direction, regulatory context. Product data is reused
// from the product library when chosen; only "verified claims" may be stated as facts in the script.
import { ImagePlus, Info, ShieldCheck, X } from "lucide-react";
import { Badge, Card, CardTitle, Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  CHANNELS,
  COMMUNICATION_TYPES,
  DISTRIBUTIONS,
  SECTORS,
  type Product,
} from "@/lib/api/promotions";
import { platformDefaults, type Aspect, type StudioBrief } from "@/lib/api/studio";
import type { StudioMedia } from "./MediaSteps";
import { disclosuresFor } from "./disclosures";

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);

export function BriefStep({
  brief,
  onChange,
  products,
  media,
  onMedia,
}: {
  brief: StudioBrief;
  onChange: (b: StudioBrief) => void;
  products: Product[];
  media: StudioMedia;
  onMedia: (m: StudioMedia) => void;
}) {
  const { t, lang } = useI18n();
  const set = <K extends keyof StudioBrief>(k: K, v: StudioBrief[K]) =>
    onChange({ ...brief, [k]: v });
  const pickProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const facts = (p.key_facts ?? {}) as { claims?: unknown };
    const claims = Array.isArray(facts.claims)
      ? facts.claims.filter((c): c is string => typeof c === "string")
      : [];
    onChange({
      ...brief,
      product: {
        ...brief.product,
        name: (lang === "en" && p.name_en) || p.name_ar,
        sector: p.sector,
        verified_claims: claims.length ? claims : brief.product.verified_claims,
      },
    });
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const next = [...media.photos];
    for (const f of Array.from(files).slice(0, 8 - next.length)) {
      if (!f.type.startsWith("image/")) continue;
      next.push({ name: f.name, url: URL.createObjectURL(f), file: f });
    }
    onMedia({ ...media, photos: next });
  };
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <CardTitle>{t("studio.brief.product")}</CardTitle>
        {products.length > 0 && (
          <Field
            label={t("studio.brief.fromLibrary")}
            optional
            optionalLabel={t("common.optional")}
          >
            <Select defaultValue="" onChange={(e) => pickProduct(e.target.value)}>
              <option value="">—</option>
              {products
                .filter((p) => p.status !== "archived")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_ar}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("studio.brief.productName")}>
            <Input
              value={brief.product.name}
              onChange={(e) => set("product", { ...brief.product, name: e.target.value })}
              dir="auto"
              data-testid="studio-product-name"
            />
          </Field>
          <Field label={t("studio.brief.sector")}>
            <Select
              value={brief.product.sector ?? ""}
              onChange={(e) => set("product", { ...brief.product, sector: e.target.value || null })}
            >
              <option value="">—</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {t(`ws.sector.${s}` as TKey)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("studio.brief.description")}>
          <Textarea
            rows={2}
            value={brief.product.description}
            onChange={(e) => set("product", { ...brief.product, description: e.target.value })}
            dir="auto"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("studio.brief.verified")} hint={t("studio.brief.verifiedHint")}>
            <Textarea
              rows={3}
              defaultValue={brief.product.verified_claims.join("\n")}
              onBlur={(e) =>
                set("product", { ...brief.product, verified_claims: lines(e.target.value) })
              }
              dir="auto"
              data-testid="studio-verified"
            />
          </Field>
          <Field
            label={t("studio.brief.benefits")}
            hint={t("studio.brief.benefitsHint")}
            optional
            optionalLabel={t("common.optional")}
          >
            <Textarea
              rows={3}
              defaultValue={brief.product.benefits.join("\n")}
              onBlur={(e) => set("product", { ...brief.product, benefits: lines(e.target.value) })}
              dir="auto"
            />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>{t("studio.brief.brand")}</CardTitle>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field label={t("studio.brief.brandName")}>
            <Input
              value={brief.brand.name}
              onChange={(e) => set("brand", { ...brief.brand, name: e.target.value })}
              dir="auto"
            />
          </Field>
          <fieldset className="flex items-end gap-3">
            <legend className="mb-1.5 text-sm font-medium">{t("studio.brief.colors")}</legend>
            {[0, 1].map((i) => (
              <input
                key={i}
                type="color"
                aria-label={`${t("studio.brief.colors")} ${i + 1}`}
                value={brief.brand.colors[i] ?? "#0b6e4f"}
                onChange={(e) => {
                  const c = [...brief.brand.colors];
                  c[i] = e.target.value;
                  set("brand", { ...brief.brand, colors: c });
                }}
                className="h-11 w-14 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
              />
            ))}
          </fieldset>
        </div>
        <Field label={t("studio.brief.identity")} optional optionalLabel={t("common.optional")}>
          <Textarea
            rows={2}
            value={brief.brand.identity}
            onChange={(e) => set("brand", { ...brief.brand, identity: e.target.value })}
            dir="auto"
          />
        </Field>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">{t("studio.brief.assets")}</p>
          <div className="flex flex-wrap gap-3">
            {media.photos.map((p, i) => (
              <figure key={p.url} className="relative m-0">
                <img
                  src={p.url}
                  alt={p.name}
                  className="size-20 rounded-md object-cover ring-1 ring-border"
                />
                <button
                  type="button"
                  aria-label={t("studio.brief.removePhoto")}
                  onClick={() =>
                    onMedia({ ...media, photos: media.photos.filter((_, k) => k !== i) })
                  }
                  className="absolute -end-2 -top-2 grid size-6 place-items-center rounded-full bg-ink text-paper"
                >
                  <X className="size-3.5" />
                </button>
              </figure>
            ))}
            <label className="grid size-20 cursor-pointer place-items-center rounded-md border-2 border-dashed border-border-strong text-fg-muted hover:bg-sunken">
              <ImagePlus aria-hidden="true" className="size-6" />
              <span className="sr-only">{t("studio.brief.addPhotos")}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                data-testid="studio-photos"
                onChange={(e) => void addPhotos(e.target.files)}
              />
            </label>
            <label
              className={cn(
                "flex h-20 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-sunken",
                media.logo && "border-green",
              )}
            >
              {media.logo ? (
                <img src={media.logo.url} alt="" className="size-12 object-contain" />
              ) : (
                <ImagePlus aria-hidden="true" className="size-5" />
              )}
              {t("studio.brief.logo")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    onMedia({
                      ...media,
                      logo: { name: f.name, url: URL.createObjectURL(f), file: f },
                    });
                }}
              />
            </label>
          </div>
          <p className="text-xs text-fg-muted">{t("studio.brief.assetsNote")}</p>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>{t("studio.brief.campaign")}</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("studio.brief.campaignName")}
            optional
            optionalLabel={t("common.optional")}
          >
            <Input
              value={brief.campaign.name}
              onChange={(e) => set("campaign", { ...brief.campaign, name: e.target.value })}
              dir="auto"
            />
          </Field>
          <Field label={t("studio.brief.platform")}>
            <Select
              value={brief.campaign.platform}
              onChange={(e) => {
                const platform = e.target.value;
                onChange({
                  ...brief,
                  ...platformDefaults(platform),
                  campaign: { ...brief.campaign, platform },
                  context: { ...brief.context, channels: [platform] },
                });
              }}
            >
              {["instagram", "snapchat", "tiktok", "youtube", "x"].map((c) => (
                <option key={c} value={c}>
                  {t(`promo.channel.${c}` as TKey)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("studio.brief.objective")}>
          <Input
            value={brief.campaign.objective}
            onChange={(e) => set("campaign", { ...brief.campaign, objective: e.target.value })}
            dir="auto"
          />
        </Field>
        <Field label={t("studio.brief.audience")}>
          <Input
            value={brief.campaign.audience}
            onChange={(e) => set("campaign", { ...brief.campaign, audience: e.target.value })}
            dir="auto"
          />
        </Field>
      </Card>
    </div>
  );
}

const ASPECTS: Aspect[] = ["9:16", "16:9", "1:1"];
const STYLES = ["product", "presenter", "lifestyle", "animated"] as const;

export function DirectionStep({
  brief,
  onChange,
}: {
  brief: StudioBrief;
  onChange: (b: StudioBrief) => void;
}) {
  const { t } = useI18n();
  const set = <K extends keyof StudioBrief>(k: K, v: StudioBrief[K]) =>
    onChange({ ...brief, [k]: v });
  return (
    <Card className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("studio.dir.duration")}>
          <Select
            value={String(brief.duration)}
            onChange={(e) => set("duration", Number(e.target.value))}
          >
            {[6, 10, 15, 20, 30, 45, 60].map((d) => (
              <option key={d} value={d}>
                {t("studio.dir.seconds", { n: d })}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">{t("studio.dir.aspect")}</legend>
          <div className="flex flex-wrap gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={brief.aspect === a}
                onClick={() => set("aspect", a)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm",
                  brief.aspect === a
                    ? "border-ink bg-ink text-paper"
                    : "border-border hover:bg-sunken",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block rounded-sm border-2 border-current",
                    a === "9:16" ? "h-5 w-3" : a === "16:9" ? "h-3 w-5" : "size-4",
                  )}
                />
                {a} · {t(`studio.dir.aspectName.${a.replace(":", "_")}` as TKey)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t("studio.dir.style")}</legend>
        <div className="grid gap-2 sm:grid-cols-4">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={brief.style === s}
              onClick={() => set("style", s)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-md border p-3 text-start text-sm",
                brief.style === s ? "border-ink ring-1 ring-ink" : "border-border hover:bg-sunken",
              )}
            >
              <span className="font-medium">{t(`studio.dir.styles.${s}.title` as TKey)}</span>
              <span className="text-xs text-fg-muted">
                {t(`studio.dir.styles.${s}.body` as TKey)}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t("studio.dir.language")}>
          <Select
            value={brief.language}
            onChange={(e) => set("language", e.target.value as StudioBrief["language"])}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label={t("studio.dir.dialect")}>
          <Select
            value={brief.dialect}
            disabled={brief.language !== "ar"}
            onChange={(e) => set("dialect", e.target.value as StudioBrief["dialect"])}
          >
            <option value="msa">{t("studio.dir.msa")}</option>
            <option value="saudi">{t("studio.dir.saudi")}</option>
          </Select>
        </Field>
        <Field label={t("studio.dir.narration")}>
          <Select
            value={brief.narration}
            onChange={(e) => set("narration", e.target.value as StudioBrief["narration"])}
          >
            {(["male", "female", "none"] as const).map((n) => (
              <option key={n} value={n}>
                {t(`studio.dir.narr.${n}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("studio.dir.tone")}>
          <Select value={brief.tone} onChange={(e) => set("tone", e.target.value)}>
            {["warm", "confident", "playful", "formal"].map((x) => (
              <option key={x} value={x}>
                {t(`studio.dir.tones.${x}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {brief.language === "ar" && brief.narration === "female" && (
        <p className="flex items-start gap-2 rounded-md bg-amber-bg px-3 py-2 text-sm text-amber-text">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("studio.dir.femaleArNote")}
        </p>
      )}
      <Field label={t("studio.dir.cta")}>
        <Input
          value={brief.cta}
          onChange={(e) => set("cta", e.target.value)}
          dir="auto"
          placeholder={t("studio.dir.ctaPh")}
        />
      </Field>
      <Field label={t("studio.dir.instructions")} optional optionalLabel={t("common.optional")}>
        <Textarea
          rows={3}
          value={brief.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          dir="auto"
        />
      </Field>
    </Card>
  );
}

export function ContextStep({
  brief,
  onChange,
}: {
  brief: StudioBrief;
  onChange: (b: StudioBrief) => void;
}) {
  const { t } = useI18n();
  const ctx = brief.context;
  const set = (patch: Partial<StudioBrief["context"]>) =>
    onChange({ ...brief, context: { ...ctx, ...patch } });
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("studio.ctx.communication")}>
            <Select
              value={ctx.communication_type}
              onChange={(e) => set({ communication_type: e.target.value })}
            >
              {COMMUNICATION_TYPES.filter((c) => c !== "internal").map((c) => (
                <option key={c} value={c}>
                  {t(`promo.commType.${c}` as TKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("studio.ctx.publisher")}>
            <Select value={ctx.publisher} onChange={(e) => set({ publisher: e.target.value })}>
              {DISTRIBUTIONS.map((d) => (
                <option key={d} value={d}>
                  {t(`promo.distributionOpt.${d}` as TKey)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("studio.ctx.channels")}>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.slice(0, 6).map((c) => {
              const on = ctx.channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      channels: on ? ctx.channels.filter((x) => x !== c) : [...ctx.channels, c],
                    })
                  }
                  className={cn(
                    "min-h-10 rounded-full border px-3 text-sm",
                    on ? "border-ink bg-ink text-paper" : "border-border hover:bg-sunken",
                  )}
                >
                  {t(`promo.channel.${c}` as TKey)}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="rounded-md bg-sunken px-3 py-1">
          <Switch
            checked={ctx.is_paid}
            onCheckedChange={(v) => set({ is_paid: v })}
            label={t("studio.ctx.paid")}
          />
        </div>
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Badge variant="outline">{t("studio.ctx.aiUsed")}</Badge>
          {t("studio.ctx.aiUsedNote")}
        </p>
      </Card>
      <Card className="flex flex-col gap-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-5 text-green" />
          {t("studio.ctx.rulesTitle")}
        </CardTitle>
        <ul className="flex flex-col gap-2 text-sm">
          {disclosuresFor(brief).map((d) => (
            <li key={d} className="flex items-center gap-2">
              <Badge>{t("studio.ctx.disclosure")}</Badge>
              <span dir="auto">{d}</span>
            </li>
          ))}
          <li className="text-fg-muted">
            {t("studio.ctx.verifiedOnly", { n: brief.product.verified_claims.length })}
          </li>
          <li className="text-fg-muted">{t("studio.ctx.noFabrication")}</li>
          <li className="text-fg-muted">{t("studio.ctx.finalAnalysis")}</li>
        </ul>
      </Card>
    </div>
  );
}
