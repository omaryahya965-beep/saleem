// Comments — collaboration workspace (V2 completion §3, D189). Threads with author name and role, categories,
// open/resolved state, filters and search, optional video timestamp, https evidence links, and a searchable
// @mention selector fed only by people who can already read the advertisement (server-filtered again on save).
// Official decisions and conditional-approval requirements are not conversations: decision notes are shown apart
// and conditions live in their own panel.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  CheckCircle2,
  Clock,
  Link2,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Select,
  Skeleton,
  Textarea,
  toast,
} from "@/components/ui";
import { formatClock, useI18n, type TKey } from "@/i18n";
import {
  COMMENT_KINDS,
  addComment,
  ck,
  deleteComment,
  drafts,
  resolveComment,
  useCommentAuthors,
  useComments,
  useParticipants,
  type Comment,
  type CommentKind,
  type Participant,
} from "@/lib/api/comments";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";
import { usePreflightText } from "@/features/review/model";
import { cn } from "@/lib/utils";
import { isAnchor, type Anchor } from "./model";

type StateFilter = "open" | "resolved" | "all";

/** Categories the caller may post (the server enforces the same). */
export function allowedKinds(
  role: string | null,
  uploadedIt: boolean,
  legalCase: boolean,
): CommentKind[] {
  const decider =
    ["owner", "admin", "reviewer", "compliance_lead"].includes(role ?? "") && !uploadedIt;
  return COMMENT_KINDS.filter((k) =>
    k === "change_request" || k === "reviewer_feedback"
      ? decider
      : k === "legal_opinion"
        ? role === "legal" && legalCase
        : true,
  );
}

/** «m:ss» or seconds → seconds; null when empty or invalid. */
export function parseTimestamp(s: string): number | null {
  const v = s.trim();
  if (!v) return null;
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function CommentsPanel({
  promotion: p,
  version,
  versions,
  orgRole,
  userId,
}: {
  promotion: Promotion;
  version: VersionSummary;
  versions: VersionSummary[];
  orgRole: string | null;
  userId: string | null;
}) {
  const { t, formatDate } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const comments = useComments(p.id);
  const authors = useCommentAuthors(p.id);
  const participants = useParticipants(p.id);
  const latest = versions.at(-1);
  const writable =
    Boolean(latest && version.id === latest.id) && orgRole !== "viewer" && !p.is_demo;
  const uploadedIt = Boolean(userId && latest?.user_id === userId);
  const kinds = allowedKinds(orgRole, uploadedIt, orgRole === "legal" && p.escalated_to === userId);
  const draftKey = `comment:${p.id}`;
  const [body, setBody] = useState(() => drafts.get(draftKey));
  const [kind, setKind] = useState<CommentKind>("general");
  const [stamp, setStamp] = useState("");
  const [links, setLinks] = useState("");
  const [mentions, setMentions] = useState<Participant[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [state, setState] = useState<StateFilter>("open");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [q, setQ] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ck.comments(p.id) });
    void qc.invalidateQueries({ queryKey: ["comment-authors", p.id] });
  };
  const post = useMutation({
    mutationFn: () => {
      const tSec = parseTimestamp(stamp);
      const anchor: Anchor | null =
        !replyTo && tSec !== null && version.kind === "video"
          ? ({ kind: "video", t: tSec } as Anchor)
          : null;
      return addComment({
        promotionId: p.id,
        submissionId: version.id,
        body,
        anchor,
        parentId: replyTo,
        kind: replyTo ? "general" : kind,
        mentions: mentions.map((m) => m.user_id),
        links: links
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      setBody("");
      setStamp("");
      setLinks("");
      setMentions([]);
      setReplyTo(null);
      drafts.set(draftKey, "");
      toast.success(t("comments2.posted"));
      refresh();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const resolve = useMutation({
    mutationFn: (v: { id: string; on: boolean }) => resolveComment(v.id, v.on),
    onSuccess: refresh,
    onError: (e) => toast.error(errText(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: refresh,
    onError: (e) => toast.error(errText(e)),
  });

  const all = (comments.data ?? []).filter((c) => !c.deleted_at);
  const decisions = all.filter((c) => c.kind === "decision_note" || c.kind === "system");
  const roots = all.filter(
    (c) => !c.parent_id && c.kind !== "decision_note" && c.kind !== "system",
  );
  const repliesOf = (id: string) => all.filter((c) => c.parent_id === id);
  const term = q.trim().toLowerCase();
  const visible = roots.filter(
    (c) =>
      (state === "all" || (state === "open" ? !c.resolved_at : Boolean(c.resolved_at))) &&
      (kindFilter === "all" || c.kind === kindFilter) &&
      (!mineOnly ||
        (userId &&
          (c.mentions.includes(userId) ||
            repliesOf(c.id).some((r) => r.mentions.includes(userId))))) &&
      (!term || [c, ...repliesOf(c.id)].some((x) => x.body.toLowerCase().includes(term))),
  );
  const mentionsOfMe = userId
    ? roots.filter(
        (c) =>
          !c.resolved_at &&
          (c.mentions.includes(userId) || repliesOf(c.id).some((r) => r.mentions.includes(userId))),
      ).length
    : 0;
  const canResolve =
    p.owner_id === userId ||
    ["owner", "admin", "reviewer", "compliance_lead"].includes(orgRole ?? "");
  const who = (id: string) => {
    const a = authors.data?.[id];
    return {
      name: id === userId ? t("comments2.you") : (a?.name ?? null),
      role: a?.role
        ? a.role === "owner_of_ad"
          ? t("comments2.adOwner")
          : t(`org.roles.${a.role}` as TKey)
        : null,
    };
  };
  const options = useMemo(() => {
    const qq = (mentionQuery ?? "").toLowerCase();
    return (participants.data ?? []).filter(
      (m) =>
        !mentions.some((x) => x.user_id === m.user_id) &&
        `${m.name ?? ""} ${m.email ?? ""}`.toLowerCase().includes(qq),
    );
  }, [participants.data, mentionQuery, mentions]);
  const onBody = (v: string) => {
    setBody(v);
    drafts.set(draftKey, v);
    const at = /(^|\s)@([^\s@]*)$/.exec(v.slice(0, area.current?.selectionStart ?? v.length));
    setMentionQuery(at ? at[2]! : null);
  };
  const pick = (m: Participant) => {
    setMentions((x) => [...x, m]);
    setBody((b) =>
      b.replace(/(^|\s)@([^\s@]*)$/, `$1@${(m.name ?? m.email ?? "").replace(/\s+/g, "_")} `),
    );
    setMentionQuery(null);
    area.current?.focus();
  };

  if (comments.isPending) return <Skeleton className="h-48 w-full rounded-lg" />;

  return (
    <div className="flex flex-col gap-4" data-testid="comments-panel">
      {writable && (
        <Card className="flex flex-col gap-3" data-testid="comment-composer">
          <CardTitle>{replyTo ? t("comments2.replyTitle") : t("comments2.newTitle")}</CardTitle>
          {!replyTo && (
            <div
              className="flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label={t("comments2.category")}
            >
              {kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm",
                    kind === k ? "border-ink bg-ink text-white" : "border-border hover:bg-sunken",
                  )}
                >
                  {t(`comments2.kind.${k}` as TKey)}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <label htmlFor="comment-body" className="sr-only">
              {t("comments2.body")}
            </label>
            <Textarea
              id="comment-body"
              ref={area}
              rows={3}
              maxLength={5000}
              value={body}
              onChange={(e) => onBody(e.target.value)}
              placeholder={t("comments2.placeholder")}
              dir="auto"
              aria-autocomplete="list"
              aria-controls="mention-list"
            />
            {mentionQuery !== null && (
              <ul
                id="mention-list"
                role="listbox"
                aria-label={t("comments2.mentionTitle")}
                className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-overlay"
              >
                {options.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-fg-muted">
                    {t("comments2.noParticipants")}
                  </li>
                ) : (
                  options.map((m) => (
                    <li key={m.user_id} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => pick(m)}
                        className="flex w-full flex-col items-start rounded-sm px-3 py-1.5 text-start text-sm hover:bg-sunken"
                      >
                        <span className="font-medium">{m.name ?? m.email}</span>
                        <span className="text-xs text-fg-muted">
                          {t(`org.roles.${m.role}` as TKey)}
                          {m.email && m.name ? ` · ${m.email}` : ""}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {mentions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <AtSign aria-hidden="true" className="size-4 text-fg-muted" />
              {mentions.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => setMentions((x) => x.filter((y) => y.user_id !== m.user_id))}
                  className="rounded-full bg-sunken px-2 py-0.5 text-xs"
                  aria-label={t("comments2.removeMention", { name: m.name ?? m.email ?? "" })}
                >
                  {m.name ?? m.email} ×
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-fg-muted">{t("comments2.mentionHint")}</p>
          {!replyTo && (
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              {version.kind === "video" && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t("comments2.timestamp")}</span>
                  <input
                    value={stamp}
                    onChange={(e) => setStamp(e.target.value)}
                    placeholder="0:12"
                    dir="ltr"
                    className="h-10 rounded-md border border-border bg-surface px-3"
                    aria-invalid={stamp !== "" && parseTimestamp(stamp) === null}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t("comments2.links")}</span>
                <Textarea
                  rows={1}
                  value={links}
                  onChange={(e) => setLinks(e.target.value)}
                  dir="ltr"
                  placeholder="https://"
                />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<Send />}
              loading={post.isPending}
              disabled={!body.trim() || (stamp !== "" && parseTimestamp(stamp) === null)}
              onClick={() => post.mutate()}
            >
              {replyTo ? t("comments2.sendReply") : t("comments2.send")}
            </Button>
            {replyTo && (
              <Button variant="ghost" onClick={() => setReplyTo(null)}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </Card>
      )}
      {!writable && (
        <p className="rounded-md bg-sunken px-3 py-2 text-sm text-fg-muted">
          {t("comments2.readOnly")}
        </p>
      )}

      <div
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label={t("comments2.filters")}
      >
        {(["open", "resolved", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={state === s}
            onClick={() => setState(s)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-sm",
              state === s ? "border-ink bg-ink text-white" : "border-border hover:bg-sunken",
            )}
          >
            {t(`comments2.state.${s}` as TKey)}
          </button>
        ))}
        <Select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          aria-label={t("comments2.category")}
          className="h-9 w-auto"
        >
          <option value="all">{t("comments2.allKinds")}</option>
          {COMMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`comments2.kind.${k}` as TKey)}
            </option>
          ))}
        </Select>
        <button
          type="button"
          aria-pressed={mineOnly}
          onClick={() => setMineOnly((x) => !x)}
          className={cn(
            "inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm",
            mineOnly ? "border-ink bg-ink text-white" : "border-border hover:bg-sunken",
          )}
        >
          <AtSign aria-hidden="true" className="size-3.5" />
          {t("comments2.mentionsMe")}
          {mentionsOfMe > 0 && (
            <span
              className="rounded-full bg-red px-1.5 text-xs text-white"
              data-testid="mention-count"
            >
              {mentionsOfMe}
            </span>
          )}
        </button>
        <label className="relative ms-auto">
          <span className="sr-only">{t("comments2.search")}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("comments2.search")}
            className="h-9 rounded-md border border-border bg-surface ps-8 pe-3 text-sm"
            dir="auto"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<MessageSquare />} title={t("comments2.empty")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((c) => (
            <li key={c.id}>
              <Card
                className={cn("flex flex-col gap-2", c.resolved_at && "opacity-75")}
                data-testid="comment-thread"
              >
                <CommentRow c={c} who={who(c.author_id)} formatDate={formatDate} />
                <div className="flex flex-col gap-2 border-s-2 border-border ps-3">
                  {repliesOf(c.id).map((r) => (
                    <CommentRow
                      key={r.id}
                      c={r}
                      who={who(r.author_id)}
                      formatDate={formatDate}
                      compact
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {writable && !c.resolved_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReplyTo(c.id);
                        area.current?.focus();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      {t("comments2.reply")}
                    </Button>
                  )}
                  {canResolve && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={c.resolved_at ? <RotateCcw /> : <CheckCircle2 />}
                      loading={resolve.isPending}
                      onClick={() => resolve.mutate({ id: c.id, on: !c.resolved_at })}
                    >
                      {c.resolved_at ? t("comments2.reopen") : t("comments2.resolve")}
                    </Button>
                  )}
                  {c.author_id === userId && writable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      onClick={() => del.mutate(c.id)}
                    >
                      {t("common.delete")}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {decisions.length > 0 && (
        <details
          className="rounded-lg border border-border bg-surface p-4"
          data-testid="decision-notes"
        >
          <summary className="cursor-pointer text-sm font-bold">
            {t("comments2.decisionNotes", { n: decisions.length })}
          </summary>
          <p className="mt-1 text-xs text-fg-muted">{t("comments2.decisionNotesHint")}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {decisions.map((c) => (
              <li key={c.id}>
                <CommentRow c={c} who={who(c.author_id)} formatDate={formatDate} compact />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CommentRow({
  c,
  who,
  formatDate,
  compact,
}: {
  c: Comment;
  who: { name: string | null; role: string | null };
  formatDate: (v: string, withTime?: boolean) => string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const anchor = isAnchor(c.anchor) ? (c.anchor as Anchor) : null;
  return (
    <div className={cn("flex flex-col gap-1", compact && "text-sm")}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold">{who.name ?? who.role ?? t("comments2.member")}</span>
        {who.name && who.role && <Badge variant="neutral">{who.role}</Badge>}
        {!compact && c.kind !== "general" && (
          <Badge variant={c.kind === "change_request" ? "outline" : "neutral"}>
            {t(`comments2.kind.${c.kind}` as TKey)}
          </Badge>
        )}
        {c.resolved_at && <Badge>{t("comments2.resolved")}</Badge>}
        <span className="text-xs text-fg-muted">{formatDate(c.created_at, true)}</span>
        {anchor?.kind === "video" && (
          <span className="tabular inline-flex items-center gap-1 rounded-full border border-border px-2 text-xs">
            <Clock aria-hidden="true" className="size-3" />
            {formatClock(anchor.t)}
          </span>
        )}
      </div>
      <p dir="auto" className="whitespace-pre-wrap">
        {c.body}
      </p>
      {(c as Comment & { attachment_links?: string[] }).attachment_links?.map((l) => (
        <a
          key={l}
          href={l}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-xs text-green underline-offset-4 hover:underline"
          dir="ltr"
        >
          <Link2 aria-hidden="true" className="size-3" />
          {l}
        </a>
      ))}
    </div>
  );
}
