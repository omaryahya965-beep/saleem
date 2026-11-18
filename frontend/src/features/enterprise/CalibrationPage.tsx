import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Page,
  PageHeader,
  Skeleton,
  toast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { pct } from "@/lib/api/flows";
import { useIsAdmin } from "@/lib/api/roles";
import { supabase } from "@/lib/supabase";

interface Row {
  rule_code: string;
  findings: number;
  reviewed: number;
  agreement: number | null;
  dismiss_rate: number | null;
  top_dismiss_reasons: { reason: string; count: number }[];
  notes: number;
}
const day = (d: Date) => d.toISOString().slice(0, 10);

/** /admin/calibration — how reviewers respond to each rule's findings (Phase 7.6). Notes never edit rules. */
export function CalibrationPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const admin = useIsAdmin(user?.id).data === true;
  const qc = useQueryClient();
  const [from, setFrom] = useState(day(new Date(Date.now() - 90 * 86_400_000)));
  const [to, setTo] = useState(day(new Date()));
  const [note, setNote] = useState<{ code: string; text: string } | null>(null);
  const report = useQuery({
    queryKey: ["calibration", from, to],
    enabled: admin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calibration_report", {
        _from: `${from}T00:00:00+03:00`,
        _to: `${to}T23:59:59+03:00`,
      });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("add_calibration_note", {
        _rule_code: note!.code,
        _note: note!.text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote(null);
      toast.success(t("calibration.noteSaved"));
      void qc.invalidateQueries({ queryKey: ["calibration"] });
    },
    onError: () => toast.error(t("errors.generic")),
  });
  if (!admin)
    return (
      <Page>
        <EmptyState icon={<Gauge />} title={t("calibration.adminOnly")} />
      </Page>
    );
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("calibration.title")} description={t("calibration.subtitle")} />
      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label={t("analytics.from")}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
        </Field>
        <Field label={t("analytics.to")}>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
        </Field>
      </Card>
      {report.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="calibration-table">
            <thead>
              <tr className="text-fg-muted">
                {[
                  "rule",
                  "findings",
                  "reviewed",
                  "agreement",
                  "dismissRate",
                  "reasons",
                  "notes",
                ].map((k) => (
                  <th key={k} className="p-2 text-start font-medium">
                    {t(`calibration.col.${k}` as never)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(report.data ?? []).map((r) => (
                <tr key={r.rule_code} className="border-t border-border align-top">
                  <td className="p-2 font-mono" dir="ltr">
                    {r.rule_code}
                  </td>
                  <td className="p-2">
                    <bdi>{r.findings}</bdi>
                  </td>
                  <td className="p-2">
                    <bdi>{r.reviewed}</bdi>
                  </td>
                  <td className="p-2">{r.agreement === null ? "—" : pct(r.agreement)}</td>
                  <td className="p-2">{r.dismiss_rate === null ? "—" : pct(r.dismiss_rate)}</td>
                  <td className="p-2" dir="auto">
                    {r.top_dismiss_reasons.map((x) => `${x.reason} (${x.count})`).join("، ") || "—"}
                  </td>
                  <td className="p-2">
                    <bdi>{r.notes}</bdi>{" "}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setNote({ code: r.rule_code, text: "" })}
                    >
                      {t("calibration.addNote")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {note && (
        <Card className="flex flex-col gap-2">
          <Field
            label={t("calibration.noteFor", { code: note.code })}
            hint={t("calibration.noteHint")}
          >
            <Input
              value={note.text}
              onChange={(e) => setNote({ ...note, text: e.target.value })}
              dir="auto"
            />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setNote(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!note.text.trim()}
              loading={add.isPending}
              onClick={() => add.mutate()}
            >
              {t("common.save")}
            </Button>
          </div>
        </Card>
      )}
    </Page>
  );
}
