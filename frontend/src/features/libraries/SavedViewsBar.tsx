import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Save, X } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, Input, toast } from "@/components/ui";
import { useI18n } from "@/i18n";
import { downloadFile } from "@/lib/api/features";
import { deleteView, fetchSavedViews, lk, saveView } from "@/lib/api/libraries";
import { toCsv } from "@/lib/api/review";

/** Saved views (own + shared in the org) and CSV export for a list (Phase 5 task 10). */
export function SavedViewsBar<F extends Record<string, unknown>>({
  scope,
  filters,
  apply,
  orgId,
  rows,
  fileName,
}: {
  scope: "promotions" | "queue" | "claims";
  filters: F;
  apply: (f: F) => void;
  orgId: string | null;
  rows: () => Record<string, unknown>[];
  fileName: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const views = useQuery({ queryKey: lk.views(scope), queryFn: () => fetchSavedViews(scope) });
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      saveView({
        orgId: shared ? orgId : null,
        scope,
        name,
        filters,
        shared: shared && Boolean(orgId),
      }),
    onSuccess: () => {
      setName("");
      toast.success(t("views.saved"));
      void qc.invalidateQueries({ queryKey: lk.views(scope) });
    },
    onError: () => toast.error(t("errors.generic")),
  });
  const remove = useMutation({
    mutationFn: deleteView,
    onSuccess: () => void qc.invalidateQueries({ queryKey: lk.views(scope) }),
  });
  return (
    <div className="flex flex-col gap-2" data-testid="saved-views">
      <div className="flex flex-wrap items-center gap-2">
        {(views.data ?? []).map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 rounded-full border border-border ps-3"
          >
            <button type="button" className="text-sm text-fg" onClick={() => apply(v.filters as F)}>
              {v.name}
            </button>
            <button
              type="button"
              aria-label={t("common.delete")}
              className="p-1 text-fg-muted"
              onClick={() => remove.mutate(v.id)}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <Button
          size="sm"
          variant="secondary"
          icon={<Download />}
          onClick={() => downloadFile(fileName, toCsv(rows()), "text/csv;charset=utf-8")}
        >
          {t("views.export")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-56"
          value={name}
          placeholder={t("views.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
          dir="auto"
          aria-label={t("views.name")}
        />
        {orgId && (
          <Checkbox
            label={t("views.shared")}
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
        )}
        <Button
          size="sm"
          icon={<Save />}
          disabled={!name.trim()}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          {t("views.save")}
        </Button>
      </div>
    </div>
  );
}
