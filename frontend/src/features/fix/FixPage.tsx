// SALEEM Fix — الإصلاح الذكي (V2 upgrade §29, D178). Three methods: manual revision (existing upload), AI-assisted
// text correction (implemented: plan + corrected caption/script, reviewed and edited before acceptance), and
// replacement / media generation (provider not configured — shown honestly, never simulated).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Clapperboard,
  FileText,
  Sparkles,
  Upload,
  Wand2,
  Film,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  EmptyState,
  Field,
  Page,
  Skeleton,
  StatusChip,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { useReport } from "@/lib/api/hooks";
import { usePromotion, pk } from "@/lib/api/promotions";
import { supabase } from "@/lib/supabase";
import {
  acceptJob,
  cancelJob,
  canFix,
  createJob,
  estimateJob,
  fixKeys,
  generateJob,
  useJobs,
  type CorrectionJob,
  type FixProposal,
} from "@/lib/api/fix";
import { groupFindings } from "@/features/reports/grouping";
import { usePreflightText } from "@/features/review/model";
import { cn } from "@/lib/utils";
import { MediaEditor, type RenderedMedia } from "./MediaEditor";

const PREFS = [
  "keep_product",
  "keep_brand",
  "keep_concept",
  "keep_duration",
  "keep_aspect_ratio",
  "keep_language",
] as const;

export function FixPage({ id }: { id: string }) {
  const { t } = useI18n();
  const promo = usePromotion(id);
  const can = useQuery({ queryKey: fixKeys.can(id), queryFn: () => canFix(id) });
  const jobs = useJobs(id);
  const p = promo.data?.promotion;
  const current = p?.current_version_id ?? null;
  const report = useReport(current ?? "", Boolean(current));
  const [method, setMethod] = useState<"text" | null>(null);
  const qcPage = useQueryClient();
  const errPage = usePreflightText();
  const [mediaKey] = useState(() => crypto.randomUUID());
  const mediaJob = useMutation({
    mutationFn: () =>
      createJob(id, {
        findings: (report.data?.findings ?? []).map((f) => f.id),
        preferences: { media_only: true },
        instructions: "",
        key: mediaKey,
        method: "media_edit",
      }),
    onSuccess: () => void qcPage.invalidateQueries({ queryKey: fixKeys.jobs(id) }),
    onError: (e) => toast.error(errPage(e)),
  });

  if (promo.isPending || can.isPending || jobs.isPending)
    return (
      <Page>
        <Skeleton className="h-40 w-full rounded-lg" />
      </Page>
    );
  if (!p) return null;
  const active = (jobs.data ?? []).find(
    (j) =>
      ["draft", "generating", "ready", "accepting", "failed"].includes(j.status) &&
      j.source_submission_id === current,
  );
  const back = (
    <Link
      to="/promotions/$id"
      params={{ id }}
      className="inline-flex items-center gap-1 text-sm text-fg-muted underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
      {p.title}
    </Link>
  );

  return (
    <Page wide className="flex flex-col gap-5">
      {back}
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Sparkles aria-hidden="true" className="size-7 text-green" />
          {t("fix.title")}
        </h1>
        <p className="mt-1 max-w-3xl text-fg-muted">{t("fix.subtitle")}</p>
      </header>
      {!can.data?.ok && !active && (
        <div
          role="status"
          className="rounded-md border border-amber/30 bg-amber-bg px-4 py-3 text-sm"
        >
          <p className="font-bold text-amber-text">{t("fix.unavailable")}</p>
          <ul className="mt-1 list-inside list-disc">
            {(can.data?.reasons ?? []).map((r) => (
              <li key={r}>{t(`fix.reason.${r}` as TKey)}</li>
            ))}
          </ul>
        </div>
      )}
      {active ? (
        <JobView job={active} promotionId={id} report={report.data ?? null} />
      ) : method === "text" && report.data ? (
        <Setup promotionId={id} report={report.data} onBack={() => setMethod(null)} />
      ) : (
        <Methods
          promotionId={id}
          enabled={Boolean(can.data?.ok)}
          onText={() => setMethod("text")}
          mediaEnabled={
            Boolean(can.data?.ok) &&
            report.data?.submission.kind === "video" &&
            Boolean(report.data?.mediaUrl)
          }
          onMedia={() => mediaJob.mutate()}
          mediaBusy={mediaJob.isPending}
        />
      )}
      <p className="text-xs text-fg-muted">{t("fix.disclaimer")}</p>
    </Page>
  );
}

function Methods({
  promotionId,
  enabled,
  onText,
  mediaEnabled,
  onMedia,
  mediaBusy,
}: {
  promotionId: string;
  enabled: boolean;
  onText: () => void;
  mediaEnabled: boolean;
  onMedia: () => void;
  mediaBusy: boolean;
}) {
  const { t } = useI18n();
  const cards = [
    {
      key: "manual",
      icon: <Upload aria-hidden="true" />,
      action: (
        <Button asChild variant="secondary">
          <Link to="/new" search={{ promotion: promotionId }}>
            {t("fix.method.manual.cta")}
          </Link>
        </Button>
      ),
      status: (
        <StatusChip tone="ready" size="sm">
          {t("fix.available")}
        </StatusChip>
      ),
    },
    {
      key: "text",
      icon: <Wand2 aria-hidden="true" />,
      action: (
        <Button disabled={!enabled} onClick={onText}>
          {t("fix.method.text.cta")}
        </Button>
      ),
      status: (
        <StatusChip tone="ready" size="sm">
          {t("fix.available")}
        </StatusChip>
      ),
    },
    {
      key: "media",
      icon: <Film aria-hidden="true" />,
      action: (
        <Button
          disabled={!mediaEnabled}
          loading={mediaBusy}
          onClick={onMedia}
          data-testid="fix-media-start"
        >
          {t("fix.method.media.cta")}
        </Button>
      ),
      status: (
        <StatusChip tone="ready" size="sm">
          {t("fix.available")}
        </StatusChip>
      ),
    },
    {
      key: "replacement",
      icon: <Clapperboard aria-hidden="true" />,
      // D207: a replacement ad is built in SALEEM AI Studio (template rendering of the product's own assets) and
      // saved as a new version of this advertisement. Generated footage still needs a video provider.
      action: enabled ? (
        <Button asChild variant="secondary">
          <Link to="/studio" search={{ from: promotionId }} data-testid="fix-replacement-start">
            {t("fix.method.replacement.cta")}
          </Link>
        </Button>
      ) : (
        <Button disabled variant="secondary">
          {t("fix.method.replacement.cta")}
        </Button>
      ),
      status: (
        <StatusChip tone="ready" size="sm">
          {t("fix.available")}
        </StatusChip>
      ),
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="fix-methods">
      {cards.map((c) => (
        <Card key={c.key} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 [&>svg]:size-6">
            {c.icon}
            {c.status}
          </div>
          <CardTitle>{t(`fix.method.${c.key}.title` as TKey)}</CardTitle>
          <p className="flex-1 text-sm text-fg-muted">{t(`fix.method.${c.key}.body` as TKey)}</p>
          {c.action}
        </Card>
      ))}
    </div>
  );
}

type Bundle = NonNullable<ReturnType<typeof useReport>["data"]>;

function Setup({
  promotionId,
  report,
  onBack,
}: {
  promotionId: string;
  report: Bundle;
  onBack: () => void;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const groups = useMemo(() => groupFindings(report.findings), [report.findings]);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(groups.filter((g) => g.severity === "violation").map((g) => g.key)),
  );
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(PREFS.map((x) => [x, true])),
  );
  const [instructions, setInstructions] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const create = useMutation({
    mutationFn: () =>
      createJob(promotionId, {
        findings: groups
          .filter((g) => picked.has(g.key))
          .flatMap((g) => g.members.map((m) => m.id)),
        preferences: prefs,
        instructions,
        key,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fixKeys.jobs(promotionId) }),
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Card className="flex flex-col gap-3">
        <CardTitle>{t("fix.setup.findings")}</CardTitle>
        <p className="text-sm text-fg-muted">{t("fix.setup.findingsHint")}</p>
        <ul className="flex flex-col gap-2">
          {groups.map((g) => {
            const f = g.members[0]!;
            return (
              <li key={g.key} className="rounded-md border border-border p-3">
                <Checkbox
                  checked={picked.has(g.key)}
                  onChange={(e) =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(g.key);
                      else n.delete(g.key);
                      return n;
                    })
                  }
                  label={`${g.ruleCode} · ${(lang === "en" ? f.explanation_en : f.explanation_ar) || f.explanation_ar || ""}`}
                />
                <p className="ms-7 mt-1 text-xs text-fg-muted" dir="auto">
                  {t("fix.setup.evidenceCount", { n: g.members.length })} · «
                  {f.evidence_text?.slice(0, 120)}»
                </p>
              </li>
            );
          })}
        </ul>
      </Card>
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("fix.setup.preferences")}</CardTitle>
          {PREFS.map((k) => (
            <Checkbox
              key={k}
              label={t(`fix.pref.${k}` as TKey)}
              checked={prefs[k]}
              onChange={(e) => setPrefs((x) => ({ ...x, [k]: e.target.checked }))}
            />
          ))}
          <p className="text-xs text-fg-muted">{t("fix.setup.voiceNote")}</p>
        </Card>
        <Card className="flex flex-col gap-3">
          <Field
            label={t("fix.setup.instructions")}
            optional
            optionalLabel={t("common.optional")}
            hint={t("fix.setup.instructionsHint")}
          >
            <Textarea
              rows={4}
              value={instructions}
              maxLength={3000}
              onChange={(e) => setInstructions(e.target.value)}
              dir="auto"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<Wand2 />}
              disabled={picked.size === 0}
              loading={create.isPending}
              onClick={() => create.mutate()}
            >
              {t("fix.setup.next")}
            </Button>
            <Button variant="ghost" onClick={onBack}>
              {t("common.back")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function JobView({
  job,
  promotionId,
  report,
}: {
  job: CorrectionJob;
  promotionId: string;
  report: Bundle | null;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: fixKeys.jobs(promotionId) });
    void qc.invalidateQueries({ queryKey: fixKeys.can(promotionId) });
  };
  const est = useQuery({
    queryKey: fixKeys.estimate(job.id),
    queryFn: () => estimateJob(job.id),
    enabled: job.status === "draft" || job.status === "failed",
  });
  const gen = useMutation({
    mutationFn: () => generateJob(job.id),
    onSettled: refresh,
    onError: (e) =>
      toast.error(
        t(`fix.error.${(e as Error).message.replace(/^code:/, "")}` as TKey) || errText(e),
      ),
  });
  const cancel = useMutation({ mutationFn: () => cancelJob(job.id), onSuccess: refresh });

  if (job.status === "generating")
    return (
      <Card className="flex flex-col gap-2" role="status">
        <p className="font-bold">{t("fix.generating")}</p>
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  if (job.status === "ready" || job.status === "accepting")
    return (
      <Review
        job={job}
        promotionId={promotionId}
        report={report}
        onCancel={() => cancel.mutate()}
      />
    );

  const e = est.data;
  return (
    <Card className="flex flex-col gap-4" data-testid="fix-confirm">
      <CardTitle>{t("fix.confirm.title")}</CardTitle>
      {job.status === "failed" && job.error_code && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-md bg-red-bg px-3 py-2 text-sm text-red"
        >
          <AlertTriangle aria-hidden="true" className="size-4" />
          {t(`fix.error.${job.error_code}` as TKey)}
        </p>
      )}
      {est.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : e ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-md bg-sunken p-3">
            <dt className="text-xs text-fg-muted">{t("fix.confirm.model")}</dt>
            <dd className="font-bold" dir="ltr">
              {e.estimate.model}
            </dd>
          </div>
          <div className="rounded-md bg-sunken p-3">
            <dt className="text-xs text-fg-muted">{t("fix.confirm.tokens")}</dt>
            <dd className="tabular font-bold">
              ≈ {e.estimate.inputTokens + e.estimate.outputTokens}
            </dd>
          </div>
          <div className="rounded-md bg-sunken p-3">
            <dt className="text-xs text-fg-muted">{t("fix.confirm.cost")}</dt>
            <dd className="tabular font-bold">
              {e.estimate.usd == null
                ? t("fix.confirm.costUnknown")
                : `≈ $${e.estimate.usd.toFixed(4)}`}
            </dd>
          </div>
          <div className="rounded-md bg-sunken p-3">
            <dt className="text-xs text-fg-muted">{t("fix.confirm.quota")}</dt>
            <dd className="tabular font-bold">
              {e.quota
                ? t("fix.confirm.quotaValue", {
                    remaining: e.quota.remaining,
                    limit: e.quota.limit,
                  })
                : "—"}
            </dd>
          </div>
        </dl>
      ) : null}
      {e && !e.text_provider_configured && (
        <p
          role="status"
          className="rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm"
        >
          {t("fix.confirm.notConfigured")}
        </p>
      )}
      <p className="text-sm text-fg-muted">{t("fix.confirm.body")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          icon={<Sparkles />}
          loading={gen.isPending}
          disabled={!e?.text_provider_configured || job.attempts >= 3 || gen.isPending}
          onClick={() => gen.mutate()}
        >
          {job.status === "failed"
            ? t("fix.confirm.retry", { n: 3 - job.attempts })
            : t("fix.confirm.generate")}
        </Button>
        <Button variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate()}>
          {t("fix.cancel")}
        </Button>
      </div>
    </Card>
  );
}

function Review({
  job,
  promotionId,
  report,
  onCancel,
}: {
  job: CorrectionJob;
  promotionId: string;
  report: Bundle | null;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const errText = usePreflightText();
  const proposal = job.edited_proposal ?? job.proposal!;
  const [caption, setCaption] = useState(proposal.caption);
  const [script, setScript] = useState(proposal.script);
  const original = report?.submission;
  const originalScript =
    (report?.transcript ?? []).map((s) => s.text).join(" ") || original?.text_content || "";
  const [media, setMedia] = useState<RenderedMedia | null>(null);
  const canEditMedia = original?.kind === "video" && Boolean(report?.mediaUrl);
  const accept = useMutation({
    mutationFn: async () => {
      const { data: src } = await supabase
        .from("submissions")
        .select(
          "platform, product_category, is_paid_ad, has_written_contract, mawthooq_license_no, title, org_id, campaign_id",
        )
        .eq("id", job.source_submission_id)
        .single();
      const edited: FixProposal = { ...proposal, caption, script };
      return acceptJob(
        job,
        edited,
        {
          userId: user!.id,
          title: src?.title ?? "",
          platform: src!.platform,
          productCategory: src!.product_category,
          isPaidAd: Boolean(src?.is_paid_ad),
          hasWrittenContract: Boolean(src?.has_written_contract),
          aiUsed: true,
          licenseNo: src?.mawthooq_license_no ?? "",
          promotionId,
          orgId: src?.org_id ?? null,
          campaignId: null,
        },
        media,
      );
    },
    onSuccess: () => {
      toast.success(t("fix.review.acceptedToast"));
      void qc.invalidateQueries({ queryKey: pk.promotion(promotionId) });
      void qc.invalidateQueries({ queryKey: fixKeys.jobs(promotionId) });
      void navigate({ to: "/promotions/$id", params: { id: promotionId } });
    },
    onError: (e) => toast.error(errText(e)),
  });
  const plan = job.plan ?? [];
  const human = plan.filter((x) => x.human_evidence_required || !x.ai_can_fix);
  return (
    <div className="flex flex-col gap-5" data-testid="fix-review">
      <Card className="flex flex-col gap-3">
        <CardTitle>{t("fix.review.plan")}</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-start text-xs text-fg-muted">
              <tr>
                <th className="p-2 text-start">{t("fix.review.problem")}</th>
                <th className="p-2 text-start">{t("fix.review.correction")}</th>
                <th className="p-2 text-start">{t("fix.review.affected")}</th>
                <th className="p-2 text-start">{t("fix.review.needs")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {plan.map((x, i) => (
                <tr key={i} className="align-top">
                  <td className="p-2" dir="auto">
                    <p className="font-medium">{x.problem_ar}</p>
                    {x.evidence_ar && <p className="text-xs text-fg-muted">{x.evidence_ar}</p>}
                  </td>
                  <td className="p-2" dir="auto">
                    {x.correction_ar}
                  </td>
                  <td className="p-2 tabular" dir="auto">
                    {x.affected}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {x.ai_can_fix ? (
                        <Badge>{t("fix.review.aiCan")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("fix.review.humanNeeded")}</Badge>
                      )}
                      {x.media_edit_needed && (
                        <Badge variant="neutral">{t("fix.review.mediaEdit")}</Badge>
                      )}
                      {x.voiceover_needed && (
                        <Badge variant="neutral">{t("fix.review.voiceover")}</Badge>
                      )}
                      {x.human_evidence_required && (
                        <Badge variant="outline">{t("fix.review.evidence")}</Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {human.length > 0 && (
          <p
            role="note"
            className="rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm"
          >
            {t("fix.review.humanNote", { n: human.length })}
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileText aria-hidden="true" className="size-4" />
            {t("fix.review.original")}
          </CardTitle>
          <Field label={t("fix.review.caption")}>
            <p className="min-h-16 rounded-md bg-sunken p-3 text-sm whitespace-pre-wrap" dir="auto">
              {original?.caption || "—"}
            </p>
          </Field>
          <Field label={t("fix.review.script")}>
            <p className="min-h-24 rounded-md bg-sunken p-3 text-sm whitespace-pre-wrap" dir="auto">
              {originalScript || "—"}
            </p>
          </Field>
        </Card>
        <Card className="flex flex-col gap-3 border-green/40">
          <CardTitle className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-4 text-green" />
            {t("fix.review.proposed")}
          </CardTitle>
          <Field label={t("fix.review.caption")} hint={t("fix.review.editable")}>
            <Textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              dir="auto"
              disabled={job.status !== "ready"}
            />
          </Field>
          <Field label={t("fix.review.script")}>
            <Textarea
              rows={6}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              dir="auto"
              disabled={job.status !== "ready"}
            />
          </Field>
          {proposal.disclosures.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {proposal.disclosures.map((d) => (
                <Badge key={d} variant="outline">
                  {d}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>

      {proposal.changes.length > 0 && (
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("fix.review.changes")}</CardTitle>
          <ul className="flex flex-col gap-2 text-sm">
            {proposal.changes.map((c, i) => (
              <li key={i} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-3">
                <del className="text-red decoration-2" dir="auto">
                  <span className="sr-only">{t("fix.review.removed")}: </span>
                  {c.before}
                </del>
                <ins className="text-green no-underline" dir="auto">
                  <span className="sr-only">{t("fix.review.added")}: </span>
                  {c.after}
                </ins>
                <span className="text-fg-muted" dir="auto">
                  {c.reason_ar}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {proposal.limitations.length > 0 && (
        <Card className="flex flex-col gap-1 text-sm">
          <CardTitle>{t("fix.review.limitations")}</CardTitle>
          <ul className="list-inside list-disc">
            {proposal.limitations.map((l, i) => (
              <li key={i} dir="auto">
                {l}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canEditMedia && (
        <MediaEditor
          sourceUrl={report!.mediaUrl!}
          duration={
            Number(original?.duration_seconds) ||
            Math.max(1, ...(report?.transcript ?? []).map((s) => s.end))
          }
          findings={(report?.findings ?? []).filter(
            (f) => !job.selected_finding_ids.length || job.selected_finding_ids.includes(f.id),
          )}
          script={script}
          lang={/[\u0600-\u06FF]/.test(script) ? "ar" : "en"}
          onRendered={setMedia}
        />
      )}

      <Card className={cn("flex flex-col gap-3")}>
        <p className="text-sm">{media ? t("fix2.acceptVideo") : t("fix.review.acceptBody")}</p>
        <p className="text-xs text-fg-muted">
          {t("fix.review.meta", {
            model: job.model ?? "—",
            cost:
              job.usage?.cost_usd != null
                ? `$${Number(job.usage.cost_usd).toFixed(4)}`
                : t("fix.confirm.costUnknown"),
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            loading={accept.isPending}
            disabled={job.status !== "ready" || !(caption.trim() || script.trim())}
            onClick={() => accept.mutate()}
          >
            {media ? t("fix2.acceptVideoCta") : t("fix.review.accept")}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {t("fix.review.discard")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function FixNotFound() {
  const { t } = useI18n();
  return <EmptyState icon={<Sparkles />} title={t("fix.title")} body={t("fix.unavailable")} />;
}
