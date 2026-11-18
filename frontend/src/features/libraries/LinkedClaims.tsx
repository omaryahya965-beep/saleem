import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabase";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";
import {
  claimFromFinding,
  fetchLinkedClaims,
  linkClaim,
  lk,
  uploadEvidence,
  useClaims,
  type Substantiation,
} from "@/lib/api/libraries";
import type { ProductKeyFacts } from "@/lib/key-facts";
import { usePreflightText } from "@/features/review/model";

/** Info tab: claims linked to the promotion (always checked) and the product facts the last analysis used. */
export function LinkedClaims({
  promotion: p,
  current,
  canLink,
}: {
  promotion: Promotion;
  current: VersionSummary | null;
  canLink: boolean;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const claims = useClaims(p.org_id);
  const linked = useQuery({
    queryKey: lk.linked(p.id),
    queryFn: () => fetchLinkedClaims(p.id),
    enabled: Boolean(p.org_id),
  });
  const facts = useQuery({
    queryKey: ["facts-used", current?.id],
    enabled: Boolean(current),
    queryFn: async () => {
      const { data } = await supabase
        .from("analysis_runs")
        .select("context_snapshot")
        .eq("submission_id", current!.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const snap = (data?.context_snapshot ?? null) as {
        product?: { nameAr: string; status: string; keyFacts: ProductKeyFacts } | null;
      } | null;
      return snap?.product ?? null;
    },
  });
  const [pick, setPick] = useState("");
  const link = useMutation({
    mutationFn: (v: { id: string; on: boolean }) => linkClaim(p.id, v.id, v.on),
    onSuccess: () => {
      setPick("");
      void qc.invalidateQueries({ queryKey: lk.linked(p.id) });
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (!p.org_id) return null;
  const byId = new Map((claims.data ?? []).map((c) => [c.id, c]));
  const linkedIds = new Set((linked.data ?? []).map((l) => l.claim_id));
  const approved = (claims.data ?? []).filter(
    (c) => c.status === "approved" && !linkedIds.has(c.id),
  );
  const k = facts.data?.keyFacts;
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3" data-testid="linked-claims">
        <CardTitle>{t("claims.linkedTitle")}</CardTitle>
        {(linked.data ?? []).length === 0 ? (
          <p className="text-sm text-fg-muted">{t("claims.noneLinked")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {linked.data!.map((l) => (
              <li key={l.claim_id} className="flex flex-wrap items-center justify-between gap-2">
                <span dir="auto">
                  «{byId.get(l.claim_id)?.text_ar ?? "—"}»{" "}
                  <Badge>{t(`claims.linkSource.${l.link_source}` as never)}</Badge>
                </span>
                {canLink && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => link.mutate({ id: l.claim_id, on: false })}
                  >
                    {t("claims.unlink")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canLink && approved.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("claims.linkApproved")} className="min-w-60 flex-1">
              <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">—</option>
                {approved.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              disabled={!pick}
              loading={link.isPending}
              onClick={() => link.mutate({ id: pick, on: true })}
            >
              {t("claims.link")}
            </Button>
          </div>
        )}
      </Card>
      <Card className="flex flex-col gap-2" data-testid="facts-used">
        <CardTitle>{t("claims.factsUsed")}</CardTitle>
        {!facts.data ? (
          <p className="text-sm text-fg-muted">{t("claims.noFactsUsed")}</p>
        ) : (
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              {facts.data.nameAr} · {t(`products.status.${facts.data.status}` as never)}
            </span>
            {k?.apr && (
              <span>
                {t("products.apr")}: <bdi>{k.apr.value}</bdi>
              </span>
            )}
            {k?.term_months && (
              <span>
                {t("products.termMin")}–{t("products.termMax")}:{" "}
                <bdi>
                  {k.term_months.min}–{k.term_months.max}
                </bdi>
              </span>
            )}
            {k?.fees?.length ? (
              <span>
                {t("products.fees")}:{" "}
                {k.fees
                  .map((f) => `${f.name_ar} ${f.amount}${f.unit === "percent" ? "%" : ""}`)
                  .join("، ")}
              </span>
            ) : null}
          </p>
        )}
      </Card>
    </div>
  );
}

/** Fix from a SYS-CLAIMS finding: add the claim with substantiation (reviewers may approve in the same step). */
export function ClaimFromFindingDialog({
  finding,
  orgId,
  canApprove,
  onClose,
  onDone,
}: {
  finding: { id: string; evidence_text: string | null };
  orgId: string;
  canApprove: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const errText = usePreflightText();
  const [name, setName] = useState("");
  const [text, setText] = useState(finding.evidence_text ?? "");
  const [items, setItems] = useState<Substantiation[]>([]);
  const [url, setUrl] = useState("");
  const [approve, setApprove] = useState(canApprove);
  const upload = useMutation({
    mutationFn: (f: File) => uploadEvidence(orgId, f),
    onSuccess: (s) => setItems((x) => [...x, s]),
    onError: () => toast.error(t("newCheck.errUpload")),
  });
  const save = useMutation({
    mutationFn: () =>
      claimFromFinding(finding.id, name || text.slice(0, 60), text, items, approve && canApprove),
    onSuccess: () => {
      toast.success(
        approve && canApprove ? t("claims.approvedFromFinding") : t("claims.sentForApproval"),
      );
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("claims.fromFinding")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!text.trim() || !items.length}
            onClick={() => save.mutate()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={t("claims.name")} optional optionalLabel={t("common.optional")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
        </Field>
        <Field label={t("claims.textAr")}>
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} dir="rtl" />
        </Field>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            dir="ltr"
            aria-label={t("claims.substantiation")}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!/^https?:\/\//.test(url)}
            onClick={() => {
              setItems((x) => [...x, { kind: "url", url }]);
              setUrl("");
            }}
          >
            {t("claims.addUrl")}
          </Button>
        </div>
        <label className="text-sm text-green">
          {t("claims.uploadFile")}
          <input
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
            }}
          />
        </label>
        {items.length > 0 && (
          <p className="text-xs text-fg-muted">
            {t("claims.substantiationCount", { n: items.length })}
          </p>
        )}
        {canApprove && (
          <Checkbox
            label={t("claims.approveNow")}
            checked={approve}
            onChange={(e) => setApprove(e.target.checked)}
          />
        )}
        {!canApprove && <p className="text-sm text-fg-muted">{t("claims.creatorNote")}</p>}
      </div>
    </Dialog>
  );
}
