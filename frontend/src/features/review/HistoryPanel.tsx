// History — chronological audit timeline (V2 completion §8, D192). Every recorded review event and decision, with
// actor name and role (the role recorded on decisions; otherwise the current role, labelled so), version, workflow
// transition, reasons, conditions, evidence and the decision hash. Filters by category; details expand. Identical
// consecutive events collapse visually (×n) — nothing is removed from the audit record. Missing actors stay
// «غير مسجّل»: nothing is invented.
import { useMutation, useQuery } from "@tanstack/react-query";
import { useErrorText } from "@/components/feedback/ApiErrorState";
import {
  ArrowLeftRight,
  BadgeCheck,
  ChevronDown,
  FileUp,
  Gavel,
  ListChecks,
  MessageSquareReply,
  Scale,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, CardTitle, Skeleton } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";
import {
  fetchHistory,
  fetchReasons,
  rk,
  verifyChain,
  type ReviewDecision,
  type ReviewEvent,
} from "@/lib/api/review";
import { shortHash } from "@/features/reports/model";
import { cn } from "@/lib/utils";
import { bothCalendars } from "./model";

export type HistoryCategory =
  | "all"
  | "versions"
  | "workflow"
  | "decisions"
  | "conditions"
  | "legal"
  | "risk"
  | "responses"
  | "lifecycle";

const CATEGORY_OF: Record<string, Exclude<HistoryCategory, "all">> = {
  created: "versions",
  version_added: "versions",
  analysis_done: "versions",
  analysis_failed: "versions",
  correction_started: "versions",
  correction_accepted: "versions",
  variation_created: "versions",
  partner_created: "versions",
  submitted: "workflow",
  opened: "workflow",
  assigned: "workflow",
  unassigned: "workflow",
  flow_started: "workflow",
  step_decided: "decisions",
  flow_replaced: "workflow",
  license_checked: "workflow",
  decided: "decisions",
  self_approved: "decisions",
  rereviewed: "decisions",
  conditions_submitted: "conditions",
  condition_verified: "conditions",
  condition_more_evidence: "conditions",
  condition_rejected: "conditions",
  escalated: "legal",
  legal_responded: "legal",
  risk_requested: "risk",
  risk_accepted: "risk",
  risk_declined: "risk",
  responses: "responses",
  archived: "lifecycle",
  withdrawn: "lifecycle",
  withdrawal_requested: "lifecycle",
  lifecycle_published: "lifecycle",
  lifecycle_taken_down: "lifecycle",
  lifecycle_evergreen: "lifecycle",
  rereview_due: "lifecycle",
};
const ICON: Record<Exclude<HistoryCategory, "all">, LucideIcon> = {
  versions: FileUp,
  workflow: UserCheck,
  decisions: Gavel,
  conditions: ListChecks,
  legal: Scale,
  risk: ShieldAlert,
  responses: MessageSquareReply,
  lifecycle: ArrowLeftRight,
};

export interface TimelineItem {
  key: string;
  type: string;
  at: string;
  actor: string | null;
  submissionId: string | null;
  from: string | null;
  to: string | null;
  payload: Record<string, unknown>;
  decision?: ReviewDecision;
  count: number;
}

/** Events (+ one aggregated entry per version/day for finding responses), identical neighbours collapsed. */
export function buildTimeline(
  events: ReviewEvent[],
  decisions: ReviewDecision[],
  responses: { submission_id: string; actor_id: string; actor_role: string; created_at: string }[],
): TimelineItem[] {
  const byId = new Map(decisions.map((d) => [d.id, d]));
  const items: TimelineItem[] = events.map((e) => {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    return {
      key: `e${e.id}`,
      type: e.event_type,
      at: e.created_at,
      actor: e.actor_id,
      submissionId: e.submission_id,
      from: e.from_status,
      to: e.to_status,
      payload,
      decision:
        typeof payload["decision_id"] === "string"
          ? byId.get(payload["decision_id"] as string)
          : undefined,
      count: 1,
    };
  });
  const groups = new Map<string, TimelineItem>();
  for (const r of responses) {
    const k = `${r.submission_id}|${r.actor_id}|${r.created_at.slice(0, 10)}`;
    const g = groups.get(k);
    if (g) {
      g.count++;
      if (r.created_at > g.at) g.at = r.created_at;
    } else
      groups.set(k, {
        key: `r${k}`,
        type: "responses",
        at: r.created_at,
        actor: r.actor_id,
        submissionId: r.submission_id,
        from: null,
        to: null,
        payload: { side: r.actor_role },
        count: 1,
      });
  }
  const sorted = [...items, ...groups.values()].sort((a, b) => a.at.localeCompare(b.at));
  const out: TimelineItem[] = [];
  for (const it of sorted) {
    const prev = out.at(-1);
    if (
      prev &&
      it.type !== "responses" &&
      prev.type === it.type &&
      prev.actor === it.actor &&
      prev.submissionId === it.submissionId &&
      JSON.stringify(prev.payload) === JSON.stringify(it.payload) &&
      new Date(it.at).getTime() - new Date(prev.at).getTime() < 60_000
    ) {
      prev.count++;
      continue;
    }
    out.push({ ...it });
  }
  return out;
}
export const categoryOf = (type: string): Exclude<HistoryCategory, "all"> =>
  CATEGORY_OF[type] ??
  (type.startsWith("condition_")
    ? "conditions"
    : type.startsWith("lifecycle_")
      ? "lifecycle"
      : "workflow");

export function HistoryPanel({
  promotion: p,
  versions,
}: {
  promotion: Promotion;
  versions: VersionSummary[];
}) {
  const { t, lang } = useI18n();
  const errText = useErrorText();
  const [filter, setFilter] = useState<HistoryCategory>("all");
  const ids = versions.map((v) => v.id);
  const history = useQuery({ queryKey: rk.history(p.id), queryFn: () => fetchHistory(p.id, ids) });
  const responses = useQuery({
    queryKey: ["history-responses", p.id, ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () =>
      ((
        await supabase
          .from("finding_responses")
          .select("submission_id, actor_id, actor_role, created_at")
          .in("submission_id", ids)
      ).data ?? []) as {
        submission_id: string;
        actor_id: string;
        actor_role: string;
        created_at: string;
      }[],
  });
  const actors = useQuery({
    queryKey: ["history-actors", p.id],
    queryFn: async () =>
      ((
        await (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>)(
          "history_actors",
          { _pid: p.id },
        )
      ).data ?? {}) as Record<string, { name: string | null; role: string | null }>,
  });
  const reasons = useQuery({
    queryKey: rk.reasons(p.org_id),
    queryFn: () => fetchReasons(p.org_id),
  });
  const verify = useMutation({ mutationFn: () => verifyChain(p.id) });
  if (history.isPending) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (history.isError)
    return (
      <p className="text-sm text-red" role="alert">
        {errText(history.error)}
      </p>
    );
  const { events, decisions, shareReviews } = history.data;
  const items = buildTimeline(events, decisions, responses.data ?? []);
  const versionNo = (sid: string | null) => versions.find((v) => v.id === sid)?.version_no ?? null;
  const shown = items.filter((i) => filter === "all" || categoryOf(i.type) === filter);
  const counts = new Map<string, number>();
  for (const i of items) counts.set(categoryOf(i.type), (counts.get(categoryOf(i.type)) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-4" data-testid="history-panel">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("review.history.title")}</CardTitle>
          {decisions.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              icon={<ShieldCheck />}
              loading={verify.isPending}
              onClick={() => verify.mutate()}
            >
              {t("review.history.verify")}
            </Button>
          )}
        </div>
        {verify.data && (
          <p
            role="status"
            className={cn(
              "flex items-center gap-2 text-sm",
              verify.data.valid ? "text-green" : "text-red",
            )}
          >
            {verify.data.valid ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <ShieldAlert className="size-4" aria-hidden="true" />
            )}
            {verify.data.valid ? t("review.history.valid") : t("review.history.broken")}
          </p>
        )}
        <div role="toolbar" aria-label={t("history2.filters")} className="flex flex-wrap gap-1.5">
          {(
            [
              "all",
              "versions",
              "workflow",
              "decisions",
              "conditions",
              "responses",
              "legal",
              "risk",
              "lifecycle",
            ] as const
          ).map((c) => {
            const n = c === "all" ? items.length : (counts.get(c) ?? 0);
            if (n === 0 && c !== "all") return null;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={filter === c}
                onClick={() => setFilter(c)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm",
                  filter === c ? "border-ink bg-ink text-white" : "border-border hover:bg-sunken",
                )}
              >
                {t(`history2.cat.${c}` as TKey)}
                <span className="tabular text-xs opacity-75">{n}</span>
              </button>
            );
          })}
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("review.history.empty")}</p>
        ) : (
          <ol className="relative flex flex-col gap-2 border-s-2 border-border ps-5">
            {shown.map((i) => (
              <Item
                key={i.key}
                it={i}
                actor={i.actor ? actors.data?.[i.actor] : undefined}
                versionNo={versionNo(i.submissionId)}
                lang={lang}
                reasonLabel={(id) => {
                  const r = reasons.data?.find((x) => x.id === id);
                  return r ? (lang === "en" ? r.label_en : r.label_ar) : null;
                }}
              />
            ))}
          </ol>
        )}
      </Card>
      {shareReviews.length > 0 && (
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("review.history.shareReviews")}</CardTitle>
          <ul className="flex flex-col gap-1 text-sm">
            {shareReviews.map((s) => (
              <li key={s.id}>
                {s.reviewer_name ?? "—"} · {t(`share.decision.${s.decision}` as TKey)} ·{" "}
                {bothCalendars(s.created_at, lang)}
                {s.comment && <span className="block text-fg-muted">{s.comment}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Item({
  it,
  actor,
  versionNo,
  lang,
  reasonLabel,
}: {
  it: TimelineItem;
  actor: { name: string | null; role: string | null } | undefined;
  versionNo: number | null;
  lang: "ar" | "en";
  reasonLabel: (id: string) => string | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const cat = categoryOf(it.type);
  const Icon =
    it.type === "self_approved" || it.decision?.decision === "approve"
      ? BadgeCheck
      : it.type.startsWith("correction")
        ? Wrench
        : it.type.startsWith("analysis")
          ? ScanSearch
          : ICON[cat];
  const k = `review.history.event.${it.type}` as TKey;
  const k2 = `history2.event.${it.type}` as TKey;
  const title = t(k) !== k ? t(k) : t(k2) !== k2 ? t(k2) : it.type;
  const d = it.decision;
  const recordedRole = d?.actor_role;
  const p = it.payload;
  const reasons = (d?.reason_ids ?? []).map(reasonLabel).filter(Boolean) as string[];
  if (d?.reason_other) reasons.push(d.reason_other);
  const details: [string, string][] = [];
  for (const key of [
    "note",
    "reason",
    "question",
    "response",
    "status",
    "verdict",
    "method",
    "license_no",
    "previous",
    "assignee",
    "returned_to",
    "unanswered_findings",
  ]) {
    const v = p[key];
    if (v !== undefined && v !== null && v !== "" && typeof v !== "object")
      details.push([key, String(v)]);
  }
  return (
    <li className="relative" data-testid="history-item">
      <span
        aria-hidden="true"
        className="absolute -start-[31px] top-1 grid size-6 place-items-center rounded-full border border-border bg-surface"
      >
        <Icon className="size-3.5 text-fg-muted" />
      </span>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-start hover:bg-sunken"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5 font-medium">
            {it.type === "responses"
              ? t("history2.responses", {
                  n: it.count,
                  side: t(`ws.side.${String(p["side"] ?? "uploader")}` as TKey),
                })
              : title}
            {d && <Badge>{t(`review.decision.${d.decision}` as TKey)}</Badge>}
            {versionNo && (
              <Badge variant="neutral">{t("ws.header.version", { n: versionNo })}</Badge>
            )}
            {it.count > 1 && it.type !== "responses" && (
              <Badge variant="outline">×{it.count}</Badge>
            )}
          </span>
          <span className="block text-xs text-fg-muted">
            {actor?.name ?? (it.actor ? t("history2.member") : t("history2.notRecorded"))}
            {recordedRole
              ? ` · ${t(`org.roles.${recordedRole}` as TKey) !== `org.roles.${recordedRole}` ? t(`org.roles.${recordedRole}` as TKey) : recordedRole}`
              : actor?.role
                ? ` · ${t(`org.roles.${actor.role}` as TKey)} ${t("history2.currentRole")}`
                : ""}
            {" · "}
            {bothCalendars(it.at, lang)}
          </span>
          {it.from && it.to && it.from !== it.to && (
            <span className="mt-0.5 block text-xs">
              {t(`promo.reviewStatus.${it.from}` as TKey)} ←{" "}
              {t(`promo.reviewStatus.${it.to}` as TKey)}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "mt-1 size-4 shrink-0 text-fg-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="ms-2 mt-1 flex flex-col gap-1.5 rounded-md bg-sunken p-3 text-sm">
          {reasons.length > 0 && (
            <p>
              <span className="font-bold">{t("ws.decisionSummary.reasons")}: </span>
              {reasons.join("، ")}
            </p>
          )}
          {d?.condition_ar && (
            <p dir="auto">
              <span className="font-bold">{t("review.condition")}: </span>
              {d.condition_ar}
            </p>
          )}
          {d?.comment && (
            <p dir="auto" className="whitespace-pre-wrap">
              {d.comment}
            </p>
          )}
          {details.map(([key, v]) => (
            <p key={key} dir="auto">
              <span className="text-fg-muted">{t(`history2.field.${key}` as TKey)}: </span>
              {v}
            </p>
          ))}
          {d && (
            <p className="text-xs text-fg-muted" dir="ltr">
              hash {shortHash(d.hash)} · prev {d.prev_hash ? shortHash(d.prev_hash) : "—"}
            </p>
          )}
          {!d && details.length === 0 && reasons.length === 0 && (
            <p className="text-fg-muted">{t("history2.noDetails")}</p>
          )}
        </div>
      )}
    </li>
  );
}
