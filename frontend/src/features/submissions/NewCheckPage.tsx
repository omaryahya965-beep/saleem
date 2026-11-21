// New advertisement — guided four-step flow (V2 upgrade §7, D179): 1 content · 2 advertisement information ·
// 3 organisational and publication context · 4 review and start. One representation per fact (paid status,
// channels → platform), product-driven defaults (a cosmetic product never defaults to a financial promotion),
// conflicts explained before any AI request, and field-only draft recovery (no duplicate advertisements).
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileImage,
  FileText,
  FileVideo,
  Info,
  Lock,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobileActionBar } from "@/components/layout/SiteShell";
import {
  Button,
  Card,
  CardTitle,
  Checkbox,
  Dropzone,
  Field,
  Input,
  Page,
  PageHeader,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import {
  ApiError,
  CATEGORIES,
  PLATFORMS,
  createSubmission,
  fetchSubmission,
  type Platform,
  type ProductCategory,
  type SubmissionKind,
} from "@/lib/api/data";
import { useProfile } from "@/lib/api/hooks";
import { errorCode, fetchMyOrgs, fetchOrg } from "@/lib/api/features";
import {
  createPromotion,
  dbErrorCode,
  deleteEmptyPromotion,
  useOrgSettings,
  usePromotion,
  useProducts,
} from "@/lib/api/promotions";
import { ContextFields } from "@/features/promotions/ContextFields";
import { emptyContext, type ContextValue } from "@/features/promotions/model";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import type { InspectedMedia } from "@/lib/media";
import { cn } from "@/lib/utils";
import {
  STEPS,
  categoryFor,
  clearDraft,
  conflicts as findConflicts,
  defaultCommunication,
  loadDraft,
  platformFromChannels,
  saveDraft,
  showsCreatorFields,
  type Draft,
} from "./wizard";

type Stage = "hashing" | "extracting" | "uploading" | "saving";

export function NewCheckPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const {
    parent: parentId,
    org: orgParam,
    campaign: campaignParam,
    promotion: promotionParam,
  } = useSearch({ from: "/_app/new" });
  const target = usePromotion(promotionParam ?? "", Boolean(promotionParam));
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs });
  const [orgId, setOrgId] = useState<string>(orgParam ?? "");
  const active = useOrgPicker();
  const [orgPicked, setOrgPicked] = useState(Boolean(orgParam));
  useEffect(() => {
    if (orgPicked || promotionParam || !active.orgId) return;
    if (orgs.data?.some((o) => o.id === active.orgId)) setOrgId(active.orgId);
  }, [orgPicked, promotionParam, active.orgId, orgs.data]);
  const [campaignId, setCampaignId] = useState<string>(campaignParam ?? "");
  const orgDetail = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => fetchOrg(orgId),
    enabled: Boolean(orgId),
  });
  const profile = useProfile(user?.id);
  const parent = useQuery({
    queryKey: ["submission", parentId],
    queryFn: () => fetchSubmission(parentId!),
    enabled: Boolean(parentId),
  });

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<SubmissionKind>("video");
  const [media, setMedia] = useState<InspectedMedia | null>(null);
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("snapchat");
  const [category, setCategory] = useState<ProductCategory>("other");
  const [isPaidAd, setIsPaidAd] = useState(true);
  const [hasContract, setHasContract] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [license, setLicense] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<ContextValue | null>(null);
  const [commTouched, setCommTouched] = useState(false);
  const [restored, setRestored] = useState<Draft | null>(null);
  const settings = useOrgSettings(orgId || null);
  const products = useProducts(orgId || null);
  const myRole = orgs.data
    ?.find((o) => o.id === orgId)
    ?.org_members.find((m) => m.user_id === user?.id)?.role;
  const withContext =
    Boolean(orgId) && !promotionParam && myRole !== undefined && myRole !== "reviewer";
  const orgSector = settings.data?.sector ?? null;
  const product = useMemo(
    () => (products.data ?? []).find((p) => p.id === context?.productId) ?? null,
    [products.data, context?.productId],
  );
  const addingVersion = Boolean(promotionParam);

  useEffect(() => {
    if (!withContext) {
      setContext(null);
      return;
    }
    // D179: the communication type follows the product, never the organisation sector alone.
    setContext((c) => c ?? emptyContext(defaultCommunication(null, orgSector)));
  }, [withContext, orgSector]);
  // Product chosen → sensible defaults (unless the user already chose a communication type).
  useEffect(() => {
    if (!product) return;
    const cat = categoryFor(product);
    if (cat) setCategory(cat);
    if (!commTouched)
      setContext((c) =>
        c ? { ...c, communicationType: defaultCommunication(product, orgSector) } : c,
      );
  }, [product, commTouched, orgSector]);
  // One paid flag: the context mirrors the version's declaration.
  useEffect(() => {
    setContext((c) => (c && c.isPaid !== isPaidAd ? { ...c, isPaid: isPaidAd } : c));
  }, [isPaidAd]);
  // One licence field: the context's creator licence mirrors the declaration field.
  useEffect(() => {
    setContext((c) =>
      c && c.creatorLicenseNo !== (license || null)
        ? { ...c, creatorLicenseNo: license || null }
        : c,
    );
  }, [license]);
  useEffect(() => {
    const p = target.data?.promotion;
    if (!p) return;
    setOrgId(p.org_id ?? "");
    setCampaignId(p.campaign_id ?? "");
    setTitle((v) => v || p.title);
    setCaption((v) => v || p.caption || "");
  }, [target.data]);
  const [stage, setStage] = useState<Stage | null>(null);
  const [stageDetail, setStageDetail] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    if (p.mawthooq_license_no) setLicense((v) => v || p.mawthooq_license_no || "");
    if (p.platforms[0] && !parentId) setPlatform(p.platforms[0]);
  }, [profile.data, parentId]);
  useEffect(() => {
    const p = parent.data;
    if (!p) return;
    setKind(p.kind);
    setCaption(p.caption);
    setTitle(p.title ? `${p.title} (2)` : "");
    setPlatform(p.platform);
    setCategory(p.product_category);
    setIsPaidAd(p.is_paid_ad);
    setHasContract(p.has_written_contract);
    setAiUsed(p.ai_used);
    if (p.mawthooq_license_no) setLicense(p.mawthooq_license_no);
    if (p.kind === "text") setText(p.text_content ?? "");
  }, [parent.data]);

  // Draft recovery: only for a brand-new advertisement (never when adding a version or re-checking).
  const draftable = Boolean(user) && !promotionParam && !parentId;
  useEffect(() => {
    if (!draftable || !user) return;
    const d = loadDraft(user.id);
    if (d && (d.text || d.caption || d.title)) setRestored(d);
  }, [draftable, user]);
  useEffect(() => {
    if (!draftable || !user || restored) return;
    if (!(text || caption || title)) return;
    const h = setTimeout(
      () =>
        saveDraft(user.id, {
          step,
          kind,
          text,
          caption,
          title,
          platform,
          category,
          isPaidAd,
          hasContract,
          aiUsed,
          license,
          orgId,
          campaignId,
          context,
        }),
      600,
    );
    return () => clearTimeout(h);
  }, [
    draftable,
    user,
    restored,
    step,
    kind,
    text,
    caption,
    title,
    platform,
    category,
    isPaidAd,
    hasContract,
    aiUsed,
    license,
    orgId,
    campaignId,
    context,
  ]);
  const applyDraft = (d: Draft) => {
    setKind(d.kind as SubmissionKind);
    setText(d.text);
    setCaption(d.caption);
    setTitle(d.title);
    setPlatform(d.platform as Platform);
    setCategory(d.category as ProductCategory);
    setIsPaidAd(d.isPaidAd);
    setHasContract(d.hasContract);
    setAiUsed(d.aiUsed);
    setLicense(d.license);
    if (d.orgId) {
      setOrgPicked(true);
      setOrgId(d.orgId);
    }
    setCampaignId(d.campaignId);
    if (d.context) setContext(d.context as ContextValue);
    setRestored(null);
  };

  const effectivePlatform = context
    ? platformFromChannels(context.channels, PLATFORMS, platform)
    : platform;
  const issues = findConflicts({
    hasOrg: withContext,
    product,
    communicationType: context?.communicationType ?? null,
    category,
    channels: context?.channels ?? [],
    distribution: context?.distribution ?? null,
    isPaid: isPaidAd,
    hasContract,
    aiUsed,
    license,
  });
  const creatorFields = showsCreatorFields({
    hasOrg: withContext,
    distribution: context?.distribution ?? null,
    communicationType: context?.communicationType ?? null,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new ApiError("signed out", "unauthorized");
      // D207: the stored poster Blob, never the preview URL (revoked once the dropzone unmounts after step 1,
      // which made every video upload through the wizard fail before it started). A missing poster is optional.
      const poster =
        media?.kind === "video"
          ? (media.poster ??
            (media.previewUrl
              ? await fetch(media.previewUrl)
                  .then((r) => r.blob())
                  .catch(() => null)
              : null))
          : null;
      const versionTitle =
        title.trim() ||
        caption.trim().slice(0, 60) ||
        text.trim().slice(0, 60) ||
        media?.file.name ||
        "";
      let promotionId = promotionParam ?? null;
      let created = false;
      if (!promotionId && withContext && context) {
        promotionId = await createPromotion(user.id, {
          ...context,
          isPaid: isPaidAd,
          creatorLicenseNo: license || null,
          sector: product?.sector ?? null,
          title: versionTitle,
          orgId: orgId || null,
          campaignId: campaignId || null,
          caption,
        });
        created = true;
      }
      const upload = createSubmission(
        {
          promotionId,
          userId: user.id,
          kind,
          file: kind === "text" ? null : (media?.file ?? null),
          poster,
          durationSeconds: media?.duration ? Math.round(media.duration * 10) / 10 : null,
          textContent: text,
          caption,
          title: versionTitle,
          platform: effectivePlatform,
          productCategory: category,
          isPaidAd,
          hasWrittenContract: hasContract,
          aiUsed,
          licenseNo: license,
          parentId: parentId ?? null,
          orgId: orgId || null,
          campaignId: (orgId && campaignId) || null,
        },
        (st, detail) => {
          setStage(st);
          setStageDetail(detail ?? null);
        },
      );
      if (!created || !promotionId) return upload;
      const pid = promotionId;
      return upload.catch(async (e: unknown) => {
        await deleteEmptyPromotion(pid);
        throw e;
      });
    },
    onSuccess: (id) => {
      if (user) clearDraft(user.id);
      void qc.invalidateQueries({ queryKey: ["submissions"] });
      void qc.invalidateQueries({ queryKey: ["promotions"] });
      void navigate({ to: "/checks/$id", params: { id } });
    },
    onError: (err) => {
      setStage(null);
      toast.error(
        err instanceof ApiError && err.code === "upload"
          ? t("newCheck.errUpload")
          : dbErrorCode(err)
            ? t(`promo.errors.${dbErrorCode(err)}` as TKey)
            : ["quota_exceeded", "clip_too_long", "forbidden", "campaign_mismatch"].includes(
                  errorCode(err),
                )
              ? t(`quota.${errorCode(err)}` as TKey)
              : t("newCheck.errGeneric"),
      );
    },
  });

  /** Validates the current step; the uploaded file is kept whatever fails elsewhere. */
  const validate = (s: number): string | null => {
    if (s === 0) {
      if (kind !== "text" && !media) return t("newCheck.errFile");
      if (kind === "text" && !text.trim()) return t("newCheck.errText");
    }
    if (s === 2 && withContext && issues.some((i) => i.level === "blocking"))
      return t("wiz.conflict.no_channels");
    if (s === 3 && !consent) return t("newCheck.errConsent");
    return null;
  };
  const go = (to: number) => {
    if (to > step) {
      for (let s = step; s < to; s++) {
        const e = validate(s);
        if (e) {
          setStep(s);
          setError(e);
          return;
        }
      }
    }
    setError(null);
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const start = () => {
    for (let s = 0; s < STEPS.length; s++) {
      const e = validate(s);
      if (e) {
        setStep(s);
        setError(e);
        toast.error(e);
        return;
      }
    }
    submit.mutate();
  };

  const busy = submit.isPending;
  const stageLabel = stage
    ? `${t(`newCheck.stage${stage[0]!.toUpperCase()}${stage.slice(1)}` as TKey)}${stage === "extracting" && stageDetail ? ` ${Math.round((stageDetail.done / stageDetail.total) * 100)}٪` : ""}`
    : t("wiz.start");
  const last = step === STEPS.length - 1;
  const primary = last ? (
    <Button size="lg" block loading={busy} onClick={start} data-testid="start-analysis">
      {busy ? stageLabel : t("wiz.start")}
    </Button>
  ) : (
    <Button
      size="lg"
      block
      icon={<ArrowLeft className="ltr:rotate-180" />}
      onClick={() => go(step + 1)}
    >
      {t("wiz.next")}
    </Button>
  );
  const productName = product ? (lang === "en" && product.name_en) || product.name_ar : null;
  const org = orgs.data?.find((o) => o.id === orgId);
  const campaign = orgDetail.data?.campaigns?.find((c) => c.id === campaignId);

  return (
    <Page>
      <PageHeader
        title={
          parentId
            ? t("newCheck.recheckTitle")
            : addingVersion
              ? t("wiz.titleVersion")
              : t("wiz.title")
        }
        description={t("wiz.subtitle")}
        className="mb-5"
      />
      {target.data && (
        <p
          data-testid="new-version-banner"
          className="mb-5 flex items-start gap-3 rounded-md border border-green/20 bg-green-bg px-4 py-3 text-fg"
        >
          <RefreshCw aria-hidden="true" className="mt-1 size-4 shrink-0 text-green" />
          {t("promo.newVersionBanner", {
            title: target.data.promotion.title,
            n: (target.data.versions.at(-1)?.version_no ?? 0) + 1,
          })}
        </p>
      )}
      {parent.data && (
        <p className="mb-5 flex items-start gap-3 rounded-md border border-green/20 bg-green-bg px-4 py-3 text-fg">
          <RefreshCw aria-hidden="true" className="mt-1 size-4 shrink-0 text-green" />
          {t("newCheck.recheckBanner", { title: parent.data.title ?? "" })}
        </p>
      )}
      {restored && (
        <div
          role="status"
          className="mb-5 flex flex-col gap-2 rounded-md border border-border bg-sunken px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{t("wiz.draftFound")}</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => applyDraft(restored)}>
              {t("wiz.draftRestore")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (user) clearDraft(user.id);
                setRestored(null);
              }}
            >
              {t("wiz.draftDiscard")}
            </Button>
          </div>
        </div>
      )}

      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label={t("wiz.stepsLabel")}>
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex w-full flex-col items-start gap-1 rounded-md border-t-4 px-1 pt-2 text-start text-sm transition-colors",
                i === step
                  ? "border-ink font-bold text-fg"
                  : i < step
                    ? "border-green text-fg"
                    : "border-border text-fg-muted",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs">
                {i < step ? (
                  <Check aria-hidden="true" className="size-3.5 text-green" />
                ) : (
                  <span className="tabular">{i + 1}</span>
                )}
                <span className="sr-only">
                  {t("wiz.stepOf", { n: i + 1, total: STEPS.length })}
                </span>
              </span>
              <span className="hidden sm:block">{t(`wiz.step.${s}` as TKey)}</span>
            </button>
          </li>
        ))}
      </ol>
      <h2 className="mb-4 text-xl font-bold sm:hidden">{t(`wiz.step.${STEPS[step]}` as TKey)}</h2>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red/30 bg-red-bg px-4 py-2 text-sm font-medium text-red"
        >
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex flex-col gap-6">
          {step === 0 && (
            <Card className="flex flex-col gap-5">
              <CardTitle>{t("wiz.step.content")}</CardTitle>
              <SegmentedControl
                label={t("newCheck.contentType")}
                value={kind}
                onValueChange={(k) => {
                  setKind(k);
                  setMedia(null);
                  setError(null);
                }}
                options={[
                  {
                    value: "video",
                    label: t("kinds.video"),
                    icon: <FileVideo aria-hidden="true" />,
                  },
                  {
                    value: "image",
                    label: t("kinds.image"),
                    icon: <FileImage aria-hidden="true" />,
                  },
                  { value: "text", label: t("kinds.text"), icon: <FileText aria-hidden="true" /> },
                  { value: "pdf", label: t("kinds.pdf"), icon: <FileText aria-hidden="true" /> },
                ]}
              />
              {kind === "text" ? (
                <Field label={t("newCheck.textLabel")}>
                  <Textarea
                    rows={8}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t("newCheck.textPlaceholder")}
                    dir="auto"
                  />
                </Field>
              ) : (
                <Dropzone
                  kind={kind}
                  value={media}
                  onChange={(m) => {
                    setMedia(m);
                    if (m) setError(null);
                  }}
                />
              )}
              <p className="text-xs text-fg-muted">{t("wiz.formats")}</p>
            </Card>
          )}

          {step === 1 && (
            <Card className="flex flex-col gap-5">
              <CardTitle>{t("wiz.step.details")}</CardTitle>
              <Field
                label={t("newCheck.titleLabel")}
                hint={t("newCheck.titleHint")}
                optional
                optionalLabel={t("common.optional")}
              >
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("newCheck.titlePlaceholder")}
                  maxLength={120}
                  dir="auto"
                />
              </Field>
              <Field label={t("newCheck.captionLabel")} hint={t("newCheck.captionHint")}>
                <Textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={t("newCheck.captionPlaceholder")}
                  dir="auto"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label={t("newCheck.category")}
                  hint={product ? t("wiz.categoryFromProduct") : undefined}
                >
                  <Select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`categories.${c}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {!withContext && (
                  <Field label={t("newCheck.platform")}>
                    <Select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value as Platform)}
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {t(`platforms.${p}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
              <div className="divide-y divide-border rounded-md border border-border px-4">
                <Switch
                  checked={isPaidAd}
                  onCheckedChange={setIsPaidAd}
                  label={t("newCheck.paidAd")}
                  hint={t("newCheck.paidAdHint")}
                />
                <Switch
                  checked={aiUsed}
                  onCheckedChange={setAiUsed}
                  label={t("newCheck.aiUsed")}
                  hint={t("newCheck.aiUsedHint")}
                />
                {creatorFields && isPaidAd && (
                  <Switch
                    checked={hasContract}
                    onCheckedChange={setHasContract}
                    label={t("newCheck.contract")}
                    hint={t("newCheck.contractHint")}
                  />
                )}
              </div>
              {creatorFields && (
                <Field
                  label={t("newCheck.license")}
                  hint={t("wiz.licenseHint")}
                  optional
                  optionalLabel={t("common.optional")}
                >
                  <Input
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    placeholder="MW-0000-00000"
                    dir="ltr"
                    className="text-start rtl:text-end"
                  />
                </Field>
              )}
              {!creatorFields && (
                <p className="text-xs text-fg-muted">{t("wiz.creatorFieldsHidden")}</p>
              )}
            </Card>
          )}

          {step === 2 && (
            <Card className="flex flex-col gap-5" data-testid="promotion-context">
              <CardTitle>{t("wiz.step.context")}</CardTitle>
              {!promotionParam && (orgs.data?.length ?? 0) > 0 && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={t("newCheck.workspace")}>
                    <Select
                      value={orgId}
                      onChange={(e) => {
                        setOrgPicked(true);
                        setOrgId(e.target.value);
                        setCampaignId("");
                        setContext(null);
                      }}
                    >
                      <option value="">{t("newCheck.personal")}</option>
                      {orgs.data!.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {orgId && (
                    <Field label={t("newCheck.campaign")}>
                      <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                        <option value="">{t("newCheck.none")}</option>
                        {(orgDetail.data?.campaigns ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </div>
              )}
              {context ? (
                <ContextFields
                  value={context}
                  onChange={(v) => {
                    if (v.communicationType !== context.communicationType) setCommTouched(true);
                    setContext(v);
                  }}
                  products={products.data ?? []}
                  omit={["isPaid", "creatorLicenseNo"]}
                />
              ) : (
                <p className="text-sm text-fg-muted">
                  {addingVersion ? t("wiz.versionContextNote") : t("wiz.personalContextNote")}
                </p>
              )}
            </Card>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <Card className="flex flex-col gap-3" data-testid="review-summary">
                <CardTitle>{t("wiz.step.review")}</CardTitle>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <Row label={t("wiz.sum.content")}>
                    {kind === "text"
                      ? t("kinds.text")
                      : media
                        ? `${media.file.name} · ${(media.file.size / 1048576).toFixed(1)} MB${media.duration ? ` · ${Math.round(media.duration)} ث` : ""}`
                        : "—"}
                  </Row>
                  <Row label={t("newCheck.titleLabel")}>{title || caption.slice(0, 60) || "—"}</Row>
                  <Row label={t("newCheck.workspace")}>{org?.name ?? t("newCheck.personal")}</Row>
                  <Row label={t("newCheck.campaign")}>{campaign?.name ?? t("newCheck.none")}</Row>
                  <Row label={t("promo.product")}>{productName ?? t("promo.noProduct")}</Row>
                  <Row label={t("ws.info.sector")}>
                    {t(`ws.sector.${product?.sector ?? orgSector ?? "other"}` as TKey)}
                    {!product && withContext && ` (${t("wiz.sum.orgSector")})`}
                  </Row>
                  <Row label={t("promo.communicationType")}>
                    {context ? t(`promo.commType.${context.communicationType}` as TKey) : "—"}
                  </Row>
                  <Row label={t("promo.channels")}>
                    {context?.channels.length
                      ? context.channels.map((c) => t(`promo.channel.${c}` as TKey)).join("، ")
                      : t(`platforms.${effectivePlatform}`)}
                  </Row>
                  <Row label={t("newCheck.paidAd")}>
                    {isPaidAd ? t("common.yes") : t("common.no")}
                  </Row>
                  <Row label={t("newCheck.aiUsed")}>
                    {aiUsed ? t("common.yes") : t("common.no")}
                  </Row>
                </dl>
              </Card>
              {issues.length > 0 && (
                <Card className="flex flex-col gap-2" data-testid="wizard-conflicts">
                  <CardTitle>{t("wiz.checksTitle")}</CardTitle>
                  <ul className="flex flex-col gap-2">
                    {issues.map((c) => (
                      <li
                        key={c.key}
                        className={cn(
                          "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
                          c.level === "info" ? "bg-sunken" : "bg-amber-bg",
                        )}
                      >
                        {c.level === "info" ? (
                          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        ) : (
                          <AlertTriangle
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-amber-text"
                          />
                        )}
                        <span>
                          <span className="sr-only">{t(`wiz.level.${c.level}` as TKey)}: </span>
                          {t(`wiz.conflict.${c.key}` as TKey)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    onClick={() => go(2)}
                  >
                    {t("wiz.fixContext")}
                  </Button>
                </Card>
              )}
              <Card className="flex flex-col gap-3">
                <p className="text-sm">{t("wiz.whatHappens")}</p>
                <Checkbox
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  label={t("newCheck.consent")}
                />
              </Card>
            </div>
          )}

          <div className="hidden items-center justify-between gap-3 md:flex">
            <Button
              variant="secondary"
              disabled={step === 0 || busy}
              icon={<ArrowRight className="ltr:rotate-180" />}
              onClick={() => go(step - 1)}
            >
              {t("common.back")}
            </Button>
            <div className="w-72">{primary}</div>
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card className="border-transparent bg-ink text-paper">
            <h2 className="text-lg font-bold text-paper">{t("newCheck.sideTitle")}</h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm text-paper/90">
              {(
                [
                  "sideSpeech",
                  "sideVisuals",
                  "sideCaption",
                  "sideDisclosure",
                  "sideClaims",
                ] as const
              ).map((k) => (
                <li key={k} className="flex items-start gap-2.5">
                  <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mint" />
                  {t(`newCheck.${k}` as TKey)}
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-paper/15 pt-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-mint">
                <Lock aria-hidden="true" className="size-4" />
                {t("newCheck.privacyTitle")}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper/80">
                {t("newCheck.privacyBody")}
              </p>
            </div>
          </Card>
          {addingVersion && target.data && (
            <Link
              to="/promotions/$id"
              params={{ id: target.data.promotion.id }}
              className="text-sm text-green underline-offset-4 hover:underline"
            >
              {t("wiz.backToAd")}
            </Link>
          )}
        </aside>
      </div>

      <MobileActionBar>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" disabled={busy} onClick={() => go(step - 1)}>
              {t("common.back")}
            </Button>
          )}
          <div className="flex-1">{primary}</div>
        </div>
      </MobileActionBar>
    </Page>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col border-b border-border py-1.5">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="font-medium break-words" dir="auto">
        {children}
      </dd>
    </div>
  );
}
