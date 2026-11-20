// Public sample report — «كريم ندى» (V2 upgrade §32, D182). Read-only and static: plays the original and the
// corrected video, seeks to finding timestamps, shows grouped findings with evidence and fixes, the version
// comparison and an illustrative review workflow. No uploads, decisions, comments or paid requests are possible.
import { Link } from "@tanstack/react-router";
import { ChevronDown, CircleCheck, FlaskConical, Info, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardTitle, Page, StatusChip, VideoTimeline } from "@/components/ui";
import { formatClock, useI18n, type TKey } from "@/i18n";
import { groupFindings, type FindingGroup } from "@/features/reports/grouping";
import { CompareBody } from "@/features/collab/CompareTab";
import { cn } from "@/lib/utils";
import {
  NADA_V1,
  NADA_V2,
  SAMPLE_TIMELINE,
  type SampleFinding,
  type SampleVersion,
} from "./nadaSample";

type View = "v1" | "v2" | "compare" | "workflow";

export function SamplePage() {
  const { t } = useI18n();
  const [view, setView] = useState<View>("v1");
  return (
    <Page wide className="flex flex-col gap-5">
      <header
        data-testid="sample-page"
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <FlaskConical aria-hidden="true" className="me-1 inline size-3.5" />
            {t("sample.badge")}
          </Badge>
          <Badge variant="neutral">{t("sample.fictional")}</Badge>
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("sample.title")}</h1>
        <p className="max-w-3xl text-fg-muted">{t("sample.intro")}</p>
        <dl className="grid gap-2 sm:grid-cols-3">
          <Stat
            label={t("sample.v1")}
            value={t("sample.counts", {
              v: NADA_V1.rawCounts.violations,
              w: NADA_V1.rawCounts.warnings,
            })}
            tone="violation"
          />
          <Stat
            label={t("sample.v2")}
            value={t("sample.counts", {
              v: NADA_V2.rawCounts.violations,
              w: NADA_V2.rawCounts.warnings,
            })}
            tone="warning"
          />
          <Stat
            label={t("sample.grouping")}
            value={t("sample.groupingValue", {
              raw: NADA_V1.findings.length,
              groups: groupFindings(NADA_V1.findings).length,
            })}
            tone="neutral"
          />
        </dl>
        <p className="flex items-start gap-2 rounded-md bg-sunken px-3 py-2 text-sm">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("sample.honesty")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/new">{t("sample.cta")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/">{t("sample.backHome")}</Link>
          </Button>
        </div>
      </header>

      <div role="tablist" aria-label={t("sample.title")} className="flex flex-wrap gap-1.5">
        {(["v1", "v2", "compare", "workflow"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "min-h-10 rounded-full border px-4 text-sm",
              view === v
                ? "border-ink bg-ink text-white"
                : "border-border bg-surface hover:bg-sunken",
            )}
          >
            {t(`sample.tab.${v}` as TKey)}
          </button>
        ))}
      </div>

      {view === "v1" && <VersionView v={NADA_V1} />}
      {view === "v2" && <VersionView v={NADA_V2} />}
      {view === "compare" && (
        <CompareBody
          a={{
            caption: NADA_V1.caption,
            transcript: NADA_V1.transcript.map((s) => s.text).join(" "),
            findings: NADA_V1.findings,
            preview: null,
            mediaUrl: NADA_V1.video,
            kind: "video",
          }}
          b={{
            caption: NADA_V2.caption,
            transcript: NADA_V2.transcript.map((s) => s.text).join(" "),
            findings: NADA_V2.findings,
            preview: null,
            mediaUrl: NADA_V2.video,
            kind: "video",
          }}
          labelA={t("sample.v1")}
          labelB={t("sample.v2")}
        />
      )}
      {view === "workflow" && <Workflow />}

      <Card className="flex flex-col gap-2 text-sm">
        <CardTitle>{t("sample.limitsTitle")}</CardTitle>
        <ul className="list-inside list-disc text-fg-muted">
          <li>{t("sample.limit1")}</li>
          <li>{t("sample.limit2")}</li>
          <li>{t("sample.limit3")}</li>
          <li>{t("sample.limit4")}</li>
        </ul>
      </Card>
    </Page>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "violation" | "warning" | "neutral";
}) {
  return (
    <div className="rounded-md bg-sunken p-3">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd
        className={cn(
          "text-lg font-bold",
          tone === "violation" && "text-red",
          tone === "warning" && "text-amber-text",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function VersionView({ v }: { v: SampleVersion }) {
  const { t, lang } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const groups = useMemo(() => groupFindings(v.findings), [v.findings]);
  const seek = (s: number) => {
    setTime(s);
    if (video.current) {
      video.current.currentTime = s;
      void video.current.play().catch(() => {});
    }
  };
  const markers = v.findings
    .filter((f) => f.t_start !== null)
    .map((f) => ({
      id: f.id,
      t: Number(f.t_start),
      severity: f.severity,
      title: (lang === "en" ? f.explanation_en : f.explanation_ar) ?? f.rule_code,
    }));
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div className="flex flex-col gap-3 lg:sticky lg:top-24">
        <Card className="flex flex-col gap-3">
          <video
            ref={video}
            src={v.video}
            controls
            playsInline
            preload="metadata"
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            className="mx-auto aspect-[9/16] max-h-[65vh] w-full rounded-md bg-black object-contain"
            aria-label={t("sample.videoLabel", { n: v.no })}
          />
          {markers.length > 0 && (
            <VideoTimeline
              duration={v.duration}
              currentTime={time}
              markers={markers}
              selectedId={selected}
              onSeek={seek}
              onSelectMarker={(id) => {
                setSelected(id);
                const m = markers.find((x) => x.id === id);
                if (m) seek(m.t);
              }}
            />
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("sample.transcript")}</CardTitle>
          <ol className="flex flex-col gap-1.5 text-sm">
            {v.transcript.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => seek(s.start)}
                  className={cn(
                    "flex w-full gap-2 rounded-md px-2 py-1 text-start hover:bg-sunken",
                    time >= s.start && time < s.end && "bg-green-bg",
                  )}
                >
                  <span className="tabular shrink-0 font-bold">{formatClock(s.start)}</span>
                  <span dir="auto">{s.text}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="text-xs text-fg-muted">
            <span className="font-bold">{t("sample.caption")}: </span>
            <span dir="auto">{v.caption}</span>
          </p>
        </Card>
      </div>
      <section className="flex flex-col gap-3" aria-label={t("ws.findings.title")}>
        <h2 className="text-xl font-bold">
          {t("ws.findings.title")}{" "}
          <span className="text-base font-medium text-fg-muted">
            {t("ws.findings.counts", { groups: groups.length, raw: v.findings.length })}
          </span>
        </h2>
        {groups.length === 0 ? (
          <Card className="flex items-center gap-2">
            <CircleCheck aria-hidden="true" className="size-5 text-green" />
            {t("report.readyNoIssues")}
          </Card>
        ) : (
          groups.map((g) => (
            <SampleGroup
              key={g.key}
              g={g as FindingGroup<SampleFinding>}
              onSeek={seek}
              selected={g.members.some((m) => m.id === selected)}
            />
          ))
        )}
        {v.no === 2 && (
          <p className="rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm">
            {t("sample.v2Note")}
          </p>
        )}
      </section>
    </div>
  );
}

function SampleGroup({
  g,
  onSeek,
  selected,
}: {
  g: FindingGroup<SampleFinding>;
  onSeek: (s: number) => void;
  selected: boolean;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(g.severity === "violation");
  const f = g.members[0]!;
  return (
    <article
      className={cn("rounded-lg border bg-surface p-4", selected ? "border-ink" : "border-border")}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-start gap-3 text-start"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip tone={g.severity} size="sm">
              {t(`severity.${g.severity}`)}
            </StatusChip>
            {g.members.length > 1 && (
              <Badge variant="outline">
                {t("ws.findings.occurrences", { n: g.members.length })}
              </Badge>
            )}
            <Badge variant="neutral">{t("ws.kind.automated")}</Badge>
            <Badge mono>{g.ruleCode}</Badge>
          </span>
          <span className="font-bold">
            {(lang === "en" ? f.explanation_en : f.explanation_ar) ?? g.ruleCode}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-5 shrink-0 text-fg-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {g.members.map((m) => (
            <div key={m.id} className="flex items-start gap-2 rounded-md bg-sunken p-2">
              {m.t_start !== null ? (
                <button
                  type="button"
                  onClick={() => onSeek(Number(m.t_start))}
                  className="tabular shrink-0 rounded-full border border-border px-2 font-bold hover:bg-surface"
                  aria-label={t("issue.seek", { time: formatClock(Number(m.t_start)) })}
                >
                  {formatClock(Number(m.t_start))}
                </button>
              ) : (
                <span className="shrink-0 text-xs text-fg-muted">
                  {t(`ws.source.${m.evidence_type}` as TKey)}
                </span>
              )}
              <q dir="auto" className="[quotes:none]">
                {m.evidence_text}
              </q>
            </div>
          ))}
          <p className="rounded-md border border-green/20 bg-green-bg/60 p-2">
            <span className="font-bold">{t("issue.fix")}: </span>
            {lang === "en" ? f.fix_en : f.fix_ar}
          </p>
        </div>
      )}
    </article>
  );
}

function Workflow() {
  const { t } = useI18n();
  return (
    <Card className="flex flex-col gap-3" data-testid="sample-workflow">
      <CardTitle>{t("sample.workflowTitle")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("sample.workflowNote")}</p>
      <ol className="relative flex flex-col gap-3 border-s-2 border-border ps-5">
        {SAMPLE_TIMELINE.map((e) => (
          <li key={e.key} className="relative">
            <span
              aria-hidden="true"
              className="absolute -start-[27px] top-1.5 size-3 rounded-full border-2 border-surface bg-green"
            />
            <p className="font-medium">{t(`sample.event.${e.key}` as TKey)}</p>
            <p className="text-xs text-fg-muted">{t("ws.header.version", { n: e.version })}</p>
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-2 text-sm">
        <Sparkles aria-hidden="true" className="size-4 text-green" />
        {t("sample.fixNote")}
      </p>
    </Card>
  );
}
