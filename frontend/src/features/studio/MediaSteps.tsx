// Studio steps 5–7 (D207): voice, visuals + rendering, preview + acceptance. Media stay in this browser tab until
// the marketer accepts; acceptance uploads the rendered file through the normal version path.
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CircleStop, Clapperboard, Mic, Upload, Volume2, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Field,
  Input,
  ProgressBar,
  Select,
  Switch,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import {
  ApiError,
  CATEGORIES,
  PLATFORMS,
  createSubmission,
  type ProductCategory,
} from "@/lib/api/data";
import { StudioApiError } from "@/lib/api/studio";
import { createPromotion } from "@/lib/api/promotions";
import {
  acceptDraft,
  saveDraft,
  type StudioBrief,
  type StudioDraft,
  type StudioScript,
} from "@/lib/api/studio";
import { platformFromChannels } from "@/features/submissions/wizard";
import { startRecording } from "@/features/fix/providers";
import { LOCAL_VOICES, VOICE_PROVIDER_STATUS, synthesize, voicesFor, type LocalVoice } from "./tts";
import { SIZES, layoutScenes, renderStudioVideo, type RenderOutput } from "./render";
import { disclosuresFor } from "./disclosures";

export interface MediaFile {
  name: string;
  url: string;
  file: File;
}
export interface VoiceClip {
  blob: Blob;
  url: string;
  seconds: number;
  source: "local-piper" | "recorded" | "uploaded";
}
export interface StudioMedia {
  photos: MediaFile[];
  logo: MediaFile | null;
  /** Per-scene narration (generated locally). */
  voices: Record<number, VoiceClip>;
  /** One narration for the whole ad (recorded or uploaded), placed at 0 s. */
  fullVoice: VoiceClip | null;
  /** Scene index → photo index (-1 = brand background). */
  sceneImages: Record<number, number>;
  rendered: (RenderOutput & { url: string; voiceRate: number; subtitles: boolean }) | null;
}

async function seconds(blob: Blob): Promise<number> {
  const ctx = new AudioContext();
  try {
    return (await ctx.decodeAudioData(await blob.arrayBuffer())).duration;
  } finally {
    void ctx.close();
  }
}

/* ------------------------------------------------------------------------------------------------------------ */

export function VoiceStep({
  brief,
  script,
  media,
  onMedia,
  draftId,
}: {
  brief: StudioBrief;
  script: StudioScript;
  media: StudioMedia;
  onMedia: (m: StudioMedia) => void;
  draftId: string;
}) {
  const { t } = useI18n();
  const voices = voicesFor(
    brief.language,
    brief.narration === "none" ? undefined : brief.narration,
  );
  const [voiceId, setVoiceId] = useState<LocalVoice["id"]>(voices[0]!.id);
  const [dl, setDl] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | "all" | null>(null);
  const [rec, setRec] = useState<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const one = async (i: number) => {
    const text = script.scenes[i]!.narration;
    if (!text.trim()) return null;
    const blob = await synthesize(text, voiceId, (p) => setDl(p.total ? p.loaded / p.total : null));
    setDl(null);
    return {
      blob,
      url: URL.createObjectURL(blob),
      seconds: await seconds(blob),
      source: "local-piper" as const,
    };
  };
  const generate = async (only?: number) => {
    setBusy(only ?? "all");
    try {
      const next = { ...media.voices };
      for (const i of only === undefined ? script.scenes.map((_, k) => k) : [only]) {
        const clip = await one(i);
        if (clip) next[i] = clip;
      }
      onMedia({ ...media, voices: next, fullVoice: null, rendered: null });
      await saveDraft(draftId, { voice_provider: `local-piper:${voiceId}` }).catch(() => null);
    } catch {
      toast.error(t("studio.voice.failed"));
    } finally {
      setBusy(null);
      setDl(null);
    }
  };
  const setFull = async (blob: Blob, source: "recorded" | "uploaded") => {
    onMedia({
      ...media,
      voices: {},
      fullVoice: { blob, url: URL.createObjectURL(blob), seconds: await seconds(blob), source },
      rendered: null,
    });
    await saveDraft(draftId, { voice_provider: source }).catch(() => null);
  };
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <CardTitle className="flex items-center gap-2">
          <Volume2 aria-hidden="true" className="size-5" />
          {t("studio.voice.local")}
          <Badge variant="outline">{t("studio.free")}</Badge>
        </CardTitle>
        <p className="text-sm text-fg-muted">{t("studio.voice.localBody")}</p>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label={t("studio.voice.voice")}>
            <Select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value as LocalVoice["id"])}
              data-testid="studio-voice"
            >
              {LOCAL_VOICES.filter((v) => v.lang === brief.language).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} · {t(`studio.dir.narr.${v.gender}` as TKey)} · ~{v.sizeMb} MB
                </option>
              ))}
            </Select>
          </Field>
          <Button
            icon={<Volume2 />}
            loading={busy === "all"}
            disabled={busy !== null}
            onClick={() => void generate()}
            data-testid="studio-generate-voice"
          >
            {t("studio.voice.generate")}
          </Button>
        </div>
        {dl !== null && (
          <div className="flex flex-col gap-1">
            <ProgressBar value={Math.round(dl * 100)} label={t("studio.voice.downloading")} />
            <p className="text-xs text-fg-muted">{t("studio.voice.downloadNote")}</p>
          </div>
        )}
        {brief.language === "ar" && brief.narration === "female" && (
          <p className="text-sm text-amber-text">{t("studio.dir.femaleArNote")}</p>
        )}
        <ol className="flex flex-col gap-2">
          {script.scenes.map((s, i) => (
            <li
              key={i}
              className="flex flex-col gap-2 rounded-md bg-sunken p-3 sm:flex-row sm:items-center"
            >
              <span className="tabular shrink-0 text-xs font-bold text-fg-muted">
                {t("studio.script.scene", { n: i + 1 })}
              </span>
              <span className="min-w-0 flex-1 text-sm" dir="auto">
                {s.narration || "—"}
              </span>
              {media.voices[i] ? (
                <audio
                  controls
                  src={media.voices[i]!.url}
                  className="h-9 w-full sm:w-56"
                  data-testid="studio-voice-clip"
                />
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null || !s.narration.trim()}
                loading={busy === i}
                onClick={() => void generate(i)}
              >
                {t("studio.voice.again")}
              </Button>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>{t("studio.voice.ownTitle")}</CardTitle>
        <p className="text-sm text-fg-muted">{t("studio.voice.ownBody")}</p>
        <div className="flex flex-wrap gap-2">
          {rec ? (
            <Button
              variant="secondary"
              icon={<CircleStop />}
              onClick={async () => {
                const blob = await rec.stop();
                setRec(null);
                await setFull(blob, "recorded");
              }}
            >
              {t("fix2.stopRecording")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon={<Mic />}
              onClick={async () => {
                try {
                  setRec(await startRecording());
                } catch {
                  toast.error(t("fix2.err.microphone"));
                }
              }}
            >
              {t("fix2.record")}
            </Button>
          )}
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 text-sm hover:bg-sunken">
            <Upload aria-hidden="true" className="size-4" />
            {t("fix2.uploadVoice")}
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && void setFull(e.target.files[0], "uploaded")}
            />
          </label>
          {(media.fullVoice || Object.keys(media.voices).length > 0) && (
            <Button
              variant="ghost"
              icon={<X />}
              onClick={() => onMedia({ ...media, voices: {}, fullVoice: null, rendered: null })}
            >
              {t("fix2.removeVoice")}
            </Button>
          )}
        </div>
        {media.fullVoice && <audio controls src={media.fullVoice.url} className="w-full" />}
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>{t("studio.voice.providers")}</CardTitle>
        <ul className="flex flex-col gap-1.5 text-sm">
          {VOICE_PROVIDER_STATUS.map((p) => (
            <li key={p.id} className="flex items-start gap-2">
              <Badge variant={p.available ? "neutral" : "outline"}>
                {p.available ? t("studio.providerOn") : t("studio.providerOff")}
              </Badge>
              <span className={cn(!p.available && "text-fg-muted")}>
                {t(`studio.voice.p.${p.id.replace("-", "_")}` as TKey)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

export function RenderStep({
  brief,
  script,
  media,
  onMedia,
  draftId,
}: {
  brief: StudioBrief;
  script: StudioScript;
  media: StudioMedia;
  onMedia: (m: StudioMedia) => void;
  draftId: string;
}) {
  const { t } = useI18n();
  const [subtitles, setSubtitles] = useState(true);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const imageFor = (i: number) =>
    media.sceneImages[i] ?? (media.photos.length ? i % media.photos.length : -1);
  const render = async () => {
    abort.current = new AbortController();
    setProgress(0);
    try {
      const ctx = new AudioContext();
      const decode = async (c: VoiceClip | undefined | null) =>
        c ? ctx.decodeAudioData(await c.blob.arrayBuffer()) : null;
      const buffers = await Promise.all(script.scenes.map((_, i) => decode(media.voices[i])));
      const full = await decode(media.fullVoice);
      void ctx.close();
      const images = await Promise.all(media.photos.map((p) => loadImage(p.url)));
      const logo = media.logo ? await loadImage(media.logo.url) : null;
      const laid = layoutScenes(
        script.scenes.map((s, i) => ({ ...s, voiceSeconds: buffers[i]?.duration ?? null })),
        rate,
      );
      // A single recorded/uploaded narration plays from 0 s; the last scene stretches so it is never cut.
      if (full) {
        const total = laid.reduce((a, s) => a + s.duration, 0);
        const need = full.duration / rate + 0.4;
        if (need > total) laid[laid.length - 1]!.duration += Math.round((need - total) * 10) / 10;
      }
      const out = await renderStudioVideo({
        aspect: brief.aspect,
        title: brief.product.name,
        colors: brief.brand.colors,
        logo,
        subtitles,
        voiceRate: rate,
        disclosure: disclosuresFor(brief).join(" · "),
        scenes: laid.map((s, i) => ({
          start: s.start,
          duration: s.duration,
          onScreen: s.on_screen,
          narration: s.narration,
          image: imageFor(i) >= 0 ? (images[imageFor(i)] ?? null) : null,
          voice: full ? (i === 0 ? full : null) : (buffers[i] ?? null),
        })),
        onProgress: setProgress,
        signal: abort.current.signal,
      });
      onMedia({
        ...media,
        rendered: { ...out, url: URL.createObjectURL(out.blob), voiceRate: rate, subtitles },
      });
      await saveDraft(draftId, { status: "rendered", render_provider: "browser-template" }).catch(
        () => null,
      );
    } catch (e) {
      const code = e instanceof Error ? e.message : "generic";
      toast.error(
        t(
          `fix2.err.${["recorder_unsupported", "render_empty", "cancelled"].includes(code) ? code : "generic"}` as TKey,
        ),
      );
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };
  const { w, h } = SIZES[brief.aspect];
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <CardTitle>{t("studio.render.visuals")}</CardTitle>
        <p className="text-sm text-fg-muted">{t("studio.render.visualsBody")}</p>
        <ol className="grid gap-3 sm:grid-cols-2">
          {script.scenes.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md bg-sunken p-3">
              {imageFor(i) >= 0 ? (
                <img
                  src={media.photos[imageFor(i)]!.url}
                  alt=""
                  className="size-14 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="size-14 shrink-0 rounded-md"
                  style={{
                    background: `linear-gradient(135deg, ${brief.brand.colors[0] ?? "#0b6e4f"}, ${brief.brand.colors[1] ?? "#07211a"})`,
                  }}
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs font-bold text-fg-muted">
                  {t("studio.script.scene", { n: i + 1 })}
                </span>
                <Select
                  aria-label={t("studio.render.image", { n: i + 1 })}
                  value={String(imageFor(i))}
                  onChange={(e) =>
                    onMedia({
                      ...media,
                      sceneImages: { ...media.sceneImages, [i]: Number(e.target.value) },
                      rendered: null,
                    })
                  }
                >
                  <option value="-1">{t("studio.render.brandBackground")}</option>
                  {media.photos.map((p, k) => (
                    <option key={p.url} value={k}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-56">
            <Switch
              checked={subtitles}
              onCheckedChange={setSubtitles}
              label={t("studio.render.subtitles")}
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            {t("studio.render.rate")}
            <input
              type="range"
              min={0.85}
              max={1.15}
              step={0.05}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-32"
            />
            <span className="tabular">{rate.toFixed(2)}×</span>
          </label>
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>{t("studio.render.approaches")}</CardTitle>
        <ul className="flex flex-col gap-1.5 text-sm">
          {(["template", "image", "video", "avatar"] as const).map((k) => (
            <li key={k} className="flex items-start gap-2">
              <Badge variant={k === "template" ? "neutral" : "outline"}>
                {k === "template" ? t("studio.providerOn") : t("studio.providerOff")}
              </Badge>
              <span className={cn(k !== "template" && "text-fg-muted")}>
                {t(`studio.render.a.${k}` as TKey)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {progress === null ? (
            <Button
              icon={<Clapperboard />}
              onClick={() => void render()}
              data-testid="studio-render"
            >
              {media.rendered ? t("fix2.renderAgain") : t("studio.render.cta")}
            </Button>
          ) : (
            <>
              <ProgressBar
                value={Math.round(progress * 100)}
                label={t("fix2.rendering", { p: Math.round(progress * 100) })}
                className="min-w-48 flex-1"
              />
              <Button variant="ghost" onClick={() => abort.current?.abort()}>
                {t("common.cancel")}
              </Button>
            </>
          )}
          <span className="text-xs text-fg-muted">
            {w}×{h} · {t("fix2.renderNote")}
          </span>
        </div>
        {media.rendered && (
          <figure className="m-0 flex flex-col items-center gap-2" data-testid="studio-rendered">
            <video
              src={media.rendered.url}
              controls
              playsInline
              className={cn(
                "rounded-md bg-black",
                brief.aspect === "16:9" ? "w-full max-w-2xl" : "max-h-[70vh]",
              )}
            />
            <figcaption className="text-sm text-fg-muted">
              {media.rendered.extension.toUpperCase()} · {media.rendered.duration.toFixed(1)} s ·{" "}
              {(media.rendered.blob.size / 1e6).toFixed(1)} MB
            </figcaption>
          </figure>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

const SECTOR_CATEGORY: Record<string, ProductCategory> = {
  cosmetics: "beauty" as ProductCategory,
  food_beverage: "food" as ProductCategory,
  health_supplements: "health" as ProductCategory,
};

export function AcceptStep({
  draft,
  media,
  orgId,
}: {
  draft: StudioDraft;
  media: StudioMedia;
  orgId: string | null;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const b = draft.brief;
  const script = draft.script!;
  const [title, setTitle] = useState(
    b.product.name ? `${b.product.name}${b.campaign.name ? ` — ${b.campaign.name}` : ""}` : "",
  );
  const [caption, setCaption] = useState(script.caption);
  const accept = useMutation({
    mutationFn: async () => {
      if (!user || !media.rendered) throw new StudioApiError("no media", "invalid_status");
      const r = media.rendered;
      const file = new File([r.blob], `saleem-studio.${r.extension}`, {
        type: r.mimeType || `video/${r.extension}`,
      });
      const category =
        (b.product.sector && SECTOR_CATEGORY[b.product.sector]) ||
        (CATEGORIES.includes("other" as ProductCategory)
          ? ("other" as ProductCategory)
          : CATEGORIES[0]!);
      const promotionId =
        draft.mode === "replacement" && draft.source_promotion_id
          ? draft.source_promotion_id
          : await createPromotion(user.id, {
              title,
              orgId,
              productId: draft.product_id,
              sector: b.product.sector,
              channels: b.context.channels,
              communicationType: b.context.communication_type as never,
              audience: ["general"],
              isPaid: b.context.is_paid,
              distribution: b.context.publisher as never,
              creatorLicenseNo: null,
              caption,
              reviewerNotes: null,
              campaignId: draft.campaign_id,
              deadlineAt: null,
            });
      const submissionId = await createSubmission({
        promotionId,
        userId: user.id,
        kind: "video",
        file,
        poster: null,
        durationSeconds: Math.round(r.duration * 10) / 10,
        textContent: "",
        caption,
        title,
        platform: platformFromChannels(b.context.channels, PLATFORMS, "instagram"),
        productCategory: category,
        isPaidAd: b.context.is_paid,
        hasWrittenContract: false,
        aiUsed: true,
        licenseNo: "",
        parentId: null,
        orgId,
        campaignId: draft.campaign_id,
      });
      await acceptDraft(draft.id, promotionId, submissionId);
      return submissionId;
    },
    onSuccess: (id) => void navigate({ to: "/checks/$id", params: { id } }),
    onError: (e) =>
      toast.error(
        e instanceof ApiError && e.code === "upload"
          ? t("newCheck.errUpload")
          : t("studio.err.accept"),
      ),
  });
  return (
    <div className="flex flex-col gap-5">
      <Card className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
        <video
          src={media.rendered!.url}
          controls
          playsInline
          className="max-h-[60vh] rounded-md bg-black md:w-72"
        />
        <div className="flex flex-col gap-4">
          <Field label={t("studio.accept.title")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" />
          </Field>
          <Field label={t("studio.script.caption")}>
            <Textarea
              rows={5}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              dir="auto"
            />
          </Field>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {[
              [
                t("studio.accept.script"),
                t(`studio.script.by.${draft.script_provider ?? "template"}` as TKey),
              ],
              [
                t("studio.accept.voice"),
                draft.voice_provider ??
                  (media.fullVoice
                    ? media.fullVoice.source
                    : Object.keys(media.voices).length
                      ? "local-piper"
                      : t("studio.accept.noVoice")),
              ],
              [t("studio.accept.render"), t("studio.render.a.template")],
              [t("studio.accept.format"), `${b.aspect} · ${media.rendered!.duration.toFixed(1)} s`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-sunken p-2">
                <dt className="text-xs text-fg-muted">{k}</dt>
                <dd className="font-medium" dir="auto">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>
      <Card className="flex flex-col gap-3">
        <p className="text-sm">
          {draft.mode === "replacement"
            ? t("studio.accept.bodyReplacement")
            : t("studio.accept.body")}
        </p>
        <div>
          <Button
            loading={accept.isPending}
            disabled={!title.trim()}
            onClick={() => accept.mutate()}
            data-testid="studio-accept"
          >
            {draft.mode === "replacement"
              ? t("studio.accept.ctaReplacement")
              : t("studio.accept.cta")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
