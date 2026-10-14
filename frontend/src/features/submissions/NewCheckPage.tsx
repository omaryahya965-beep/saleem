import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileImage, FileText, FileVideo, Lock, RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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
import type { InspectedMedia } from "@/lib/media";

type Stage = "hashing" | "extracting" | "uploading" | "saving";
type Errors = Partial<Record<"file" | "text" | "consent", string>>;

const SIDE_ITEMS: TKey[] = [
  "newCheck.sideSpeech",
  "newCheck.sideVisuals",
  "newCheck.sideCaption",
  "newCheck.sideDisclosure",
  "newCheck.sideClaims",
];

export function NewCheckPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const {
    parent: parentId,
    org: orgParam,
    campaign: campaignParam,
  } = useSearch({ from: "/_app/new" });
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs });
  const [orgId, setOrgId] = useState<string>(orgParam ?? "");
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
  const [errors, setErrors] = useState<Errors>({});
  const [stage, setStage] = useState<Stage | null>(null);
  const [stageDetail, setStageDetail] = useState<{ done: number; total: number } | null>(null);

  // Prefill from the profile, and from the previous version when re-checking.
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

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new ApiError("signed out", "unauthorized");
      const poster =
        media?.kind === "video" && media.previewUrl
          ? await fetch(media.previewUrl).then((r) => r.blob())
          : null;
      return createSubmission(
        {
          userId: user.id,
          kind,
          file: kind === "text" ? null : (media?.file ?? null),
          poster,
          durationSeconds: media?.duration ? Math.round(media.duration * 10) / 10 : null,
          textContent: text,
          caption,
          title:
            title.trim() ||
            caption.trim().slice(0, 60) ||
            text.trim().slice(0, 60) ||
            media?.file.name ||
            "",
          platform,
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
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["submissions"] });
      void navigate({ to: "/checks/$id", params: { id } });
    },
    onError: (err) => {
      setStage(null);
      toast.error(
        err instanceof ApiError && err.code === "upload"
          ? t("newCheck.errUpload")
          : ["quota_exceeded", "clip_too_long", "forbidden", "campaign_mismatch"].includes(
                errorCode(err),
              )
            ? t(`quota.${errorCode(err)}` as TKey)
            : t("newCheck.errGeneric"),
      );
    },
  });

  const onSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const next: Errors = {};
    if (kind !== "text" && !media) next.file = t("newCheck.errFile");
    if (kind === "text" && !text.trim()) next.text = t("newCheck.errText");
    if (!consent) next.consent = t("newCheck.errConsent");
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error(t("newCheck.fixErrors"));
      document.querySelector<HTMLElement>("[aria-invalid=true], [data-error=true] input")?.focus();
      return;
    }
    submit.mutate();
  };

  const busy = submit.isPending;
  const stageLabel = stage
    ? `${t(`newCheck.stage${stage[0]!.toUpperCase()}${stage.slice(1)}` as TKey)}${stage === "extracting" && stageDetail ? ` ${Math.round((stageDetail.done / stageDetail.total) * 100)}٪` : ""}`
    : t("newCheck.submit");
  const submitButton = (
    <Button type="submit" form="new-check" size="lg" block loading={busy}>
      {busy ? stageLabel : t("newCheck.submit")}
    </Button>
  );

  return (
    <Page>
      <PageHeader
        title={parentId ? t("newCheck.recheckTitle") : t("newCheck.title")}
        description={t("newCheck.subtitle")}
        className="mb-6 sm:mb-8"
      />
      {parent.data && (
        <p className="mb-6 flex items-start gap-3 rounded-md border border-green/20 bg-green-bg px-4 py-3 text-fg">
          <RefreshCw aria-hidden="true" className="mt-1 size-4 shrink-0 text-green" />
          {t("newCheck.recheckBanner", { title: parent.data.title ?? "" })}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <form id="new-check" noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5">
            <CardTitle>{t("newCheck.sectionContent")}</CardTitle>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium" id="kind-label">
                {t("newCheck.contentType")}
              </span>
              <SegmentedControl
                label={t("newCheck.contentType")}
                value={kind}
                onValueChange={(k) => {
                  setKind(k);
                  setMedia(null);
                  setErrors({});
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
                ]}
              />
            </div>

            {kind === "text" ? (
              <Field label={t("newCheck.textLabel")} error={errors.text}>
                <Textarea
                  rows={6}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t("newCheck.textPlaceholder")}
                  dir="auto"
                />
              </Field>
            ) : (
              <div data-error={Boolean(errors.file)}>
                <Dropzone
                  kind={kind}
                  value={media}
                  onChange={(m) => {
                    setMedia(m);
                    if (m) setErrors((e) => ({ ...e, file: undefined }));
                  }}
                />
                {errors.file && (
                  <p role="alert" className="mt-2 text-sm font-medium text-red">
                    {errors.file}
                  </p>
                )}
              </div>
            )}

            <Field label={t("newCheck.captionLabel")} hint={t("newCheck.captionHint")}>
              <Textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t("newCheck.captionPlaceholder")}
                dir="auto"
              />
            </Field>
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
          </Card>

          <Card className="flex flex-col gap-5">
            <CardTitle>{t("newCheck.sectionPublish")}</CardTitle>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("newCheck.platform")}>
                <Select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {t(`platforms.${p}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("newCheck.category")}>
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
            </div>
            <div className="divide-y divide-border rounded-md border border-border px-4">
              <Switch
                checked={isPaidAd}
                onCheckedChange={setIsPaidAd}
                label={t("newCheck.paidAd")}
                hint={t("newCheck.paidAdHint")}
              />
              <Switch
                checked={hasContract}
                onCheckedChange={setHasContract}
                label={t("newCheck.contract")}
                hint={t("newCheck.contractHint")}
                disabled={!isPaidAd}
              />
              <Switch
                checked={aiUsed}
                onCheckedChange={setAiUsed}
                label={t("newCheck.aiUsed")}
                hint={t("newCheck.aiUsedHint")}
              />
            </div>
            {(orgs.data?.length ?? 0) > 0 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t("newCheck.workspace")}>
                  <Select
                    value={orgId}
                    onChange={(e) => {
                      setOrgId(e.target.value);
                      setCampaignId("");
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
            <Field
              label={t("newCheck.license")}
              hint={t("newCheck.licenseHint")}
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
          </Card>

          <div className="flex flex-col gap-4">
            <Checkbox
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) setErrors((x) => ({ ...x, consent: undefined }));
              }}
              aria-invalid={errors.consent ? true : undefined}
              label={t("newCheck.consent")}
              hint={
                errors.consent ? (
                  <span className="font-medium text-red">{errors.consent}</span>
                ) : undefined
              }
            />
            <div className="hidden md:block md:max-w-xs">{submitButton}</div>
          </div>
        </form>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card className="border-transparent bg-ink text-paper">
            <h2 className="text-lg font-bold text-paper">{t("newCheck.sideTitle")}</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {SIDE_ITEMS.map((k) => (
                <li key={k} className="flex items-start gap-2.5 text-sm text-paper/90">
                  <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mint" />
                  {t(k)}
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
        </aside>
      </div>

      <MobileActionBar>{submitButton}</MobileActionBar>
    </Page>
  );
}
