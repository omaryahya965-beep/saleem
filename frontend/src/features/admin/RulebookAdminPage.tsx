import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Pencil, ShieldAlert } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import {
  createDraft,
  fetchAllVersions,
  setVersionStatus,
  updateRule,
  updateVersion,
  type Rule,
} from "@/lib/api/features";
import { useIsAdmin } from "@/lib/api/hooks";

const NEXT: Record<string, "legal_review" | "published" | null> = {
  draft: "legal_review",
  legal_review: "published",
  published: null,
  archived: null,
};

export function RulebookAdminPage() {
  const { t, lang, formatDate } = useI18n();
  const { user } = useAuth();
  const admin = useIsAdmin(user?.id);
  const qc = useQueryClient();
  const versions = useQuery({
    queryKey: ["rulebook-admin"],
    queryFn: fetchAllVersions,
    enabled: admin.data === true,
  });
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState<Rule | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["rulebook-admin"] });
    void qc.invalidateQueries({ queryKey: ["rulebook"] });
  };
  const onErr = () => toast.error(t("errors.generic"));
  const draft = useMutation({
    mutationFn: () => createDraft(label.trim(), ""),
    onSuccess: () => {
      setLabel("");
      refresh();
    },
    onError: onErr,
  });
  const advance = useMutation({
    mutationFn: (v: { id: string; s: "legal_review" | "published" | "draft" }) =>
      setVersionStatus(v.id, v.s),
    onSuccess: refresh,
    onError: onErr,
  });
  const saveVersion = useMutation({
    mutationFn: (v: {
      id: string;
      changelog: string;
      effective_from: string | null;
      notes: string | null;
    }) => updateVersion(v.id, v),
    onSuccess: () => {
      toast.success(t("settings.saved"));
      refresh();
    },
    onError: onErr,
  });
  const saveRule = useMutation({
    mutationFn: (r: Rule) =>
      updateRule(r.id, {
        title_ar: r.title_ar,
        title_en: r.title_en,
        description_ar: r.description_ar,
        description_en: r.description_en,
        default_severity: r.default_severity,
        llm_instructions: r.llm_instructions,
        source_url: r.source_url,
        is_active: r.is_active,
      }),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
    onError: onErr,
  });

  if (admin.isPending)
    return (
      <Page>
        <Skeleton className="h-40 w-full rounded-lg" />
      </Page>
    );
  if (!admin.data)
    return (
      <Page narrow>
        <EmptyState
          icon={<ShieldAlert />}
          title={t("admin.forbiddenTitle")}
          body={t("admin.forbiddenBody")}
        />
      </Page>
    );

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("rulesAdmin.title")} description={t("rulesAdmin.subtitle")} />
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label={t("rulesAdmin.newLabel")} hint={t("rulesAdmin.newHint")} className="flex-1">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            dir="ltr"
            placeholder="2026.11-a"
            className="rtl:text-end"
          />
        </Field>
        <Button
          icon={<FilePlus2 />}
          disabled={!label.trim()}
          loading={draft.isPending}
          onClick={() => draft.mutate()}
          className="sm:mb-6"
        >
          {t("rulesAdmin.createDraft")}
        </Button>
      </Card>

      {versions.isError ? (
        <ErrorState
          title={t("rulebook.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void versions.refetch()}
        />
      ) : versions.isPending ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : (
        versions.data.map((v) => {
          const editable = v.status === "draft" || v.status === "legal_review";
          const next = NEXT[v.status];
          return (
            <Card key={v.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle dir="ltr">{v.version_label}</CardTitle>
                <Badge variant={v.status === "published" ? "green" : "outline"}>
                  {t(`rulesAdmin.status.${v.status}` as never)}
                </Badge>
                {v.is_active && <Badge variant="inverse">{t("rulesAdmin.active")}</Badge>}
                <span className="text-sm text-fg-muted">
                  {v.published_at
                    ? t("rulesAdmin.publishedOn", { date: formatDate(v.published_at) })
                    : formatDate(v.created_at)}
                </span>
                <span className="ms-auto flex gap-2">
                  {v.status === "legal_review" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => advance.mutate({ id: v.id, s: "draft" })}
                    >
                      {t("rulesAdmin.backToDraft")}
                    </Button>
                  )}
                  {next && (
                    <Button
                      size="sm"
                      loading={advance.isPending}
                      onClick={() => advance.mutate({ id: v.id, s: next })}
                    >
                      {t(`rulesAdmin.to.${next}` as never)}
                    </Button>
                  )}
                </span>
              </div>
              {editable ? (
                <form
                  className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    saveVersion.mutate({
                      id: v.id,
                      changelog: String(fd.get("changelog") ?? ""),
                      effective_from: String(fd.get("effective") ?? "") || null,
                      notes: v.notes,
                    });
                  }}
                >
                  <Field label={t("rulesAdmin.effective")}>
                    <Input name="effective" type="date" defaultValue={v.effective_from ?? ""} />
                  </Field>
                  <Field label={t("rulesAdmin.changelog")}>
                    <Input name="changelog" defaultValue={v.changelog ?? ""} dir="auto" />
                  </Field>
                  <Button type="submit" variant="secondary" loading={saveVersion.isPending}>
                    {t("common.save")}
                  </Button>
                </form>
              ) : (
                (v.changelog || v.effective_from) && (
                  <p className="text-sm text-fg-muted">
                    {v.effective_from && (
                      <>
                        {t("rulesAdmin.effective")}: {formatDate(v.effective_from)} ·{" "}
                      </>
                    )}
                    {v.changelog}
                  </p>
                )
              )}
              <ul className="divide-y divide-border rounded-md border border-border">
                {[...v.rules]
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Badge mono>{r.code}</Badge>
                      <span className="min-w-0 flex-1 truncate">
                        {lang === "en" ? r.title_en : r.title_ar}
                      </span>
                      {!r.is_active && <Badge variant="outline">{t("rulesAdmin.inactive")}</Badge>}
                      <Badge variant="outline">{t(`severity.${r.default_severity}`)}</Badge>
                      {editable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil />}
                          onClick={() => setEditing(r)}
                        >
                          {t("rulesAdmin.edit")}
                        </Button>
                      )}
                    </li>
                  ))}
              </ul>
            </Card>
          );
        })
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `${editing.code} — ${t("rulesAdmin.edit")}` : ""}
        className="sm:max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={saveRule.isPending}
              onClick={() => editing && saveRule.mutate(editing)}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4 pb-4 sm:grid-cols-2">
            <Field label={t("rulesAdmin.titleAr")}>
              <Input
                dir="rtl"
                value={editing.title_ar}
                onChange={(e) => setEditing({ ...editing, title_ar: e.target.value })}
              />
            </Field>
            <Field label={t("rulesAdmin.titleEn")}>
              <Input
                dir="ltr"
                value={editing.title_en}
                onChange={(e) => setEditing({ ...editing, title_en: e.target.value })}
              />
            </Field>
            <Field label={t("rulesAdmin.descAr")}>
              <Textarea
                dir="rtl"
                value={editing.description_ar}
                onChange={(e) => setEditing({ ...editing, description_ar: e.target.value })}
              />
            </Field>
            <Field label={t("rulesAdmin.descEn")}>
              <Textarea
                dir="ltr"
                value={editing.description_en}
                onChange={(e) => setEditing({ ...editing, description_en: e.target.value })}
              />
            </Field>
            <Field label={t("rulesAdmin.severity")}>
              <Select
                value={editing.default_severity}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    default_severity: e.target.value as Rule["default_severity"],
                  })
                }
              >
                <option value="violation">{t("severity.violation")}</option>
                <option value="warning">{t("severity.warning")}</option>
              </Select>
            </Field>
            <Field label={t("rulesAdmin.sourceUrl")}>
              <Input
                dir="ltr"
                value={editing.source_url}
                onChange={(e) => setEditing({ ...editing, source_url: e.target.value })}
              />
            </Field>
            <Field label={t("rulesAdmin.instructions")} className="sm:col-span-2">
              <Textarea
                dir="ltr"
                rows={5}
                value={editing.llm_instructions}
                onChange={(e) => setEditing({ ...editing, llm_instructions: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                className="size-5 accent-[var(--green)]"
              />
              {t("rulesAdmin.activeRule")}
            </label>
          </div>
        )}
      </Dialog>
    </Page>
  );
}
