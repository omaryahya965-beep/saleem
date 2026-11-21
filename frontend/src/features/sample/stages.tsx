// Guided Nada Cream sample (D206) — the five stages. Read-only and static: nothing here writes, uploads or calls an AI
// provider. Findings are consolidated with the app's own grouping; rule references come from the published rulebook.
import { Link } from "@tanstack/react-router";
import {
  AudioLines,
  Bot,
  Captions,
  CircleCheck,
  CircleDashed,
  CirclePlus,
  Eraser,
  FileText,
  Gavel,
  Layers,
  MicOff,
  Play,
  Scale,
  ShieldCheck,
  Type,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { VideoTimeline } from "@/components/ui";
import { formatClock, useI18n, type TKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { diffGroups, groupFindings, type FindingGroup } from "@/features/reports/grouping";
import { sentenceDiff, type SentenceOp } from "@/features/collab/sentenceDiff";
import { useGroupTitle } from "@/features/landing/sections";
import { AvailabilityTag, PhoneFrame, cta, type Availability } from "@/features/public/ui";
import {
  NADA_MEDIA,
  NADA_V1,
  NADA_V2,
  RULE_REFS,
  SAMPLE_TIMELINE,
  type SampleFinding,
  type SampleVersion,
} from "./nadaSample";

export type Group = FindingGroup<SampleFinding>;
export const V1_GROUPS = groupFindings(NADA_V1.findings) as Group[];
export const V2_GROUPS = groupFindings(NADA_V2.findings) as Group[];

const SOURCE_ICON: Record<string, LucideIcon> = {
  transcript: AudioLines,
  frame: Type,
  caption: FileText,
  metadata: Layers,
};

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[24px] bg-white p-5 ring-1 ring-forest/10 sm:p-6", className)}>
      {children}
    </div>
  );
}
function Label({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold tracking-wide text-gold-deep">{children}</p>;
}
function SeverityDot({ s }: { s: "violation" | "warning" }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 shrink-0 rounded-full", s === "violation" ? "bg-red" : "bg-amber")}
    />
  );
}
function SeverityChip({ s }: { s: "violation" | "warning" }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        s === "violation" ? "bg-red-bg text-red" : "bg-amber-bg text-amber-text",
      )}
    >
      <SeverityDot s={s} />
      {t(`severity.${s}` as TKey)}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Shared finding detail                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

export function FindingDetail({
  g,
  onSeek,
  wide,
}: {
  g: Group;
  onSeek?: (t: number) => void;
  wide?: boolean;
}) {
  const { t, lang } = useI18n();
  const f = g.members[0]!;
  const ref = RULE_REFS[g.ruleCode];
  return (
    <div className={cn("grid gap-5", wide && "md:grid-cols-2")}>
      <div className="flex flex-col gap-2">
        <Label>
          {t("demo.evidence")} · {t("demo.occurrences", { n: g.members.length })}
        </Label>
        <ul className="flex flex-col gap-2">
          {g.members.map((m) => {
            const Icon = SOURCE_ICON[m.evidence_type] ?? Layers;
            return (
              <li key={m.id} className="flex items-start gap-3 rounded-[14px] bg-cream p-3">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {t(`ws.source.${m.evidence_type}` as TKey)}
                    {m.t_start !== null && onSeek ? (
                      <button
                        type="button"
                        onClick={() => onSeek(Number(m.t_start))}
                        className="tabular inline-flex min-h-7 items-center gap-1 rounded-full bg-forest px-2.5 text-xs font-bold text-cream hover:bg-forest-2"
                        aria-label={t("issue.seek", { time: formatClock(Number(m.t_start)) })}
                      >
                        <Play aria-hidden="true" className="size-3" />
                        {formatClock(Number(m.t_start))}
                      </button>
                    ) : m.t_start !== null ? (
                      <span className="tabular rounded-full bg-forest px-2 font-bold text-cream">
                        {formatClock(Number(m.t_start))}
                      </span>
                    ) : (
                      <span>· {t("demo.noTime")}</span>
                    )}
                  </span>
                  <q dir="rtl" className="text-sm text-forest [quotes:none]">
                    {m.evidence_text}
                  </q>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label>{t("demo.why")}</Label>
          <p className="text-forest">{lang === "en" ? f.explanation_en : f.explanation_ar}</p>
        </div>
        {ref && (
          <div className="flex flex-col gap-1">
            <Label>{t("demo.source")}</Label>
            <p className="flex items-start gap-2 text-forest">
              <Scale aria-hidden="true" className="mt-1 size-4 shrink-0 text-gold-deep" />
              <span>
                <span className="font-mono text-xs">{g.ruleCode}</span> ·{" "}
                {lang === "en" ? ref.title_en : ref.title_ar}
                <span className="block text-sm text-muted">
                  {lang === "en" ? ref.source_en : ref.source_ar}
                </span>
              </span>
            </p>
            <p className="text-xs text-muted">{t("demo.sourceNote")}</p>
          </div>
        )}
        <div className="flex flex-col gap-1 rounded-[14px] bg-green-bg/70 p-3">
          <Label>{t("demo.fix")}</Label>
          <p className="text-forest">{lang === "en" ? f.fix_en : f.fix_ar}</p>
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("demo.requirement")}</Label>
          <p className="flex items-start gap-2 text-forest">
            <ShieldCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-green" />
            {t(`demo.req.${g.ruleCode}` as TKey)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Stage 1 — original advertisement workspace                                                                  */
/* ------------------------------------------------------------------------------------------------------------ */

export function OriginalStage({
  selected,
  onSelect,
  seekRequest,
}: {
  selected: string | null;
  onSelect: (key: string | null) => void;
  seekRequest: { t: number; n: number } | null;
}) {
  const { t, lang } = useI18n();
  const title = useGroupTitle();
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const seek = (s: number) => {
    setTime(s);
    const v = video.current;
    if (!v) return;
    v.currentTime = s;
    void v.play().catch(() => {});
  };
  useEffect(() => {
    if (seekRequest) seek(seekRequest.t);
  }, [seekRequest]);
  const markers = NADA_V1.findings
    .filter((f) => f.t_start !== null)
    .map((f) => ({
      id: f.id,
      t: Number(f.t_start),
      severity: f.severity,
      title: (lang === "en" ? f.explanation_en : f.explanation_ar) ?? f.rule_code,
    }));
  const sel = V1_GROUPS.find((g) => g.key === selected) ?? null;
  const selTimes = new Set(
    (sel?.members ?? []).filter((m) => m.t_start !== null).map((m) => Number(m.t_start)),
  );
  const markerGroup = (id: string) => V1_GROUPS.find((g) => g.members.some((m) => m.id === id));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div className="flex flex-col gap-4 lg:sticky lg:top-36">
        <Panel className="flex flex-col gap-4 p-4 sm:p-4">
          <div className="mx-auto w-full max-w-[220px] sm:max-w-[300px]">
            <PhoneFrame tone="light">
              <video
                ref={video}
                src={NADA_V1.video}
                poster={NADA_MEDIA.v1Poster}
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                className="size-full object-cover"
                aria-label={t("sample.videoLabel", { n: 1 })}
              />
            </PhoneFrame>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-muted">{t("demo.timeline")}</p>
            <VideoTimeline
              duration={NADA_V1.duration}
              currentTime={time}
              markers={markers}
              selectedId={sel?.members[0]?.id ?? null}
              onSeek={seek}
              onSelectMarker={(id) => {
                const g = markerGroup(id);
                if (g) onSelect(g.key);
                const m = markers.find((x) => x.id === id);
                if (m) seek(m.t);
              }}
            />
          </div>
        </Panel>
        <Panel className="flex flex-col gap-3">
          <Label>{t("sample.transcript")}</Label>
          <ol className="flex flex-col gap-1">
            {NADA_V1.transcript.map((s, i) => {
              const playing = time >= s.start && time < s.end;
              const linked = [...selTimes].some((x) => x >= s.start && x < s.end);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => seek(s.start)}
                    aria-current={playing ? "true" : undefined}
                    className={cn(
                      "flex w-full gap-3 rounded-[12px] px-3 py-2 text-start transition-colors hover:bg-cream",
                      playing && "bg-green-bg",
                      linked && "ring-2 ring-red/40",
                    )}
                  >
                    <span className="tabular shrink-0 text-sm font-bold text-gold-deep">
                      {formatClock(s.start)}
                    </span>
                    <span dir="rtl" className="text-forest">
                      {s.text}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="border-t border-forest/10 pt-3 text-sm text-muted">
            <span className="font-bold text-forest">{t("sample.caption")}: </span>
            <span dir="rtl">{NADA_V1.caption}</span>
          </p>
        </Panel>
      </div>

      <section aria-label={t("ws.findings.title")} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-forest">{t("ws.findings.title")}</h2>
          <p className="text-sm text-muted">
            {t("sample.groupingValue", { raw: NADA_V1.findings.length, groups: V1_GROUPS.length })}
          </p>
        </div>
        <p className="text-sm text-muted">{t("demo.pick")}</p>
        <ul className="flex flex-col gap-3">
          {V1_GROUPS.map((g) => {
            const on = g.key === selected;
            const times = g.members.filter((m) => m.t_start !== null).map((m) => Number(m.t_start));
            return (
              <li key={g.key}>
                <article
                  data-testid="sample-finding"
                  className={cn(
                    "rounded-[20px] bg-white ring-1 transition-shadow",
                    on
                      ? "shadow-[0_20px_50px_-28px_rgb(7_33_26/0.5)] ring-forest/40"
                      : "ring-forest/10",
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={on}
                    onClick={() => {
                      onSelect(on ? null : g.key);
                      if (!on && times.length) seek(times[0]!);
                    }}
                    className="flex w-full items-start gap-3 p-4 text-start sm:p-5"
                  >
                    <span className="mt-1.5">
                      <SeverityDot s={g.severity} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="font-bold text-forest">{title(g)}</span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <SeverityChip s={g.severity} />
                        <span className="font-mono">{g.ruleCode}</span>
                        {g.members.length > 1 && (
                          <span>{t("demo.occurrences", { n: g.members.length })}</span>
                        )}
                        {times.map((x, i) => (
                          <span
                            key={i}
                            className="tabular rounded-full bg-cream px-2 font-bold text-forest"
                          >
                            {formatClock(x)}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                  {on && (
                    <div className="border-t border-forest/10 p-4 sm:p-5">
                      <FindingDetail g={g} onSeek={seek} />
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Stage 2 — understand the findings                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

export function FindingsStage({
  selected,
  onSelect,
  onSeekOriginal,
}: {
  selected: string | null;
  onSelect: (key: string) => void;
  onSeekOriginal: (key: string, t: number) => void;
}) {
  const { t } = useI18n();
  const title = useGroupTitle();
  const g = V1_GROUPS.find((x) => x.key === selected) ?? V1_GROUPS[0]!;
  const hasFrame = g.members.some((m) => m.evidence_type === "frame");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      <ol className="flex flex-col gap-2" aria-label={t("ws.findings.title")}>
        {V1_GROUPS.map((x, n) => {
          const on = x.key === g.key;
          return (
            <li key={x.key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(x.key)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[16px] p-3 text-start transition-colors",
                  on ? "bg-forest text-cream" : "text-forest hover:bg-white",
                )}
              >
                <span
                  className={cn(
                    "tabular grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                    on ? "bg-gold text-forest" : "bg-white ring-1 ring-forest/10",
                  )}
                >
                  {n + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[15px] font-medium">{title(x)}</span>
                  <span
                    className={cn(
                      "flex items-center gap-2 text-xs",
                      on ? "text-cream/70" : "text-muted",
                    )}
                  >
                    <SeverityDot s={x.severity} />
                    <span className="font-mono">{x.ruleCode}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <Panel className="flex flex-col gap-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip s={g.severity} />
            <span className="rounded-full bg-cream px-2.5 py-0.5 font-mono text-xs text-forest">
              {g.ruleCode}
            </span>
            <span className="text-xs text-muted">
              {t("demo.occurrences", { n: g.members.length })}
            </span>
          </div>
          <h3 className="font-display text-2xl leading-snug font-bold text-forest sm:text-3xl ltr:font-sans">
            {title(g)}
          </h3>
        </div>
        {hasFrame && (
          <figure className="m-0 flex items-center gap-4 rounded-[16px] bg-cream p-3">
            <img
              src={NADA_MEDIA.v1Claim}
              alt={t("demo.claimFrame")}
              loading="lazy"
              width={540}
              height={945}
              className="h-32 w-[72px] rounded-[10px] object-cover"
            />
            <figcaption className="text-sm text-muted">{t("demo.claimFrame")}</figcaption>
          </figure>
        )}
        <FindingDetail g={g} wide onSeek={(s) => onSeekOriginal(g.key, s)} />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Stage 3 — correct the advertisement                                                                          */
/* ------------------------------------------------------------------------------------------------------------ */

const TOOLS: { key: string; icon: LucideIcon; tag: Availability }[] = [
  { key: "text", icon: FileText, tag: "provider" },
  { key: "overlay", icon: Layers, tag: "available" },
  { key: "subtitles", icon: Captions, tag: "available" },
  { key: "cover", icon: Eraser, tag: "available" },
  { key: "mute", icon: MicOff, tag: "available" },
  { key: "voice", icon: AudioLines, tag: "available" },
];

function DiffList({ ops, side }: { ops: SentenceOp[]; side: "before" | "after" }) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-col gap-1.5" dir="rtl">
      {ops.map((o, i) => (
        <li
          key={i}
          className={cn(
            "rounded-[10px] px-3 py-2 text-[15px]",
            o.op === "same" && "text-forest",
            o.op === "removed" && "bg-red-bg text-red line-through decoration-red/50",
            o.op === "added" && "bg-green-bg text-green",
          )}
        >
          {o.op !== "same" && (
            <span className="sr-only">
              {side === "before" ? t("demo.removed") : t("demo.addedText")}:{" "}
            </span>
          )}
          {o.text}
        </li>
      ))}
    </ul>
  );
}

export function CorrectStage() {
  const { t } = useI18n();
  const caption = useMemo(() => sentenceDiff(NADA_V1.caption, NADA_V2.caption), []);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel className="grid grid-cols-2 gap-4">
          {[
            {
              img: NADA_MEDIA.v1Claim,
              label: t("demo.before"),
              cap: t("demo.claimFrame"),
              tone: "text-red",
            },
            {
              img: NADA_MEDIA.v2Poster,
              label: t("demo.after"),
              cap: t("demo.overlayFrame"),
              tone: "text-green",
            },
          ].map((x) => (
            <figure key={x.label} className="m-0 flex flex-col gap-2">
              <PhoneFrame tone="light">
                <img
                  src={x.img}
                  alt={x.cap}
                  loading="lazy"
                  width={540}
                  height={945}
                  className="size-full object-cover"
                />
              </PhoneFrame>
              <figcaption className="flex flex-col gap-0.5 px-1">
                <span className={cn("text-sm font-bold", x.tone)}>{x.label}</span>
                <span className="text-xs text-muted">{x.cap}</span>
              </figcaption>
            </figure>
          ))}
        </Panel>
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-forest">{t("demo.tools.title")}</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TOOLS.map((x) => (
              <li
                key={x.key}
                className="flex flex-col gap-2 rounded-[18px] bg-white p-4 ring-1 ring-forest/10"
              >
                <span className="flex items-center justify-between gap-2">
                  <x.icon aria-hidden="true" className="size-5 text-gold-deep" />
                  <AvailabilityTag kind={x.tag} label={t(`home.journeys.tag.${x.tag}` as TKey)} />
                </span>
                <span className="font-bold text-forest">
                  {t(`demo.tools.${x.key}.title` as TKey)}
                </span>
                <span className="text-sm text-muted">{t(`demo.tools.${x.key}.body` as TKey)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Panel className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-forest">{t("demo.captionChange")}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>{t("demo.before")}</Label>
            <DiffList ops={caption.before} side="before" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("demo.after")}</Label>
            <DiffList ops={caption.after} side="after" />
          </div>
        </div>
      </Panel>
      <p className="flex items-start gap-3 rounded-[18px] bg-amber-bg px-4 py-3 text-sm text-forest">
        <Bot aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-text" />
        {t("demo.honesty")}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Stage 4 — compare versions                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

export function CompareStage() {
  const { t } = useI18n();
  const title = useGroupTitle();
  const diff = useMemo(() => diffGroups(NADA_V1.findings, NADA_V2.findings), []);
  const speech = useMemo(
    () =>
      sentenceDiff(
        NADA_V1.transcript.map((s) => s.text).join(" "),
        NADA_V2.transcript.map((s) => s.text).join(" "),
      ),
    [],
  );
  const count = (gs: Group[], s: "violation" | "warning") =>
    gs.filter((g) => g.severity === s).length;
  const col = (label: string, icon: ReactNode, items: Group[], tone: string) => (
    <div className="flex flex-col gap-3 rounded-[20px] bg-white p-5 ring-1 ring-forest/10">
      <p className={cn("flex items-center gap-2 text-sm font-bold", tone)}>
        {icon}
        {label} · {items.length}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t("home.ba.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((g) => (
            <li key={g.key} className="flex items-start gap-2 text-sm text-forest">
              <SeverityDot s={g.severity} />
              <span>
                {title(g)} <span className="font-mono text-xs text-muted">{g.ruleCode}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const versions: { v: SampleVersion; groups: Group[]; poster: string; label: string }[] = [
    { v: NADA_V1, groups: V1_GROUPS, poster: NADA_MEDIA.v1Poster, label: t("sample.v1") },
    { v: NADA_V2, groups: V2_GROUPS, poster: NADA_MEDIA.v2Poster, label: t("sample.v2") },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div data-testid="compare-summary" className="grid grid-cols-2 gap-3 sm:gap-6">
        {versions.map((x) => (
          <figure
            key={x.v.no}
            className="m-0 flex flex-col gap-3 rounded-[24px] bg-white p-3 ring-1 ring-forest/10 sm:p-5"
          >
            <figcaption className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-forest px-3 py-1 text-xs font-bold text-cream">
                V{x.v.no}
              </span>
              <span className="text-sm font-bold text-forest">{x.label}</span>
            </figcaption>
            <div className="mx-auto w-full max-w-[220px] sm:max-w-[300px]">
              <PhoneFrame tone="light">
                <video
                  src={x.v.video}
                  poster={x.poster}
                  controls
                  playsInline
                  preload="none"
                  className="size-full object-cover"
                  aria-label={t("sample.videoLabel", { n: x.v.no })}
                />
              </PhoneFrame>
            </div>
            <p className="flex flex-wrap gap-2 text-xs">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium",
                  count(x.groups, "violation") ? "bg-red-bg text-red" : "bg-green-bg text-green",
                )}
              >
                {t("compare2.violations", { n: count(x.groups, "violation") })}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium",
                  count(x.groups, "warning")
                    ? "bg-amber-bg text-amber-text"
                    : "bg-green-bg text-green",
                )}
              >
                {t("compare2.warnings", { n: count(x.groups, "warning") })}
              </span>
            </p>
          </figure>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {col(
          t("home.ba.gone"),
          <CircleCheck aria-hidden="true" className="size-4" />,
          diff.noLongerDetected as Group[],
          "text-green",
        )}
        {col(
          t("home.ba.pending"),
          <CircleDashed aria-hidden="true" className="size-4" />,
          diff.persistent.map((p) => p.after) as Group[],
          "text-amber-text",
        )}
        {col(
          t("home.ba.added"),
          <CirclePlus aria-hidden="true" className="size-4" />,
          diff.added as Group[],
          "text-forest",
        )}
      </div>
      <Panel className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-forest">{t("demo.speech")}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>V1 · {t("demo.before")}</Label>
            <DiffList ops={speech.before} side="before" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>V2 · {t("demo.after")}</Label>
            <DiffList ops={speech.after} side="after" />
          </div>
        </div>
      </Panel>
      <p className="rounded-[18px] bg-cream px-4 py-3 text-sm text-muted ring-1 ring-forest/10">
        {t("home.ba.note")}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Stage 5 — review and decision                                                                               */
/* ------------------------------------------------------------------------------------------------------------ */

type Actor = "marketer" | "manager" | "reviewer" | "system";
const ACTORS: Record<(typeof SAMPLE_TIMELINE)[number]["key"], Actor> = {
  created: "marketer",
  analysed: "system",
  submitted: "marketer",
  assigned: "manager",
  changes: "reviewer",
  uploaded: "marketer",
  analysed2: "system",
  returned: "system",
  conditional: "reviewer",
  fulfilled: "marketer",
  final: "reviewer",
};

export function ReviewStage({ startTo }: { startTo: string }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      <Panel className="sm:p-8">
        <div data-testid="sample-workflow" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-forest">{t("sample.workflowTitle")}</h3>
            <p className="text-sm text-muted">{t("sample.workflowNote")}</p>
          </div>
          <ol className="relative flex flex-col gap-5">
            <span
              aria-hidden="true"
              className="absolute inset-y-3 start-[17px] w-px bg-forest/15"
            />
            {SAMPLE_TIMELINE.map((e) => {
              const a = ACTORS[e.key];
              const human = a !== "system";
              const decision = e.key === "changes" || e.key === "conditional" || e.key === "final";
              return (
                <li key={e.key} className="relative flex gap-4">
                  <span
                    className={cn(
                      "relative z-10 grid size-9 shrink-0 place-items-center rounded-full",
                      decision
                        ? "bg-forest text-gold"
                        : human
                          ? "bg-cream text-forest ring-1 ring-forest/15"
                          : "bg-green-bg text-green",
                    )}
                  >
                    {decision ? (
                      <Gavel aria-hidden="true" className="size-4" />
                    ) : human ? (
                      <UserRound aria-hidden="true" className="size-4" />
                    ) : (
                      <Bot aria-hidden="true" className="size-4" />
                    )}
                  </span>
                  <span className="flex flex-col gap-0.5 pt-1">
                    <span className="text-[15px] font-medium text-forest">
                      {t(`sample.event.${e.key}` as TKey)}
                    </span>
                    <span className="text-xs text-muted">
                      {t(`demo.actor.${a}` as TKey)} · V{e.version}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </Panel>
      <div className="flex flex-col gap-4 lg:sticky lg:top-36">
        <div className="flex flex-col gap-3 rounded-[24px] bg-forest p-6 text-cream">
          <p className="flex items-center gap-2 font-bold">
            <CircleDashed aria-hidden="true" className="size-5 text-gold" />
            {t("demo.open")}
          </p>
          <ul className="flex flex-col gap-2">
            {V2_GROUPS.map((g) => (
              <li key={g.key} className="flex items-start gap-2 text-sm text-cream/85">
                <span className="font-mono text-xs text-gold">{g.ruleCode}</span>
                {t(`demo.req.${g.ruleCode}` as TKey)}
              </li>
            ))}
          </ul>
          <p className="border-t border-cream/10 pt-3 text-sm text-cream/70">
            {t("demo.openBody")}
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-[24px] bg-white p-6 ring-1 ring-forest/10">
          <p className="flex items-center gap-2 text-sm font-bold text-forest">
            <Gavel aria-hidden="true" className="size-4 text-gold-deep" />
            {t("home.collab.human")}
          </p>
          <p className="text-sm text-muted">{t("sample.fixNote")}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to={startTo} className={cta("forest")}>
              {t("sample.cta")}
            </Link>
            <Link to="/" className={cta("outline")}>
              {t("sample.backHome")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
