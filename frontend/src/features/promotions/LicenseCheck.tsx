// Mawthooq licence — manual verification (D190). SALEEM does not query mawthooq.sa automatically (its public pages
// are protected by anti-bot challenges that must not be bypassed); a decider records what they checked, with a note.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Field, Select, Textarea, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { pk, type Promotion } from "@/lib/api/promotions";
import { usePreflightText } from "@/features/review/model";

type Status = "unverified" | "verified" | "invalid" | "not_applicable";
type WithLicense = Promotion & {
  creator_license_status?: Status;
  creator_license_checked_at?: string | null;
  creator_license_note?: string | null;
};

export function LicenseCheck({ promotion, canCheck }: { promotion: Promotion; canCheck: boolean }) {
  const p = promotion as WithLicense;
  const { t, formatDate } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const [status, setStatus] = useState<Status>(p.creator_license_status ?? "unverified");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (
        supabase.rpc as unknown as (
          f: string,
          a: object,
        ) => PromiseLike<{ error: { message: string } | null }>
      )("verify_creator_license", { _pid: p.id, _status: status, _note: note });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(t("license.saved"));
      setNote("");
      void qc.invalidateQueries({ queryKey: pk.promotion(p.id) });
    },
    onError: (e) => toast.error(errText(e)),
  });
  const current = p.creator_license_status ?? "unverified";
  return (
    <div className="flex flex-col gap-2" data-testid="license-check">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldQuestion aria-hidden="true" className="size-4 text-fg-muted" />
        <Badge variant={current === "verified" ? "outline" : "neutral"}>
          {t(`license.status.${current}` as TKey)}
        </Badge>
        {p.creator_license_no && <bdi className="text-sm">{p.creator_license_no}</bdi>}
        {p.creator_license_checked_at && (
          <span className="text-xs text-fg-muted">
            {t("license.checkedAt", { date: formatDate(p.creator_license_checked_at, true) })}
          </span>
        )}
      </div>
      {p.creator_license_note && (
        <p className="text-sm" dir="auto">
          {p.creator_license_note}
        </p>
      )}
      <p className="text-xs text-fg-muted">{t("license.manualNote")}</p>
      <a
        href="https://mawthooq.sa"
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 text-xs text-green underline-offset-4 hover:underline"
      >
        mawthooq.sa
        <ExternalLink aria-hidden="true" className="size-3" />
      </a>
      {canCheck && (
        <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
          <Field label={t("license.result")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {(["verified", "invalid", "not_applicable", "unverified"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`license.status.${s}` as TKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("license.note")}>
            <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} dir="auto" />
          </Field>
          <Button loading={save.isPending} disabled={!note.trim()} onClick={() => save.mutate()}>
            {t("license.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
