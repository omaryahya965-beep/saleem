import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronLeft, FileDown, FolderPlus, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Page,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  StatusChip,
  Switch,
  toast,
} from "@/components/ui";
import { statusOf } from "@/features/submissions/DashboardPage";
import { useUsage } from "@/features/settings/UsageMeter";
import { formatClock, useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import {
  CATEGORIES,
  PLATFORMS,
  createSubmission,
  type Platform,
  type ProductCategory,
} from "@/lib/api/data";
import { createBatch, downloadFile, errorCode, fetchBatch, fetchBatches } from "@/lib/api/features";
import { useProfile } from "@/lib/api/hooks";
import { inspectMedia, type InspectedMedia } from "@/lib/media";

type Item = {
  file: File;
  media: InspectedMedia | null;
  error: string | null;
  state: "ready" | "uploading" | "done" | "failed";
};

/** /archive — list of past-clip audits + create a new one (up to the plan's batch size). */
export function ArchivePage() {
  const { t, tn, formatDate, formatBytes } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const usage = useUsage();
  const profile = useProfile(user?.id);
  const batches = useQuery({ queryKey: ["batches"], queryFn: fetchBatches });
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [platform, setPlatform] = useState<Platform>("snapchat");
  const [category, setCategory] = useState<ProductCategory>("other");
  const [isPaidAd, setIsPaidAd] = useState(true);
  const [hasContract, setHasContract] = useState(false);
  const maxBatch = usage.data?.max_batch ?? 20;

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = [...files].slice(0, Math.max(0, maxBatch - items.length));
    const inspected = await Promise.all(
      list.map(async (file): Promise<Item> => {
        const res = await inspectMedia(file, "video");
        return res.ok
          ? { file, media: res.media, error: null, state: "ready" }
          : {
              file,
              media: null,
              error:
                res.error.code === "duration"
                  ? t("dropzone.errorDuration", { duration: formatClock(res.error.seconds) })
                  : res.error.code === "size"
                    ? t("dropzone.errorSize", { size: formatBytes(res.error.bytes) })
                    : t("dropzone.errorType"),
              state: "failed",
            };
      }),
    );
    setItems((xs) => [...xs, ...inspected]);
  };

  const run = useMutation({
    mutationFn: async () => {
      const batch = await createBatch(
        name.trim() || t("archive.defaultName", { date: formatDate(new Date()) }),
      );
      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        if (!it.media) continue;
        setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: "uploading" } : x)));
        try {
          const poster = it.media.previewUrl
            ? await fetch(it.media.previewUrl).then((r) => r.blob())
            : null;
          await createSubmission({
            userId: user!.id,
            kind: "video",
            file: it.file,
            poster,
            durationSeconds: it.media.duration,
            textContent: "",
            caption: "",
            title: it.file.name.replace(/\.[^.]+$/, ""),
            platform,
            productCategory: category,
            isPaidAd,
            hasWrittenContract: hasContract,
            aiUsed: false,
            licenseNo: profile.data?.mawthooq_license_no ?? "",
            parentId: null,
            batchId: batch.id,
          });
          setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: "done" } : x)));
        } catch (e) {
          const code = errorCode(e);
          setItems((xs) =>
            xs.map((x, j) =>
              j === i
                ? {
                    ...x,
                    state: "failed",
                    error: t(`quota.${code}` as never) || t("errors.generic"),
                  }
                : x,
            ),
          );
          if (code === "quota_exceeded") break;
        }
      }
      return batch.id;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["batches"] });
      void qc.invalidateQueries({ queryKey: ["usage"] });
      void navigate({ to: "/archive/$id", params: { id } });
    },
    onError: () => toast.error(t("errors.generic")),
  });

  const valid = items.filter((i) => i.media).length;
  const done = items.filter((i) => i.state === "done").length;

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("archive.title")} description={t("archive.subtitle")} />

      <Card className="flex flex-col gap-5">
        <CardTitle>{t("archive.newTitle")}</CardTitle>
        <Field label={t("archive.name")} optional optionalLabel={t("common.optional")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("archive.namePlaceholder")}
            dir="auto"
          />
        </Field>
        <div className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            multiple
            className="sr-only"
            onChange={(e) => void addFiles(e.target.files)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              icon={<Upload />}
              onClick={() => inputRef.current?.click()}
              disabled={items.length >= maxBatch || run.isPending}
            >
              {t("archive.addClips")}
            </Button>
            <span className="tabular text-sm text-fg-muted">
              {t("archive.count", { n: items.length, max: maxBatch })}
            </span>
          </div>
          {items.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span dir="auto" className="min-w-0 flex-1 truncate">
                    {it.file.name}
                  </span>
                  {it.media?.duration != null && (
                    <span className="tabular text-fg-muted">{formatClock(it.media.duration)}</span>
                  )}
                  {it.error ? (
                    <span className="text-red">{it.error}</span>
                  ) : (
                    <StatusChip
                      size="sm"
                      tone={
                        it.state === "done"
                          ? "ready"
                          : it.state === "uploading"
                            ? "processing"
                            : "neutral"
                      }
                    >
                      {t(`archive.state.${it.state}` as never)}
                    </StatusChip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
            label={t("archive.allPaid")}
            hint={t("archive.allPaidHint")}
          />
          <Switch
            checked={hasContract}
            onCheckedChange={setHasContract}
            label={t("newCheck.contract")}
            disabled={!isPaidAd}
          />
        </div>
        {run.isPending && (
          <ProgressBar value={(done / Math.max(1, valid)) * 100} label={t("archive.progress")} />
        )}
        <div>
          <Button
            icon={<Archive />}
            disabled={!valid}
            loading={run.isPending}
            onClick={() => run.mutate()}
          >
            {t("archive.start", { n: valid })}
          </Button>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t("archive.history")}</h2>
        {batches.isError ? (
          <ErrorState
            title={t("archive.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void batches.refetch()}
          />
        ) : batches.isPending ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : batches.data.length === 0 ? (
          <EmptyState
            icon={<FolderPlus />}
            title={t("archive.emptyTitle")}
            body={t("archive.emptyBody")}
          />
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {batches.data.map((b) => {
                const flagged = b.submissions.filter(
                  (s) => s.overall_status === "needs_fixes",
                ).length;
                return (
                  <li key={b.id}>
                    <Link
                      to="/archive/$id"
                      params={{ id: b.id }}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-sunken"
                    >
                      <span className="min-w-0 flex-1">
                        <span dir="auto" className="block truncate font-medium">
                          {b.name}
                        </span>
                        <span className="text-sm text-fg-muted">
                          {formatDate(b.created_at)} · {tn("count.checks", b.submissions.length)}
                        </span>
                      </span>
                      {flagged > 0 ? (
                        <StatusChip tone="violation" size="sm">
                          {t("archive.flaggedShort", { n: flagged })}
                        </StatusChip>
                      ) : (
                        <StatusChip tone="ready" size="sm">
                          {t("archive.clean")}
                        </StatusChip>
                      )}
                      <ChevronLeft
                        aria-hidden="true"
                        className="size-5 text-fg-muted ltr:rotate-180"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </Page>
  );
}

/** /archive/$id — summary («3 مقاطع قد تؤثر على تجديد رخصة موثوق»), per-clip reports, CSV. */
export function ArchiveBatchPage({ id }: { id: string }) {
  const { t, tn, lang, formatDate } = useI18n();
  const q = useQuery({
    queryKey: ["batch", id],
    queryFn: () => fetchBatch(id),
    refetchInterval: (s) =>
      s.state.data?.items.some((i) => !["done", "failed"].includes(i.status)) ? 4000 : false,
  });

  const rows = useMemo(() => {
    return (q.data?.items ?? []).map((s) => {
      const latest = [...s.analysis_runs].sort((a, b) =>
        b.started_at.localeCompare(a.started_at),
      )[0];
      const fs = s.findings.filter((f) => f.run_id === latest?.id);
      return {
        s,
        violations: fs.filter((f) => f.severity === "violation").length,
        warnings: fs.filter((f) => f.severity === "warning").length,
        rules: [...new Set(fs.map((f) => f.rule_code))].sort(),
      };
    });
  }, [q.data]);

  if (q.isPending)
    return (
      <Page>
        <Skeleton className="h-48 w-full rounded-lg" />
      </Page>
    );
  if (q.isError)
    return (
      <Page narrow>
        <ErrorState
          title={t("archive.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void q.refetch()}
        />
      </Page>
    );

  const flagged = rows.filter((r) => r.s.overall_status === "needs_fixes").length;
  const pending = rows.filter((r) => !["done", "failed"].includes(r.s.status)).length;
  const mawthooq = rows.filter(
    (r) => r.rules.some((c) => c.startsWith("MAW-")) && r.violations > 0,
  ).length;

  const exportCsv = () => {
    const header = [
      "title",
      "platform",
      "created_at",
      "status",
      "violations",
      "warnings",
      "rules",
      "report_url",
    ];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [
        r.s.title ?? "",
        r.s.platform,
        r.s.created_at,
        r.s.status === "done" ? (r.s.overall_status ?? "") : r.s.status,
        r.violations,
        r.warnings,
        r.rules.join(" "),
        `${window.location.origin}/checks/${r.s.id}`,
      ]
        .map(esc)
        .join(","),
    );
    downloadFile(
      `saleem-archive-${id.slice(0, 8)}.csv`,
      "﻿" + [header.join(","), ...lines].join("\r\n"),
      "text/csv;charset=utf-8",
    );
  };

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <Link to="/archive" className="text-sm text-green hover:underline">
            {t("archive.title")}
          </Link>
        }
        title={q.data.batch.name}
        description={`${formatDate(q.data.batch.created_at)} · ${tn("count.checks", rows.length)}`}
        actions={
          <Button variant="secondary" icon={<FileDown />} onClick={exportCsv}>
            {t("archive.csv")}
          </Button>
        }
      />
      <Card className={flagged ? "border-red/20 bg-red-bg" : "border-green/20 bg-green-bg"}>
        <p className="text-2xl font-bold">
          {flagged
            ? t("archive.summaryFlagged", { clips: tn("count.checks", flagged) })
            : t("archive.summaryClean")}
        </p>
        <p className="mt-1 text-fg-muted">
          {mawthooq > 0 && (
            <>{t("archive.mawthooqNote", { clips: tn("count.checks", mawthooq) })} </>
          )}
          {pending > 0 && t("archive.pending", { n: pending })}
        </p>
      </Card>
      <Card padded={false}>
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const st = statusOf(r.s);
            return (
              <li key={r.s.id}>
                <Link
                  to="/checks/$id"
                  params={{ id: r.s.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-sunken"
                >
                  <span dir="auto" className="min-w-0 flex-1 truncate font-medium">
                    {r.s.title}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {r.rules.map((c) => (
                      <Badge key={c} mono>
                        {c}
                      </Badge>
                    ))}
                  </span>
                  <StatusChip tone={st.tone} size="sm">
                    {t(st.key)}
                  </StatusChip>
                  <ChevronLeft aria-hidden="true" className="size-5 text-fg-muted ltr:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="text-sm text-fg-muted">{t("brand.disclaimer")}</p>
    </Page>
  );
}
