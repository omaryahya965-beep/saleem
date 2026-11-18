import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, CardTitle, Field, Select, Skeleton } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { versionPreview } from "@/lib/api/comments";
import type { VersionSummary } from "@/lib/api/promotions";
import { findingsDiff, wordDiff, type DiffFinding } from "./model";

interface VersionData {
  text: string;
  transcript: string;
  findings: DiffFinding[];
  preview: string | null;
}

async function loadVersion(id: string): Promise<VersionData> {
  const [{ data: s }, { data: tr }, { data: run }, preview] = await Promise.all([
    supabase.from("submissions").select("caption, text_content").eq("id", id).maybeSingle(),
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
        .select("id, rule_code, finding_type, carried_from_finding_id, resolved_in_submission_id")
        .eq("run_id", run.id)
    : { data: [] };
  return {
    text: [s?.caption ?? "", s?.text_content ?? ""].filter(Boolean).join("\n"),
    transcript: tr?.full_text ?? "",
    findings: (findings ?? []) as DiffFinding[],
    preview,
  };
}

function Diff({ a, b }: { a: string; b: string }) {
  const { t } = useI18n();
  if (!a && !b) return <p className="text-sm text-fg-muted">{t("compare.noText")}</p>;
  return (
    <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed" data-testid="text-diff">
      {wordDiff(a, b).map((d, i) =>
        d.op === "same" ? (
          <span key={i}>{d.text}</span>
        ) : d.op === "added" ? (
          <ins key={i} className="bg-green-bg text-green no-underline">
            {d.text}
          </ins>
        ) : (
          <del key={i} className="bg-red-bg text-red">
            {d.text}
          </del>
        ),
      )}
    </p>
  );
}

/** Compare tab (05_UX_SPEC §2.5): two versions side by side, text and findings differences. */
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
  const label = (v: VersionSummary) => t("promo.version", { n: v.version_no ?? 0 });
  const diff = a.data && b.data ? findingsDiff(a.data.findings, b.data.findings, bId) : null;
  return (
    <div className="flex flex-col gap-4" data-testid="compare-tab">
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
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : (
        <>
          {(a.data.preview || b.data.preview) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[a.data, b.data].map((d, i) => (
                <Card key={i} className="flex items-center justify-center">
                  {d.preview ? (
                    <img
                      src={d.preview}
                      alt={t("comments.previewAlt")}
                      className="max-h-72 w-auto rounded-md"
                    />
                  ) : (
                    <span className="text-sm text-fg-muted">{t("compare.noPreview")}</span>
                  )}
                </Card>
              ))}
            </div>
          )}
          <Card className="flex flex-col gap-2">
            <CardTitle>{t("compare.textTitle")}</CardTitle>
            <Diff a={a.data.text} b={b.data.text} />
          </Card>
          {(a.data.transcript || b.data.transcript) && (
            <Card className="flex flex-col gap-2">
              <CardTitle>{t("compare.transcriptTitle")}</CardTitle>
              <Diff a={a.data.transcript} b={b.data.transcript} />
            </Card>
          )}
          {diff && (
            <Card className="flex flex-col gap-3" data-testid="findings-diff">
              <CardTitle>{t("compare.findingsTitle")}</CardTitle>
              {(["fixed", "remaining", "added"] as const).map((k) => (
                <div key={k}>
                  <p className="text-sm font-bold">
                    {t(`compare.${k}` as TKey, { n: diff[k].length })}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-2">
                    {diff[k].map((f) => (
                      <Badge key={f.id} mono>
                        {f.rule_code}
                        {f.finding_type ? ` · ${t(`findingType.${f.finding_type}` as TKey)}` : ""}
                      </Badge>
                    ))}
                  </p>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
