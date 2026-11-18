import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, MessageSquarePlus } from "lucide-react";
import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";
import {
  addComment,
  ck,
  deleteComment,
  drafts,
  editComment,
  resolveComment,
  useComments,
  versionPreview,
  type Comment,
} from "@/lib/api/comments";
import { useMembers } from "@/lib/api/review";
import { usePreflightText } from "@/features/review/model";
import { isAnchor, ratioFromClick, type Anchor } from "./model";

type Filter = "open" | "resolved" | "mine" | "change_request" | "all";

function anchorLabel(
  a: unknown,
  t: (k: TKey, v?: Record<string, string | number>) => string,
): string | null {
  if (!isAnchor(a)) return null;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  if (a.kind === "video") return t("comments.anchorVideo", { t: a.t.toFixed(1) });
  if (a.kind === "pdf") return t("comments.anchorPdf", { page: a.page, x: pct(a.x), y: pct(a.y) });
  if (a.kind === "image") return t("comments.anchorImage", { x: pct(a.x), y: pct(a.y) });
  return t("comments.anchorText", { quote: a.quote });
}

/** Comments tab (05_UX_SPEC §2.2): pin on the asset, threads, mentions, change requests, resolve. */
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
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const comments = useComments(p.id);
  const members = useMembers(p.org_id);
  const preview = useQuery({
    queryKey: ["version-preview", version.id],
    queryFn: () => versionPreview(version.id),
  });
  const isCurrent = version.id === versions.at(-1)?.id;
  const canChangeRequest = ["owner", "admin", "reviewer"].includes(orgRole ?? "");
  const canResolve = canChangeRequest || p.owner_id === userId;
  const draftKey = `${version.id}`;
  const [body, setBody] = useState(() => drafts.get(draftKey));
  const [kind, setKind] = useState<"general" | "change_request">("general");
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [page, setPage] = useState(1);
  const [second, setSecond] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ck.comments(p.id) });
  const name = (id: string) => {
    const m = members.data?.find((x) => x.user_id === id);
    return m?.display_name || m?.email || "—";
  };
  const versionNo = (sid: string) => versions.find((v) => v.id === sid)?.version_no ?? null;

  const post = useMutation({
    mutationFn: () =>
      addComment({
        promotionId: p.id,
        submissionId: version.id,
        body,
        parentId: replyTo,
        anchor: replyTo
          ? null
          : version.kind === "video" && second.trim()
            ? { kind: "video", t: Math.max(0, Number(second) || 0) }
            : anchor,
        kind: replyTo ? "general" : kind,
        mentions,
      }),
    onSuccess: () => {
      setBody("");
      drafts.set(draftKey, "");
      setAnchor(null);
      setMentions([]);
      setReplyTo(null);
      setSecond("");
      refresh();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const act = useMutation({
    mutationFn: (v: { op: "resolve" | "reopen" | "delete" | "edit"; id: string; body?: string }) =>
      v.op === "delete"
        ? deleteComment(v.id)
        : v.op === "edit"
          ? editComment(v.id, v.body ?? "")
          : resolveComment(v.id, v.op === "resolve"),
    onSuccess: refresh,
    onError: (e) => toast.error(errText(e)),
  });

  const all = (comments.data ?? []).filter((c) => c.submission_id === version.id);
  const roots = all
    .filter((c) => !c.parent_id)
    .filter((c) => {
      if (filter === "open") return !c.resolved_at;
      if (filter === "resolved") return Boolean(c.resolved_at);
      if (filter === "mine") return c.author_id === userId;
      if (filter === "change_request") return c.kind === "change_request";
      return true;
    });
  const pins = all.filter(
    (c) =>
      !c.parent_id &&
      isAnchor(c.anchor) &&
      (c.anchor as Anchor).kind !== "video" &&
      (c.anchor as Anchor).kind !== "text",
  );

  const pinClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!pinMode || !imgRef.current) return;
    const r = ratioFromClick(e.clientX, e.clientY, imgRef.current.getBoundingClientRect());
    setAnchor(version.kind === "pdf" ? { kind: "pdf", page, ...r } : { kind: "image", ...r });
    setPinMode(false);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="comments-panel">
      {preview.data && (version.kind === "image" || version.kind === "pdf") && (
        <Card className="flex flex-col gap-2">
          <div className="relative inline-block self-center">
            <img
              ref={imgRef}
              src={preview.data}
              alt={t("comments.previewAlt")}
              onClick={pinClick}
              className={
                pinMode
                  ? "max-h-[420px] w-auto cursor-crosshair rounded-md"
                  : "max-h-[420px] w-auto rounded-md"
              }
            />
            {pins.map((c) => {
              const a = c.anchor as Extract<Anchor, { x: number }>;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={t("comments.locate")}
                  onClick={() => setFocused(c.id)}
                  style={{ insetInlineStart: `${a.x * 100}%`, top: `${a.y * 100}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-full rtl:translate-x-1/2 ${focused === c.id ? "text-red" : "text-green"}`}
                >
                  <MapPin className="size-6 drop-shadow" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          {version.kind === "pdf" && (
            <p className="text-xs text-fg-muted">{t("comments.pdfPreviewNote")}</p>
          )}
        </Card>
      )}

      {isCurrent ? (
        <Card className="flex flex-col gap-3">
          <CardTitle>{replyTo ? t("comments.reply") : t("comments.new")}</CardTitle>
          <Field label={t("comments.body")}>
            <Textarea
              rows={3}
              value={body}
              dir="auto"
              onChange={(e) => {
                setBody(e.target.value);
                drafts.set(draftKey, e.target.value);
              }}
            />
          </Field>
          {!replyTo && (
            <div className="grid gap-3 sm:grid-cols-2">
              {canChangeRequest && (
                <Field label={t("comments.kind")}>
                  <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                    <option value="general">{t("comments.kindOpt.general")}</option>
                    <option value="change_request">{t("comments.kindOpt.change_request")}</option>
                  </Select>
                </Field>
              )}
              {version.kind === "video" ? (
                <Field label={t("comments.atSecond")} optional optionalLabel={t("common.optional")}>
                  <Input
                    inputMode="decimal"
                    dir="ltr"
                    value={second}
                    onChange={(e) => setSecond(e.target.value)}
                  />
                </Field>
              ) : (version.kind === "image" || version.kind === "pdf") && preview.data ? (
                <div className="flex flex-col gap-1">
                  {version.kind === "pdf" && (
                    <Field label={t("comments.page")}>
                      <Input
                        type="number"
                        min={1}
                        value={page}
                        onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </Field>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<MapPin />}
                    onClick={() => setPinMode(true)}
                  >
                    {pinMode ? t("comments.pinHint") : t("comments.pin")}
                  </Button>
                  {anchor && (
                    <span className="text-xs text-fg-muted">{anchorLabel(anchor, t)}</span>
                  )}
                </div>
              ) : null}
            </div>
          )}
          {(members.data?.length ?? 0) > 0 && (
            <fieldset className="flex flex-wrap gap-x-4">
              <legend className="mb-1 text-sm font-medium">{t("comments.mentions")}</legend>
              {members
                .data!.filter((m) => m.user_id !== userId)
                .map((m) => (
                  <Checkbox
                    key={m.user_id}
                    label={`@${m.display_name || m.email || m.user_id}`}
                    checked={mentions.includes(m.user_id)}
                    onChange={(e) =>
                      setMentions((x) =>
                        e.target.checked ? [...x, m.user_id] : x.filter((y) => y !== m.user_id),
                      )
                    }
                  />
                ))}
            </fieldset>
          )}
          <div className="flex justify-end gap-2">
            {replyTo && (
              <Button variant="secondary" onClick={() => setReplyTo(null)}>
                {t("common.cancel")}
              </Button>
            )}
            <Button
              icon={<MessageSquarePlus />}
              loading={post.isPending}
              disabled={!body.trim()}
              onClick={() => post.mutate()}
            >
              {t("comments.post")}
            </Button>
          </div>
        </Card>
      ) : (
        <p className="text-sm text-fg-muted">{t("comments.oldVersionReadOnly")}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {(["open", "resolved", "mine", "change_request", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "primary" : "secondary"}
            onClick={() => setFilter(f)}
          >
            {t(`comments.filter.${f}` as TKey)}
          </Button>
        ))}
      </div>

      {roots.length === 0 ? (
        <EmptyState icon={<MessageSquarePlus />} title={t("comments.empty")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {roots.map((c) => (
            <li
              key={c.id}
              data-testid="comment"
              className={`rounded-lg border bg-surface p-4 ${focused === c.id ? "border-ink" : "border-border"}`}
            >
              <CommentBody
                c={c}
                name={name(c.author_id)}
                anchorText={anchorLabel(c.anchor, t)}
                carriedFrom={
                  c.carried_from_comment_id
                    ? versionNo(
                        (comments.data ?? []).find((x) => x.id === c.carried_from_comment_id)
                          ?.submission_id ?? "",
                      )
                    : null
                }
                lang={lang}
                canEdit={c.author_id === userId && isCurrent}
                onEdit={(b) => act.mutate({ op: "edit", id: c.id, body: b })}
                onDelete={() => act.mutate({ op: "delete", id: c.id })}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {isCurrent && !c.deleted_at && (
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(c.id)}>
                    {t("comments.reply")}
                  </Button>
                )}
                {canResolve && c.kind !== "decision_note" && !c.deleted_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      act.mutate({ op: c.resolved_at ? "reopen" : "resolve", id: c.id })
                    }
                  >
                    {c.resolved_at ? t("comments.reopen") : t("comments.resolve")}
                  </Button>
                )}
                {isAnchor(c.anchor) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<MapPin />}
                    onClick={() => setFocused(c.id)}
                  >
                    {t("comments.locate")}
                  </Button>
                )}
              </div>
              <ul className="mt-2 flex flex-col gap-2 border-s-2 border-border ps-3">
                {all
                  .filter((r) => r.parent_id === c.id)
                  .map((r) => (
                    <li key={r.id}>
                      <CommentBody
                        c={r}
                        name={name(r.author_id)}
                        anchorText={null}
                        carriedFrom={null}
                        lang={lang}
                        canEdit={r.author_id === userId && isCurrent}
                        onEdit={(b) => act.mutate({ op: "edit", id: r.id, body: b })}
                        onDelete={() => act.mutate({ op: "delete", id: r.id })}
                      />
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentBody({
  c,
  name,
  anchorText,
  carriedFrom,
  lang,
  canEdit,
  onEdit,
  onDelete,
}: {
  c: Comment;
  name: string;
  anchorText: string | null;
  carriedFrom: number | null;
  lang: string;
  canEdit: boolean;
  onEdit: (b: string) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const editable =
    canEdit &&
    !c.deleted_at &&
    c.kind !== "decision_note" &&
    Date.now() - new Date(c.created_at).getTime() < 15 * 60_000;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-fg">{name}</span>
        {c.kind !== "general" && <Badge>{t(`comments.kindOpt.${c.kind}` as TKey)}</Badge>}
        {c.resolved_at && <Badge variant="neutral">{t("comments.resolved")}</Badge>}
        {carriedFrom ? (
          <Badge variant="neutral">{t("findingType.carried", { n: carriedFrom })}</Badge>
        ) : null}
        {anchorText && <span className="text-xs text-fg-muted">{anchorText}</span>}
        <span className="text-xs text-fg-muted">
          {new Date(c.created_at).toLocaleString(
            lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
          )}
          {c.edited_at ? ` · ${t("comments.edited")}` : ""}
        </span>
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea rows={2} value={text} dir="auto" onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onEdit(text);
                setEditing(false);
              }}
            >
              {t("common.save")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <p
          dir="auto"
          className={c.deleted_at ? "text-fg-muted italic" : "whitespace-pre-wrap text-fg"}
        >
          {c.deleted_at ? t("comments.deleted") : c.body}
        </p>
      )}
      {editable && !editing && (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {t("comments.edit")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            {t("common.delete")}
          </Button>
        </div>
      )}
    </div>
  );
}
