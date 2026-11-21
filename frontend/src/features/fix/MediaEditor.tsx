// SALEEM Fix — media correction editor (V2 completion §15.4–15.7, D198). Edits are pre-filled from the findings and
// the corrected script; the marketer reviews them, optionally records or uploads a corrected voiceover, renders a
// new video in the browser, and compares it with the original before accepting it as a new version.
import { Mic, Plus, Square, Trash2, Upload, Volume2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { formatClock, useI18n, type TKey } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  defaultEdits,
  editsSummary,
  isNoop,
  subtitlesFor,
  type EditableFinding,
  type MediaEdits,
} from "./mediaPlan";
import { pickMime, renderCorrectedVideo, type RenderResult } from "./mediaRender";
import { VIDEO_PROVIDERS, VOICE_PROVIDERS, startRecording } from "./providers";
import { synthesize, voicesFor } from "@/features/studio/tts";

export interface RenderedMedia {
  file: File;
  duration: number;
  summary: ReturnType<typeof editsSummary>;
}

export function MediaEditor({
  sourceUrl,
  duration,
  findings,
  script,
  lang,
  onRendered,
}: {
  sourceUrl: string;
  duration: number;
  findings: EditableFinding[];
  script: string;
  lang: "ar" | "en";
  onRendered: (m: RenderedMedia | null) => void;
}) {
  const { t } = useI18n();
  const [edits, setEdits] = useState<MediaEdits>(() =>
    defaultEdits(findings, duration, {
      disclosure: lang === "ar" ? "إعلان مدفوع" : "Paid advertisement",
      replacement: "",
      script,
    }),
  );
  useEffect(
    () => setEdits((e) => ({ ...e, subtitles: subtitlesFor(script, duration) })),
    [script, duration],
  );
  const [useSubs, setUseSubs] = useState(true);
  const [voice, setVoice] = useState<Blob | null>(null);
  const [voiceKind, setVoiceKind] = useState<"none" | "recorded" | "uploaded" | "generated-local">(
    "none",
  );
  const [tts, setTts] = useState<number | null>(null);
  const [rec, setRec] = useState<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const abort = useRef<AbortController | null>(null);
  const resultUrl = useMemo(() => (result ? URL.createObjectURL(result.blob) : null), [result]);
  const voiceUrl = useMemo(() => (voice ? URL.createObjectURL(voice) : null), [voice]);
  const effective: MediaEdits = { ...edits, subtitles: useSubs ? edits.subtitles : [] };
  const mime = pickMime();
  const stale = () => {
    setResult(null);
    onRendered(null);
  };
  const setRange = <K extends "mute" | "covers" | "overlays">(
    k: K,
    i: number,
    patch: Partial<MediaEdits[K][number]>,
  ) => {
    stale();
    setEdits((e) => ({ ...e, [k]: e[k].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  };
  const remove = (k: "mute" | "covers" | "overlays", i: number) => {
    stale();
    setEdits((e) => ({ ...e, [k]: e[k].filter((_, j) => j !== i) }));
  };

  const render = async () => {
    abort.current = new AbortController();
    setProgress(0);
    try {
      const r = await renderCorrectedVideo({
        sourceUrl,
        edits: effective,
        voiceover: voice,
        onProgress: setProgress,
        signal: abort.current.signal,
      });
      setResult(r);
      const file = new File([r.blob], `saleem-fix-corrected.${r.extension}`, { type: r.blob.type });
      onRendered({ file, duration: r.duration, summary: editsSummary(effective, voiceKind) });
      toast.success(t("fix2.rendered"));
    } catch (e) {
      const code = (e as Error).message;
      toast.error(
        t(`fix2.err.${code}` as TKey) !== `fix2.err.${code}`
          ? t(`fix2.err.${code}` as TKey)
          : t("fix2.err.generic"),
      );
    } finally {
      setProgress(null);
    }
  };

  const rangeRow = (
    k: "mute" | "covers" | "overlays",
    i: number,
    r: { start: number; end: number },
    extra?: React.ReactNode,
  ) => (
    <li
      key={`${k}${i}`}
      className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2 text-sm"
    >
      <label className="flex flex-col gap-0.5">
        <span className="text-xs text-fg-muted">{t("fix2.from")}</span>
        <Input
          type="number"
          step="0.1"
          min={0}
          max={duration}
          value={r.start}
          onChange={(e) => setRange(k, i, { start: Number(e.target.value) } as never)}
          className="h-9 w-24"
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-xs text-fg-muted">{t("fix2.to")}</span>
        <Input
          type="number"
          step="0.1"
          min={0}
          max={duration}
          value={r.end}
          onChange={(e) => setRange(k, i, { end: Number(e.target.value) } as never)}
          className="h-9 w-24"
        />
      </label>
      {extra}
      <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => remove(k, i)}>
        {t("common.delete")}
      </Button>
    </li>
  );

  return (
    <Card className="flex flex-col gap-4" data-testid="media-editor">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Wand2 aria-hidden="true" className="size-5 text-green" />
          {t("fix2.title")}
        </CardTitle>
        <p className="mt-1 text-sm text-fg-muted">{t("fix2.subtitle")}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">{t("fix2.mute")}</h3>
        <ul className="flex flex-col gap-2">{edits.mute.map((r, i) => rangeRow("mute", i, r))}</ul>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus />}
          className="self-start"
          onClick={() => (
            stale(),
            setEdits((e) => ({ ...e, mute: [...e.mute, { start: 0, end: Math.min(3, duration) }] }))
          )}
        >
          {t("fix2.addRange")}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">{t("fix2.covers")}</h3>
        <ul className="flex flex-col gap-2">
          {edits.covers.map((c, i) =>
            rangeRow(
              "covers",
              i,
              c,
              <>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-fg-muted">{t("fix2.position")}</span>
                  <Select
                    value={c.position}
                    onChange={(e) => setRange("covers", i, { position: e.target.value as "top" })}
                    className="h-9 w-28"
                  >
                    {(["top", "middle", "bottom"] as const).map((p) => (
                      <option key={p} value={p}>
                        {t(`fix2.pos.${p}` as TKey)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex min-w-40 flex-1 flex-col gap-0.5">
                  <span className="text-xs text-fg-muted">{t("fix2.replacementText")}</span>
                  <Input
                    value={c.text}
                    onChange={(e) => setRange("covers", i, { text: e.target.value })}
                    dir="auto"
                    className="h-9"
                  />
                </label>
              </>,
            ),
          )}
        </ul>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus />}
          className="self-start"
          onClick={() => (
            stale(),
            setEdits((e) => ({
              ...e,
              covers: [
                ...e.covers,
                { start: 0, end: Math.min(2, duration), position: "middle", text: "" },
              ],
            }))
          )}
        >
          {t("fix2.addRange")}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">{t("fix2.overlays")}</h3>
        <ul className="flex flex-col gap-2">
          {edits.overlays.map((o, i) =>
            rangeRow(
              "overlays",
              i,
              o,
              <label className="flex min-w-40 flex-1 flex-col gap-0.5">
                <span className="text-xs text-fg-muted">{t("fix2.disclosureText")}</span>
                <Input
                  value={o.text}
                  onChange={(e) => setRange("overlays", i, { text: e.target.value })}
                  dir="auto"
                  className="h-9"
                />
              </label>,
            ),
          )}
        </ul>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus />}
          className="self-start"
          onClick={() => (
            stale(),
            setEdits((e) => ({
              ...e,
              overlays: [
                ...e.overlays,
                {
                  start: 0,
                  end: duration,
                  text: lang === "ar" ? "محتوى معدّل بالذكاء الاصطناعي" : "AI-edited content",
                  position: "top",
                },
              ],
            }))
          )}
        >
          {t("fix2.addOverlay")}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <Checkbox
          label={t("fix2.subtitles", { n: edits.subtitles.length })}
          checked={useSubs}
          onChange={(e) => (stale(), setUseSubs(e.target.checked))}
        />
        {useSubs && (
          <ol className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md bg-sunken p-2 text-xs">
            {edits.subtitles.map((s, i) => (
              <li key={i} dir="auto">
                <span className="tabular font-bold">{formatClock(s.start)}</span> {s.text}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">{t("fix2.voiceover")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {!rec ? (
            <Button
              size="sm"
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
          ) : (
            <Button
              size="sm"
              icon={<Square />}
              onClick={async () => {
                const b = await rec.stop();
                setRec(null);
                setVoice(b);
                setVoiceKind("recorded");
                stale();
              }}
            >
              {t("fix2.stopRecording")}
            </Button>
          )}
          {/* D207: real speech generated on this device (open-source Piper voice), replacing the original audio. */}
          <Button
            size="sm"
            variant="secondary"
            icon={<Volume2 />}
            disabled={!script.trim() || tts !== null}
            loading={tts !== null}
            data-testid="fix-tts"
            onClick={async () => {
              setTts(0);
              try {
                const lang = /[؀-ۿ]/.test(script) ? "ar" : "en";
                const b = await synthesize(script, voicesFor(lang)[0]!.id, (p) =>
                  setTts(p.total ? p.loaded / p.total : 0),
                );
                setVoice(b);
                setVoiceKind("generated-local");
                setEdits((x) => ({ ...x, replaceAudio: true }));
                stale();
              } catch {
                toast.error(t("studio.voice.failed"));
              } finally {
                setTts(null);
              }
            }}
          >
            {tts !== null && tts > 0 && tts < 1
              ? t("fix3.ttsDownloading", { p: Math.round(tts * 100) })
              : t("fix3.tts")}
          </Button>
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-sunken">
            <Upload aria-hidden="true" className="size-4" />
            {t("fix2.uploadVoice")}
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setVoice(f);
                  setVoiceKind("uploaded");
                  stale();
                }
                e.target.value = "";
              }}
            />
          </label>
          {voice && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 />}
              onClick={() => (setVoice(null), setVoiceKind("none"), stale())}
            >
              {t("fix2.removeVoice")}
            </Button>
          )}
        </div>
        {voiceUrl && <audio src={voiceUrl} controls className="w-full max-w-md" />}
        <Checkbox
          label={t("fix2.replaceAudio")}
          checked={edits.replaceAudio}
          onChange={(e) => (stale(), setEdits((x) => ({ ...x, replaceAudio: e.target.checked })))}
        />
        <p className="text-xs text-fg-muted">{t("fix2.scriptToRead")}</p>
        <Textarea readOnly rows={2} value={script} dir="auto" className="text-sm" />
        <details className="text-xs text-fg-muted">
          <summary className="cursor-pointer">{t("fix2.providersTitle")}</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {VOICE_PROVIDERS.map((p) => (
              <li key={p.id} className="flex items-start gap-2">
                <Badge variant={p.available ? "outline" : "neutral"}>
                  {p.available ? t("fix.available") : t("fix.configRequired")}
                </Badge>
                {t(p.requirementKey as TKey)}
              </li>
            ))}
            {VIDEO_PROVIDERS.map((p) => (
              <li key={p.id} className="flex items-start gap-2">
                <Badge variant="neutral">{t("fix.configRequired")}</Badge>
                {t(p.requirementKey as TKey)}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {!mime && <p className="text-sm text-red">{t("fix2.err.recorder_unsupported")}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            icon={<Wand2 />}
            disabled={!mime || progress !== null || (isNoop(effective) && !voice)}
            onClick={() => void render()}
            data-testid="render-video"
          >
            {result ? t("fix2.renderAgain") : t("fix2.render")}
          </Button>
          {progress !== null && (
            <>
              <span className="tabular text-sm" role="status">
                {t("fix2.rendering", { p: Math.round(progress * 100) })}
              </span>
              <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>
                {t("common.cancel")}
              </Button>
            </>
          )}
          {mime && (
            <span className="text-xs text-fg-muted">
              {t("fix2.format", { f: mime.extension.toUpperCase() })}
            </span>
          )}
        </div>
        <p className="text-xs text-fg-muted">{t("fix2.renderNote")}</p>
      </div>

      <div className={cn("grid gap-3 md:grid-cols-2", !resultUrl && "md:grid-cols-1")}>
        <figure className="flex flex-col gap-1">
          <figcaption className="text-xs font-bold text-fg-muted">
            {t("fix.review.original")}
          </figcaption>
          <video
            src={sourceUrl}
            controls
            preload="metadata"
            className="max-h-[60vh] w-full rounded-md bg-black object-contain"
          />
        </figure>
        {resultUrl && (
          <figure className="flex flex-col gap-1" data-testid="rendered-video">
            <figcaption className="text-xs font-bold text-fg-muted">
              {t("fix2.corrected")} · {result!.extension.toUpperCase()} ·{" "}
              {(result!.blob.size / 1048576).toFixed(1)} MB
            </figcaption>
            <video
              src={resultUrl}
              controls
              preload="metadata"
              className="max-h-[60vh] w-full rounded-md bg-black object-contain"
            />
          </figure>
        )}
      </div>
    </Card>
  );
}
