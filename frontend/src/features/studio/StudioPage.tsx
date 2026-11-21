// SALEEM AI Studio — استوديو سَليم الذكي (D207). A guided creation workspace that ends in the normal workflow:
// brief → creative direction → regulatory context → script (template or Gemini, edited by the marketer, pre-reviewed)
// → voice (local Arabic/English TTS, recording or upload) → visuals and deterministic rendering → preview → accept.
// Accepting creates a promotion and a video version through the same paths as the upload wizard; analysis and human
// review follow as usual and a generated ad is never approved automatically.
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Page, PageHeader, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { getPromotion, useProducts } from "@/lib/api/promotions";
import {
  DEFAULT_BRIEF,
  createDraft,
  getDraft,
  saveDraft,
  type StudioBrief,
  type StudioDraft,
  type StudioScript,
} from "@/lib/api/studio";
import { BriefStep, ContextStep, DirectionStep } from "./BriefSteps";
import { ScriptStep } from "./ScriptStep";
import { AcceptStep, RenderStep, VoiceStep, type StudioMedia } from "./MediaSteps";

const STUDIO_STEPS = [
  "brief",
  "direction",
  "context",
  "script",
  "voice",
  "render",
  "accept",
] as const;
type StudioStep = (typeof STUDIO_STEPS)[number];

export function StudioPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { draft?: string; from?: string };
  const picker = useOrgPicker();
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [step, setStep] = useState<StudioStep>("brief");
  const [media, setMedia] = useState<StudioMedia>({
    photos: [],
    logo: null,
    voices: {},
    fullVoice: null,
    rendered: null,
    sceneImages: {},
  });
  const products = useProducts(picker.orgId || null);
  const canCreate = picker.orgId ? ["owner", "admin", "creator"].includes(picker.role ?? "") : true;

  // Resume a draft (?draft=) or start a replacement for an existing advertisement (?from=).
  const existing = useQuery({
    queryKey: ["studio-draft", search.draft],
    queryFn: () => getDraft(search.draft!),
    enabled: Boolean(search.draft),
  });
  const source = useQuery({
    queryKey: ["studio-source", search.from],
    queryFn: () => getPromotion(search.from!),
    enabled: Boolean(search.from) && !search.draft,
  });
  useEffect(() => {
    if (existing.data && !draft) {
      setDraft(existing.data);
      setStep(existing.data.script ? "script" : "brief");
    }
  }, [existing.data, draft]);

  const brief = draft?.brief ?? replacementBrief(source.data) ?? DEFAULT_BRIEF;
  const [local, setLocal] = useState<StudioBrief>(brief);
  // A resumed draft replaces the form; a replacement source only FILLS EMPTY fields, so typing before the original
  // advertisement has loaded is never lost (and the prefill is never lost to that race either).
  useEffect(() => {
    if (draft) setLocal(draft.brief);
  }, [draft?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const rb = replacementBrief(source.data);
    if (rb && !draft) setLocal((l) => fillEmpty(l, rb));
  }, [source.data?.promotion.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ensure = useMutation({
    mutationFn: async (b: StudioBrief) => {
      if (draft) {
        await saveDraft(draft.id, { brief: b });
        return { ...draft, brief: b };
      }
      return createDraft({
        orgId: picker.orgId || null,
        brief: b,
        mode: search.from ? "replacement" : "create",
        sourcePromotionId: search.from ?? null,
      });
    },
    onSuccess: (d) => {
      setDraft(d);
      if (!search.draft) void navigate({ to: "/studio", search: { draft: d.id }, replace: true });
    },
    onError: () => toast.error(t("studio.err.save")),
  });

  const go = async (s: StudioStep) => {
    if (STUDIO_STEPS.indexOf(s) > 2 || draft) await ensure.mutateAsync(local).catch(() => null);
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const updateScript = (script: StudioScript, provider?: StudioDraft["script_provider"]) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            script,
            script_provider: provider ?? d.script_provider,
            status: "script_ready",
            review: null,
          }
        : d,
    );

  const idx = STUDIO_STEPS.indexOf(step);
  const ready: Record<StudioStep, boolean> = useMemo(
    () => ({
      brief: Boolean(local.product.name.trim()),
      direction: true,
      context: true,
      script: Boolean(draft?.script?.scenes.length),
      voice: true,
      render: Boolean(media.rendered),
      accept: true,
    }),
    [local.product.name, draft?.script, media.rendered],
  );

  if (!user) return null;
  return (
    <Page>
      <div className="flex flex-col gap-6" data-testid="studio">
        <PageHeader
          title={t("studio.title")}
          description={search.from ? t("studio.replacementIntro") : t("studio.subtitle")}
          actions={
            <Badge variant="outline">
              <Sparkles aria-hidden="true" className="me-1 inline size-3.5" />
              {t("studio.badge")}
            </Badge>
          }
        />
        {!search.draft && !search.from && <OrgSelect picker={picker} />}
        {!canCreate ? (
          <Card className="text-fg-muted">{t("studio.notAllowed")}</Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <nav aria-label={t("studio.stepsLabel")} className="lg:sticky lg:top-24 lg:self-start">
              <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col [scrollbar-width:none]">
                {STUDIO_STEPS.map((s, n) => {
                  const reachable = n <= idx || STUDIO_STEPS.slice(0, n).every((x) => ready[x]);
                  return (
                    <li key={s} className="shrink-0">
                      <button
                        type="button"
                        disabled={!reachable}
                        aria-current={s === step ? "step" : undefined}
                        onClick={() => void go(s)}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-start text-sm",
                          s === step
                            ? "bg-ink font-medium text-paper"
                            : "text-fg hover:bg-sunken disabled:text-fg-muted disabled:hover:bg-transparent",
                        )}
                      >
                        <span
                          className={cn(
                            "tabular grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                            s === step ? "bg-mint text-ink" : "bg-sunken",
                          )}
                        >
                          {n + 1}
                        </span>
                        {t(`studio.step.${s}` as TKey)}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <section aria-labelledby="studio-step-title" className="flex min-w-0 flex-col gap-5">
              <h2 id="studio-step-title" className="text-2xl font-bold">
                {t(`studio.step.${step}` as TKey)}
              </h2>
              {step === "brief" && (
                <BriefStep
                  brief={local}
                  onChange={setLocal}
                  products={products.data ?? []}
                  media={media}
                  onMedia={setMedia}
                />
              )}
              {step === "direction" && <DirectionStep brief={local} onChange={setLocal} />}
              {step === "context" && <ContextStep brief={local} onChange={setLocal} />}
              {step === "script" && draft && (
                <ScriptStep
                  draft={{ ...draft, brief: local }}
                  onScript={updateScript}
                  onReview={(review) =>
                    setDraft((d) => (d ? { ...d, review, status: "reviewed" } : d))
                  }
                />
              )}
              {step === "voice" && draft?.script && (
                <VoiceStep
                  brief={local}
                  script={draft.script}
                  media={media}
                  onMedia={setMedia}
                  draftId={draft.id}
                />
              )}
              {step === "render" && draft?.script && (
                <RenderStep
                  brief={local}
                  script={draft.script}
                  media={media}
                  onMedia={setMedia}
                  draftId={draft.id}
                />
              )}
              {step === "accept" && draft?.script && media.rendered && (
                <AcceptStep draft={{ ...draft, brief: local }} media={media} orgId={draft.org_id} />
              )}
              {step === "accept" && !media.rendered && (
                <Card className="text-fg-muted">{t("studio.renderFirst")}</Card>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                {idx > 0 ? (
                  <Button variant="secondary" onClick={() => void go(STUDIO_STEPS[idx - 1]!)}>
                    {t("studio.prev")}
                  </Button>
                ) : (
                  <Button asChild variant="ghost">
                    <Link to="/new">{t("studio.backToNew")}</Link>
                  </Button>
                )}
                {idx < STUDIO_STEPS.length - 1 && (
                  <Button
                    icon={idx === 2 ? <Wand2 /> : undefined}
                    disabled={!ready[step]}
                    loading={ensure.isPending}
                    onClick={() => void go(STUDIO_STEPS[idx + 1]!)}
                    data-testid="studio-next"
                  >
                    {t(`studio.next.${STUDIO_STEPS[idx + 1]!}` as TKey)}
                  </Button>
                )}
              </div>
            </section>
          </div>
        )}
        <StudioUnloadGuard active={Boolean(media.rendered) && draft?.status !== "accepted"} />
      </div>
    </Page>
  );
}

/** Fills the empty fields of the brief from the replacement source (never overwrites what the user typed). */
function fillEmpty(l: StudioBrief, src: StudioBrief): StudioBrief {
  return {
    ...l,
    instructions: l.instructions || src.instructions,
    product: {
      ...l.product,
      name: l.product.name || src.product.name,
      sector: l.product.sector ?? src.product.sector,
    },
    campaign: { ...l.campaign, name: l.campaign.name || src.campaign.name },
    context: l === DEFAULT_BRIEF || l.context === DEFAULT_BRIEF.context ? src.context : l.context,
  };
}

/** Pre-fills a replacement brief from the original advertisement (product, channels, context, caption). */
function replacementBrief(
  src: Awaited<ReturnType<typeof getPromotion>> | undefined,
): StudioBrief | null {
  if (!src) return null;
  const p = src.promotion;
  const channels = (p.channels ?? []) as string[];
  return {
    ...DEFAULT_BRIEF,
    product: {
      ...DEFAULT_BRIEF.product,
      name: src.product?.name_ar ?? p.title ?? "",
      sector: src.product?.sector ?? p.sector ?? null,
      description: "",
    },
    campaign: {
      ...DEFAULT_BRIEF.campaign,
      name: src.campaign?.name ?? "",
      platform: channels[0] ?? "instagram",
    },
    instructions: `بديل لإعلان «${p.title ?? ""}». تجنّب ما رُصد في الإصدار السابق ولا تكرر ادعاءاته غير الموثقة.`,
    context: {
      ...DEFAULT_BRIEF.context,
      communication_type: p.communication_type ?? "general_commercial",
      is_paid: p.is_paid ?? true,
      publisher: p.distribution ?? "owned",
      channels: channels.length ? channels : ["instagram"],
    },
  };
}

/** Rendered media live only in this tab until accepted: warn before leaving. */
function StudioUnloadGuard({ active }: { active: boolean }) {
  const ref = useRef(active);
  ref.current = active;
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => {
      if (ref.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, []);
  return null;
}
