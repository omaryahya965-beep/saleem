// Studio step 4 (D207): script generation (explicit provider choice), scene editing, per-scene regeneration and the
// pre-generation review (deterministic, no AI request).
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, RefreshCw, Save, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Field,
  Input,
  StatusChip,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  StudioApiError,
  callStudio,
  saveDraft,
  type ReviewItem,
  type StudioDraft,
  type StudioEstimate,
  type StudioScript,
} from "@/lib/api/studio";

type Provider = "template" | "gemini";

export function ScriptStep({
  draft,
  onScript,
  onReview,
}: {
  draft: StudioDraft;
  onScript: (s: StudioScript, provider?: StudioDraft["script_provider"]) => void;
  onReview: (r: NonNullable<StudioDraft["review"]>) => void;
}) {
  const { t, lang } = useI18n();
  const [provider, setProvider] = useState<Provider>("template");
  const [edit, setEdit] = useState<StudioScript | null>(draft.script);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setEdit(draft.script);
    setDirty(false);
  }, [draft.script]);
  const estimate = useQuery({
    queryKey: ["studio-estimate", draft.id],
    queryFn: () => callStudio<StudioEstimate>(draft.id, "estimate"),
  });
  const gemini = estimate.data?.providers.gemini;
  const errText = (e: unknown) => {
    const raw = e instanceof StudioApiError ? e.code : "unknown";
    const code = raw.startsWith("fabricated_") ? "fabricated" : raw;
    const key = `studio.err.${code}` as TKey;
    const s = t(key);
    return s === key ? t("studio.err.generic") : s;
  };
  const generate = useMutation({
    mutationFn: (v: { scene?: number }) =>
      callStudio<{ script: StudioScript; provider: Provider }>(
        draft.id,
        v.scene === undefined ? "script" : "scene",
        {
          provider,
          scene_index: v.scene,
        },
      ),
    onSuccess: (r) => onScript(r.script, r.provider),
    onError: (e) => toast.error(errText(e)),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!edit) return;
      await saveDraft(draft.id, {
        script: edit,
        script_provider: "manual",
        status: "script_ready",
      });
    },
    onSuccess: () => {
      if (edit) onScript(edit, "manual");
      setDirty(false);
      toast.success(t("studio.script.saved"));
    },
    onError: () => toast.error(t("studio.err.save")),
  });
  const review = useMutation({
    mutationFn: async () => {
      if (dirty && edit) {
        await saveDraft(draft.id, {
          script: edit,
          script_provider: "manual",
          status: "script_ready",
        });
        onScript(edit, "manual");
        setDirty(false);
      }
      return callStudio<{ review: NonNullable<StudioDraft["review"]> }>(draft.id, "review");
    },
    onSuccess: (r) => onReview(r.review),
    onError: (e) => toast.error(errText(e)),
  });
  const patchScene = (i: number, patch: Partial<StudioScript["scenes"][number]>) => {
    if (!edit) return;
    setEdit({ ...edit, scenes: edit.scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
    setDirty(true);
  };
  const items = draft.review?.items ?? [];
  const byScene = (i: number) => items.filter((x) => x.scene === i);

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <CardTitle>{t("studio.script.provider")}</CardTitle>
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-label={t("studio.script.provider")}
        >
          <ProviderCard
            on={provider === "template"}
            onSelect={() => setProvider("template")}
            icon={<FileText />}
            title={t("studio.script.template")}
            body={t("studio.script.templateBody")}
            tag={<Badge variant="outline">{t("studio.free")}</Badge>}
          />
          <ProviderCard
            on={provider === "gemini"}
            disabled={!gemini?.configured}
            onSelect={() => setProvider("gemini")}
            icon={<Sparkles />}
            title={t("studio.script.gemini")}
            body={
              gemini?.configured
                ? t("studio.script.geminiBody", {
                    model: gemini.model,
                    usd: estimate.data?.estimate.usd ?? "—",
                    used: estimate.data?.allowance?.used ?? 0,
                    limit: estimate.data?.allowance?.limit ?? 0,
                  })
                : t("studio.script.geminiOff")
            }
            tag={
              <Badge variant={gemini?.configured ? "neutral" : "outline"}>
                {gemini?.configured ? t("studio.providerOn") : t("studio.providerOff")}
              </Badge>
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Sparkles />}
            loading={generate.isPending && generate.variables?.scene === undefined}
            onClick={() => generate.mutate({})}
            data-testid="studio-generate"
          >
            {edit ? t("studio.script.rewrite") : t("studio.script.generate")}
          </Button>
          {provider === "gemini" && (
            <p className="self-center text-xs text-fg-muted">{t("studio.script.oneRequest")}</p>
          )}
        </div>
      </Card>

      {edit && (
        <>
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t("studio.script.concept")}</CardTitle>
              <Badge variant="outline">
                {t(`studio.script.by.${draft.script_provider ?? "template"}` as TKey)}
              </Badge>
            </div>
            <Textarea
              rows={2}
              value={edit.concept}
              onChange={(e) => (setEdit({ ...edit, concept: e.target.value }), setDirty(true))}
              dir="auto"
            />
          </Card>
          <ol className="flex flex-col gap-3" data-testid="studio-scenes">
            {edit.scenes.map((s, i) => (
              <li key={i}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-bold">
                      <span className="tabular grid size-7 place-items-center rounded-full bg-ink text-xs text-paper">
                        {i + 1}
                      </span>
                      {t("studio.script.scene", { n: i + 1 })}
                      <span className="tabular text-sm font-normal text-fg-muted">
                        {s.start.toFixed(1)}–{(s.start + s.duration).toFixed(1)}s
                      </span>
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<RefreshCw />}
                      loading={generate.isPending && generate.variables?.scene === i}
                      onClick={() => generate.mutate({ scene: i })}
                    >
                      {t("studio.script.regenerate")}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label={t("studio.script.narration")}>
                      <Textarea
                        rows={2}
                        value={s.narration}
                        onChange={(e) => patchScene(i, { narration: e.target.value })}
                        dir="auto"
                      />
                    </Field>
                    <Field label={t("studio.script.onScreen")}>
                      <Textarea
                        rows={2}
                        value={s.on_screen}
                        onChange={(e) => patchScene(i, { on_screen: e.target.value })}
                        dir="auto"
                      />
                    </Field>
                    <Field label={t("studio.script.visual")}>
                      <Input
                        value={s.visual}
                        onChange={(e) => patchScene(i, { visual: e.target.value })}
                        dir="auto"
                      />
                    </Field>
                    <Field label={t("studio.script.duration")}>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        step={0.5}
                        value={s.duration}
                        onChange={(e) => {
                          const d = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                          let acc = 0;
                          const scenes = edit.scenes.map((x, k) => {
                            const nx = {
                              ...x,
                              duration: k === i ? d : x.duration,
                              start: Math.round(acc * 10) / 10,
                            };
                            acc += nx.duration;
                            return nx;
                          });
                          setEdit({ ...edit, scenes });
                          setDirty(true);
                        }}
                      />
                    </Field>
                  </div>
                  {byScene(i).map((x, k) => (
                    <ReviewRow key={k} x={x} lang={lang} />
                  ))}
                </Card>
              </li>
            ))}
          </ol>
          <Card className="flex flex-col gap-3">
            <Field label={t("studio.script.caption")}>
              <Textarea
                rows={3}
                value={edit.caption}
                onChange={(e) => (setEdit({ ...edit, caption: e.target.value }), setDirty(true))}
                dir="auto"
              />
            </Field>
            {items
              .filter((x) => x.scene === null)
              .map((x, k) => (
                <ReviewRow key={k} x={x} lang={lang} />
              ))}
          </Card>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Save />}
              disabled={!dirty}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              {t("studio.script.save")}
            </Button>
            <Button
              icon={<ShieldCheck />}
              loading={review.isPending}
              onClick={() => review.mutate()}
              data-testid="studio-review"
            >
              {t("studio.script.review")}
            </Button>
            {draft.review && (
              <StatusChip
                tone={
                  items.some((x) => x.severity === "violation")
                    ? "violation"
                    : items.length
                      ? "warning"
                      : "ready"
                }
                size="sm"
              >
                {items.length
                  ? t("studio.script.reviewCount", { n: items.length })
                  : t("studio.script.reviewClean")}
              </StatusChip>
            )}
          </div>
          <p className="text-xs text-fg-muted">{t("studio.script.reviewNote")}</p>
        </>
      )}
    </div>
  );
}

function ReviewRow({ x, lang }: { x: ReviewItem; lang: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md p-2 text-sm",
        x.severity === "violation" ? "bg-red-bg" : "bg-amber-bg",
      )}
      data-testid="studio-review-item"
    >
      <TriangleAlert
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          x.severity === "violation" ? "text-red" : "text-amber-text",
        )}
      />
      <span className="flex flex-col gap-0.5">
        <span>
          <span className="font-mono text-xs">{x.code}</span> ·{" "}
          {lang === "en" ? x.message_en : x.message_ar}
        </span>
        {x.text && (
          <q dir="auto" className="text-fg-muted [quotes:none]">
            {x.text}
          </q>
        )}
        {(lang === "en" ? x.suggestion_en : x.suggestion_ar) && (
          <span className="text-fg-muted">
            → {lang === "en" ? x.suggestion_en : x.suggestion_ar}
          </span>
        )}
      </span>
    </div>
  );
}

function ProviderCard({
  on,
  disabled,
  onSelect,
  icon,
  title,
  body,
  tag,
}: {
  on: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
  tag: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 rounded-md border p-4 text-start disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-5",
        on ? "border-ink ring-1 ring-ink" : "border-border hover:bg-sunken",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          {icon}
          {title}
        </span>
        {tag}
      </span>
      <span className="text-sm text-fg-muted">{body}</span>
    </button>
  );
}
