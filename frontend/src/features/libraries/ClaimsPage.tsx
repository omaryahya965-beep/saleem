import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, Plus, Upload } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useProducts } from "@/lib/api/promotions";
import {
  archiveClaim,
  claimsDue,
  evidenceUrl,
  lk,
  newClaimVersion,
  reviewClaim,
  saveClaim,
  submitClaim,
  uploadEvidence,
  useClaims,
  type Claim,
  type Substantiation,
} from "@/lib/api/libraries";
import { usePreflightText } from "@/features/review/model";
import { OrgSelect } from "./OrgSelect";
import { useOrgPicker } from "./orgPicker";

/** /claims — approved claims with substantiation (05_UX_SPEC §3). */
export function ClaimsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const picker = useOrgPicker();
  const claims = useClaims(picker.orgId);
  const errText = usePreflightText();
  const [editing, setEditing] = useState<Claim | "new" | null>(null);
  const [status, setStatus] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: lk.claims(picker.orgId) });
  const reviewer = ["owner", "admin", "reviewer"].includes(picker.role ?? "");
  const act = useMutation({
    mutationFn: async (v: {
      op: "submit" | "approve" | "reject" | "changes" | "version" | "archive";
      c: Claim;
      comment?: string;
    }) => {
      if (v.op === "submit") return submitClaim(v.c.id);
      if (v.op === "version") return void (await newClaimVersion(v.c.id));
      if (v.op === "archive") return archiveClaim(v.c.id);
      return reviewClaim(
        v.c.id,
        v.op === "approve" ? "approve" : v.op === "reject" ? "reject" : "request_changes",
        v.comment ?? "",
      );
    },
    onSuccess: () => {
      toast.success(t("claims.saved"));
      refresh();
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (picker.orgs.isPending)
    return (
      <Page>
        <Skeleton className="h-40 w-full rounded-lg" />
      </Page>
    );
  if (!picker.orgs.data?.length)
    return (
      <Page narrow>
        <EmptyState
          icon={<Building2 />}
          title={t("products.noOrgTitle")}
          body={t("products.noOrgBody")}
          action={
            <Button asChild>
              <Link to="/org">{t("nav.workspace")}</Link>
            </Button>
          }
        />
      </Page>
    );
  const list = (claims.data ?? []).filter((c) => !status || c.status === status);
  const due = claimsDue(claims.data ?? []);
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("claims.title")}
        description={t("claims.subtitle")}
        actions={
          picker.role && picker.role !== "legal" ? (
            <Button icon={<Plus />} onClick={() => setEditing("new")}>
              {t("claims.add")}
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-end gap-4">
        <OrgSelect picker={picker} />
        <Field label={t("claims.status")} className="max-w-xs">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("promo.allOption")}</option>
            {[
              "draft",
              "pending_review",
              "approved",
              "changes_requested",
              "rejected",
              "expired",
              "archived",
            ].map((s) => (
              <option key={s} value={s}>
                {t(`claims.statusOpt.${s}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {due.length > 0 && (
        <p
          role="status"
          className="rounded-md border border-amber/30 bg-amber-bg px-4 py-2 text-sm"
        >
          {t("claims.dueSoon", { n: due.length })}
        </p>
      )}
      {claims.isPending ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : list.length === 0 ? (
        <EmptyState icon={<BadgeCheck />} title={t("claims.empty")} body={t("claims.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="claims-list">
          {list.map((c) => (
            <li key={c.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-fg">{c.name}</span>
                  <Badge>{t(`claims.statusOpt.${c.status}` as TKey)}</Badge>
                  <Badge>{t("products.version", { n: c.version })}</Badge>
                  {c.next_review_at && (
                    <span className="text-xs text-fg-muted">
                      {t("claims.nextReview")}: <bdi>{c.next_review_at}</bdi>
                    </span>
                  )}
                </div>
                <p dir="auto" className="text-sm text-fg">
                  «{c.text_ar}»
                </p>
                <SubstantiationList items={(c.substantiation ?? []) as Substantiation[]} />
                <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                  {["draft", "changes_requested", "rejected"].includes(c.status) &&
                    picker.role !== "legal" && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                          {t("products.edit")}
                        </Button>
                        <Button size="sm" onClick={() => act.mutate({ op: "submit", c })}>
                          {t("claims.submit")}
                        </Button>
                      </>
                    )}
                  {c.status === "pending_review" && reviewer && c.created_by !== picker.userId && (
                    <>
                      <Button size="sm" onClick={() => act.mutate({ op: "approve", c })}>
                        {t("claims.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const r = window.prompt(t("claims.reasonPrompt"));
                          if (r) act.mutate({ op: "changes", c, comment: r });
                        }}
                      >
                        {t("review.decision.request_changes")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const r = window.prompt(t("claims.reasonPrompt"));
                          if (r) act.mutate({ op: "reject", c, comment: r });
                        }}
                      >
                        {t("review.decision.reject")}
                      </Button>
                    </>
                  )}
                  {c.status === "approved" && picker.role !== "legal" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => act.mutate({ op: "version", c })}
                    >
                      {t("claims.newVersion")}
                    </Button>
                  )}
                  {["owner", "admin"].includes(picker.role ?? "") && c.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act.mutate({ op: "archive", c })}
                    >
                      {t("products.archive")}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ClaimDialog
          orgId={picker.orgId}
          claim={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </Page>
  );
}

export function SubstantiationList({ items }: { items: Substantiation[] }) {
  const { t } = useI18n();
  if (!items.length) return <p className="text-xs text-fg-muted">{t("claims.noSubstantiation")}</p>;
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {items.map((s, i) => (
        <li key={i}>
          {s.kind === "url" ? (
            <a className="text-green hover:underline" href={s.url} target="_blank" rel="noreferrer">
              {s.title || s.url}
            </a>
          ) : (
            <button
              type="button"
              className="text-green hover:underline"
              onClick={() =>
                void evidenceUrl(s.path).then((u) => u && window.open(u, "_blank", "noopener"))
              }
            >
              {s.name}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ClaimDialog({
  orgId,
  claim,
  onClose,
  onSaved,
}: {
  orgId: string;
  claim: Claim | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const products = useProducts(orgId);
  const errText = usePreflightText();
  const [name, setName] = useState(claim?.name ?? "");
  const [textAr, setTextAr] = useState(claim?.text_ar ?? "");
  const [textEn, setTextEn] = useState(claim?.text_en ?? "");
  const [productIds, setProductIds] = useState<string[]>(claim?.product_ids ?? []);
  const [items, setItems] = useState<Substantiation[]>(
    (claim?.substantiation ?? []) as Substantiation[],
  );
  const [url, setUrl] = useState("");
  const [nextReview, setNextReview] = useState(claim?.next_review_at ?? "");
  const [expires, setExpires] = useState(claim?.expires_at ?? "");
  const save = useMutation({
    mutationFn: () =>
      saveClaim({
        id: claim?.id ?? null,
        orgId,
        name,
        textAr,
        textEn,
        productIds,
        channels: claim?.channels ?? [],
        communicationTypes: claim?.communication_types ?? [],
        substantiation: items,
        nextReview: nextReview || null,
        expires: expires || null,
      }),
    onSuccess: () => {
      toast.success(t("claims.saved"));
      onSaved();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const upload = useMutation({
    mutationFn: (f: File) => uploadEvidence(orgId, f),
    onSuccess: (s) => setItems((x) => [...x, s]),
    onError: () => toast.error(t("newCheck.errUpload")),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={claim ? t("products.edit") : t("claims.add")}
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!name.trim() || !textAr.trim()}
            onClick={() => save.mutate()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("claims.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
        </Field>
        <Field label={t("claims.textAr")}>
          <Textarea rows={2} value={textAr} onChange={(e) => setTextAr(e.target.value)} dir="rtl" />
        </Field>
        <Field label={t("claims.textEn")} optional optionalLabel={t("common.optional")}>
          <Input value={textEn} onChange={(e) => setTextEn(e.target.value)} dir="ltr" />
        </Field>
        {(products.data?.length ?? 0) > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">{t("claims.products")}</legend>
            {products.data!.map((p) => (
              <Checkbox
                key={p.id}
                label={(lang === "en" && p.name_en) || p.name_ar}
                checked={productIds.includes(p.id)}
                onChange={(e) =>
                  setProductIds((x) =>
                    e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id),
                  )
                }
              />
            ))}
          </fieldset>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("claims.substantiation")}</legend>
          <SubstantiationList items={items} />
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              dir="ltr"
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
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-green">
            <Upload className="size-4" aria-hidden="true" />{" "}
            {upload.isPending ? t("common.loading") : t("claims.uploadFile")}
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
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("claims.nextReview")} optional optionalLabel={t("common.optional")}>
            <Input type="date" value={nextReview} onChange={(e) => setNextReview(e.target.value)} />
          </Field>
          <Field label={t("claims.expires")} optional optionalLabel={t("common.optional")}>
            <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
