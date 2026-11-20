// Version comparison (V2 upgrade §16, D181): summary of both versions, side-by-side media, sentence-level text
// panels with labelled additions / removals (not colour alone), and a grouped findings comparison with full
// descriptions. «No longer detected» is never presented as «legally resolved»; no compliance percentage.
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Badge, Card, CardTitle, Field, Select, Skeleton, StatusChip } from "@/components/ui";
import { formatClock, useI18n } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { versionPreview } from "@/lib/api/comments";
import type { VersionSummary } from "@/lib/api/promotions";
import {
  diffGroups,
  groupFindings,
  type FindingGroup,
  type GroupableFinding,
} from "@/features/reports/grouping";
import { sentenceDiff, type SentenceOp } from "./sentenceDiff";
import { cn } from "@/lib/utils";

interface VersionData {
  caption: string;
  transcript: string;
  findings: GroupableFinding[];
  preview: string | null;
  mediaUrl: string | null;
  kind: string;
}

async function loadVersion(id: string): Promise<VersionData> {
  const [{ data: s }, { data: tr }, { data: run }, preview] = await Promise.all([
    supabase
      .from("submissions")
      .select("caption, text_content, kind, file_path, media_deleted_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("transcripts").select("full_text").eq("submission_id", id).maybeSingle(),
    supabase
      .from("analysis_runs")
      .select("id")
      .eq("submission_id", id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    versionPreview(id),
  ]);
  const { data: findings } = run
    ? await supabase
        .from("findings")
        .select(
          "id, rule_code, severity, finding_type, evidence_type, evidence_text, explanation_ar, explanation_en, t_start, status",
        )
        .eq("run_id", run.id)
    : { data: [] };
  let mediaUrl: string | null = null;
  if (s?.file_path && !s.media_deleted_at && (s.kind === "video" || s.kind === "image")) {
    const { data } = await supabase.storage.from("media").createSignedUrl(s.file_path, 3600);
    mediaUrl = data?.signedUrl ?? null;
  }
  return {
    caption: [s?.caption ?? "", s?.kind === "text" ? (s?.text_content ?? "") : ""]
      .filter(Boolean)
      .join("\n"),
    transcript: tr?.full_text ?? "",
    findings: (findings ?? []) as GroupableFinding[],
    preview,
    mediaUrl,
    kind: s?.kind ?? "text",
  };
}

export function CompareTab({ versions }: { versions: VersionSummary[] }) {
  const { t } = useI18n();
  const [aId, setA] = useState(versions.at(-2)?.id ?? versions[0]?.id ?? "");
  const [bId, setB] = useState(versions.at(-1)?.id ?? "");
  const a = useQuery({
    queryKey: ["compare", aId],
    queryFn: () => loadVersion(aId),
    enabled: Boolean(aId),
  });
  const b = useQuery({
    queryKey: ["compare", bId],
    queryFn: () => loadVersion(bId),
    enabled: Boolean(bId),
  });
  if (versions.length < 2) return <p className="text-sm text-fg-muted">{t("compare.needTwo")}</p>;
  const va = versions.find((v) => v.id === aId);
  const vb = versions.find((v) => v.id === bId);
  const label = (v?: VersionSummary) => t("ws.header.version", { n: v?.version_no ?? 0 });
  return (
    <div className="flex flex-col gap-5" data-testid="compare-tab">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("compare.from")}>
          <Select value={aId} onChange={(e) => setA(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {label(v)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("compare.to")}>
          <Select value={bId} onChange={(e) => setB(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {label(v)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {!a.data || !b.data ? (
        <Skeleton className="h-60 w-full rounded-lg" />
      ) : (
        <CompareBody a={a.data} b={b.data} labelA={label(va)} labelB={label(vb)} />
      )}
    </div>
  );
}

/** Shared by the authenticated tab and the public Nada Cream sample. */
export function CompareBody({
  a,
  b,
  labelA,
  labelB,
}: {
  a: Pick<VersionData, "caption" | "transcript" | "findings" | "preview" | "mediaUrl" | "kind">;
  b: Pick<VersionData, "caption" | "transcript" | "findings" | "preview" | "mediaUrl" | "kind">;
  labelA: string;
  labelB: string;
}) {
  const { t } = useI18n();
  const ga = groupFindings(a.findings);
  const gb = groupFindings(b.findings);
  const diff = diffGroups(a.findings, b.findings);
  const count = (g: FindingGroup[], s: "violation" | "warning") =>
    g.filter((x) => x.severity === s).length;
  return (
    <>
      <Card className="grid gap-3 sm:grid-cols-2" data-testid="compare-summary">
        {[
          { label: labelA, g: ga },
          { label: labelB, g: gb },
        ].map((x, i) => (
          <div key={i} className="rounded-md bg-sunken p-3">
            <p className="font-bold">{x.label}</p>
            <p className="mt-1 flex flex-wrap gap-2 text-sm">
              <StatusChip tone={count(x.g, "violation") ? "violation" : "ready"} size="sm">
                {t("compare2.violations", { n: count(x.g, "violation") })}
              </StatusChip>
              <StatusChip tone={count(x.g, "warning") ? "warning" : "ready"} size="sm">
                {t("compare2.warnings", { n: count(x.g, "warning") })}
              </StatusChip>
            </p>
          </div>
        ))}
        <p className="text-sm sm:col-span-2">
          {t("compare2.summaryLine", {
            gone: diff.noLongerDetected.length,
            kept: diff.persistent.length,
            added: diff.added.length,
          })}
        </p>
        <p className="text-xs text-fg-muted sm:col-span-2">{t("compare2.notResolution")}</p>
      </Card>

      {(a.mediaUrl || b.mediaUrl || a.preview || b.preview) && (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { d: a, label: labelA },
            { d: b, label: labelB },
          ].map(({ d, label }, i) => (
            <Card key={i} className="flex flex-col gap-2">
              <CardTitle>{label}</CardTitle>
              {d.mediaUrl && d.kind === "video" ? (
                <video
                  src={d.mediaUrl}
                  controls
                  preload="metadata"
                  className="aspect-[9/16] max-h-[60vh] w-full rounded-md bg-black object-contain"
                />
              ) : d.mediaUrl || d.preview ? (
                <img
                  src={d.mediaUrl ?? d.preview!}
                  alt={label}
                  className="max-h-[60vh] w-full rounded-md object-contain"
                />
              ) : (
                <p className="text-sm text-fg-muted">{t("compare.noPreview")}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <TextCompare
        title={t("compare.textTitle")}
        a={a.caption}
        b={b.caption}
        labelA={labelA}
        labelB={labelB}
      />
      {(a.transcript || b.transcript) && (
        <TextCompare
          title={t("compare.transcriptTitle")}
          a={a.transcript}
          b={b.transcript}
          labelA={labelA}
          labelB={labelB}
        />
      )}

      <Card className="flex flex-col gap-4" data-testid="findings-diff">
        <CardTitle>{t("compare.findingsTitle")}</CardTitle>
        <GroupList
          title={t("compare2.noLongerDetected", { n: diff.noLongerDetected.length })}
          groups={diff.noLongerDetected}
          tone="ready"
        />
        <GroupList
          title={t("compare2.persistent", { n: diff.persistent.length })}
          groups={diff.persistent.map((x) => x.after)}
          tone="warning"
        />
        <GroupList
          title={t("compare2.added", { n: diff.added.length })}
          groups={diff.added}
          tone="violation"
        />
      </Card>
    </>
  );
}

function TextCompare({
  title,
  a,
  b,
  labelA,
  labelB,
}: {
  title: string;
  a: string;
  b: string;
  labelA: string;
  labelB: string;
}) {
  const { t } = useI18n();
  const d = sentenceDiff(a, b);
  if (!a && !b) return null;
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{title}</CardTitle>
      <div className="grid gap-4 md:grid-cols-2" data-testid="text-diff">
        <Side label={labelA} ops={d.before} />
        <Side label={labelB} ops={d.after} />
      </div>
      <p className="flex flex-wrap gap-3 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <Minus aria-hidden="true" className="size-3" /> {t("compare2.legendRemoved")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Plus aria-hidden="true" className="size-3" /> {t("compare2.legendAdded")}
        </span>
      </p>
    </Card>
  );
}

function Side({ label, ops }: { label: string; ops: SentenceOp[] }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-fg-muted">{label}</p>
      {ops.length === 0 ? (
        <p className="text-sm text-fg-muted">{t("compare.noText")}</p>
      ) : (
        ops.map((o, i) => (
          <p
            key={i}
            dir="auto"
            className={cn(
              "flex items-start gap-2 rounded-md px-2 py-1 text-sm leading-relaxed",
              o.op === "removed" && "bg-red-bg/70",
              o.op === "added" && "bg-green-bg/70",
            )}
          >
            {o.op !== "same" && (
              <span className="mt-0.5 shrink-0 rounded-sm border border-current px-1 text-[11px] font-bold">
                {o.op === "removed" ? t("compare2.removedTag") : t("compare2.addedTag")}
              </span>
            )}
            {o.op === "removed" ? (
              <del className="decoration-1">{o.text}</del>
            ) : o.op === "added" ? (
              <ins className="no-underline">{o.text}</ins>
            ) : (
              <span>{o.text}</span>
            )}
          </p>
        ))
      )}
    </div>
  );
}

function GroupList({
  title,
  groups,
  tone,
}: {
  title: string;
  groups: FindingGroup[];
  tone: "ready" | "warning" | "violation";
}) {
  const { t, lang } = useI18n();
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <StatusChip tone={tone} size="sm">
          {groups.length}
        </StatusChip>
        {title}
      </h3>
      {groups.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {groups.map((g) => {
            const f = g.members[0]!;
            return (
              <li key={g.key} className="rounded-md border border-border p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge mono>{g.ruleCode}</Badge>
                  <span className="font-medium">
                    {(lang === "en" ? f.explanation_en : f.explanation_ar) ||
                      f.explanation_ar ||
                      g.ruleCode}
                  </span>
                </p>
                <ul className="mt-1.5 flex flex-col gap-1 text-fg-muted">
                  {g.members.slice(0, 4).map((m) => (
                    <li key={m.id} dir="auto">
                      {t(`ws.source.${m.evidence_type}` as never)}
                      {m.t_start != null && m.t_start !== ""
                        ? ` · ${formatClock(Number(m.t_start))}`
                        : ""}
                      : «{m.evidence_text}»
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
