import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Package, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
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
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { fetchMyOrgs } from "@/lib/api/features";
import {
  PRODUCT_TYPES,
  REGULATORS,
  SECTORS,
  approveProduct,
  archiveProduct,
  dbErrorCode,
  pk,
  saveProduct,
  useOrgSettings,
  useProducts,
  type Product,
} from "@/lib/api/promotions";
import type { ProductKeyFacts } from "@/lib/key-facts";
import {
  emptyProductForm,
  formToKeyFacts,
  productToForm,
  splitAliases,
  validateProductForm,
  type FormIssue,
  type ProductForm,
} from "./model";

export function ProductsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs });
  const [orgId, setOrgId] = useState("");
  useEffect(() => {
    if (!orgId && orgs.data?.[0]) setOrgId(orgs.data[0].id);
  }, [orgs.data, orgId]);
  const role = orgs.data
    ?.find((o) => o.id === orgId)
    ?.org_members.find((m) => m.user_id === user?.id)?.role;
  const canManage = role === "owner" || role === "admin";

  if (orgs.isPending)
    return (
      <Page>
        <Skeleton className="h-40 w-full rounded-lg" />
      </Page>
    );
  if (orgs.isError)
    return (
      <Page narrow>
        <ErrorState
          title={t("products.title")}
          body={t("errors.network")}
          retryLabel={t("common.retry")}
          onRetry={() => void orgs.refetch()}
        />
      </Page>
    );
  if (!orgs.data.length)
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

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("products.title")} description={t("products.subtitle")} />
      {orgs.data.length > 1 && (
        <Field label={t("products.pickOrg")} className="max-w-sm">
          <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.data.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {orgId && <ProductList orgId={orgId} canManage={canManage} />}
    </Page>
  );
}

function ProductList({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const products = useProducts(orgId);
  const settings = useOrgSettings(orgId);
  const [editing, setEditing] = useState<{ product: Product | null; asNewVersion: boolean } | null>(
    null,
  );
  const [approving, setApproving] = useState<Product | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: pk.products(orgId) });
  const onErr = (e: unknown) =>
    toast.error(t(`promo.errors.${dbErrorCode(e) ?? "forbidden"}` as TKey));
  const approve = useMutation({
    mutationFn: (id: string) => approveProduct(id),
    onSuccess: () => {
      toast.success(t("products.approvedToast"));
      setApproving(null);
      void refresh();
    },
    onError: onErr,
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveProduct(id),
    onSuccess: () => {
      toast.success(t("products.archivedToast"));
      void refresh();
    },
    onError: onErr,
  });

  const date = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB") : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!canManage && <p className="text-sm text-fg-muted">{t("products.membersReadOnly")}</p>}
        {canManage && (
          <Button
            icon={<Plus />}
            onClick={() => setEditing({ product: null, asNewVersion: false })}
          >
            {t("products.add")}
          </Button>
        )}
      </div>

      {products.isPending ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : products.isError ? (
        <ErrorState
          title={t("products.title")}
          body={t("errors.network")}
          retryLabel={t("common.retry")}
          onRetry={() => void products.refetch()}
        />
      ) : products.data.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={t("products.emptyTitle")}
          body={t("products.emptyBody")}
        />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="product-list">
          {products.data.map((p) => {
            const k = (p.key_facts ?? {}) as ProductKeyFacts;
            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-fg" dir="auto">
                        {(lang === "en" && p.name_en) || p.name_ar}
                      </p>
                      <p className="mt-1 text-sm text-fg-muted">
                        {t(`products.typeOpt.${p.product_type}` as TKey)} ·{" "}
                        {t(`products.regulatorOpt.${p.regulator}` as TKey)} ·{" "}
                        {t("products.version", { n: p.version })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{t(`products.status.${p.status}` as TKey)}</Badge>
                      {p.status === "approved" && p.approved_at && (
                        <span className="text-xs text-fg-muted">
                          {t("products.approvedBy", { date: date(p.approved_at) })}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg">
                    {k.apr && (
                      <span>
                        {t("products.apr")}: <bdi>{k.apr.value}</bdi>
                        {k.apr.type ? ` (${t(`products.aprTypeOpt.${k.apr.type}` as TKey)})` : ""}
                      </span>
                    )}
                    {k.term_months && (
                      <span>
                        {t("products.termMin")}: <bdi>{k.term_months.min}</bdi> ·{" "}
                        {t("products.termMax")}: <bdi>{k.term_months.max}</bdi>
                      </span>
                    )}
                    {k.fees?.length ? (
                      <span>
                        {t("products.fees")}: <bdi>{k.fees.length}</bdi>
                      </span>
                    ) : null}
                  </p>
                  {canManage && p.status !== "archived" && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                      {p.status === "draft" ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditing({ product: p, asNewVersion: false })}
                          >
                            {t("products.edit")}
                          </Button>
                          <Button size="sm" onClick={() => setApproving(p)}>
                            {t("products.approve")}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditing({ product: p, asNewVersion: true })}
                        >
                          {t("products.newVersion")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={archive.isPending && archive.variables === p.id}
                        onClick={() => archive.mutate(p.id)}
                      >
                        {t("products.archive")}
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ProductDialog
          orgId={orgId}
          product={editing.product}
          asNewVersion={editing.asNewVersion}
          defaultSector={(settings.data?.sector as ProductForm["sector"] | null) ?? "banking"}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
      <Dialog
        open={Boolean(approving)}
        onOpenChange={(o) => !o && setApproving(null)}
        title={t("products.approve")}
        description={t("products.approveConfirm")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproving(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={approve.isPending}
              onClick={() => approving && approve.mutate(approving.id)}
            >
              {t("products.approve")}
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </div>
  );
}

function ProductDialog({
  orgId,
  product,
  asNewVersion,
  defaultSector,
  onClose,
  onSaved,
}: {
  orgId: string;
  product: Product | null;
  asNewVersion: boolean;
  defaultSector: ProductForm["sector"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [f, setF] = useState<ProductForm>(() =>
    product ? productToForm(product) : emptyProductForm(defaultSector),
  );
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const err = (prefix: string) => {
    const i = issues.find((x) => x.path === prefix || x.path.startsWith(`${prefix}.`));
    return i ? t(`products.errors.${i.error}` as TKey) : undefined;
  };
  const save = useMutation({
    mutationFn: () =>
      saveProduct({
        id: product?.id,
        orgId,
        nameAr: f.nameAr,
        nameEn: f.nameEn || null,
        aliases: splitAliases(f.aliases),
        sector: f.sector,
        productType: f.productType,
        regulator: f.regulator,
        keyFacts: formToKeyFacts(f),
        supersedes: asNewVersion ? product : null,
      }),
    onSuccess: () => {
      toast.success(t("products.saved"));
      onSaved();
    },
    onError: (e) => toast.error(t(`promo.errors.${dbErrorCode(e) ?? "forbidden"}` as TKey)),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateProductForm(f);
    setIssues(found);
    if (!found.length) save.mutate();
  };
  const setFee = (i: number, patch: Partial<ProductForm["fees"][number]>) =>
    set(
      "fees",
      f.fees.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    );

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        asNewVersion ? t("products.newVersion") : product ? t("products.edit") : t("products.add")
      }
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="product-form" loading={save.isPending}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form id="product-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("products.nameAr")} error={err("nameAr")}>
            <Input
              value={f.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
              maxLength={120}
              dir="auto"
            />
          </Field>
          <Field label={t("products.nameEn")} optional optionalLabel={t("common.optional")}>
            <Input
              value={f.nameEn}
              onChange={(e) => set("nameEn", e.target.value)}
              maxLength={120}
              dir="ltr"
            />
          </Field>
        </div>
        <Field
          label={t("products.aliases")}
          hint={t("products.aliasesHint")}
          optional
          optionalLabel={t("common.optional")}
        >
          <Input value={f.aliases} onChange={(e) => set("aliases", e.target.value)} dir="auto" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("products.sector")}>
            <Select
              value={f.sector}
              onChange={(e) => set("sector", e.target.value as ProductForm["sector"])}
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {t(`products.sectorOpt.${s}` as TKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("products.productType")}>
            <Select
              value={f.productType}
              onChange={(e) => set("productType", e.target.value as ProductForm["productType"])}
            >
              {PRODUCT_TYPES.map((s) => (
                <option key={s} value={s}>
                  {t(`products.typeOpt.${s}` as TKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("products.regulator")}>
            <Select
              value={f.regulator}
              onChange={(e) => set("regulator", e.target.value as ProductForm["regulator"])}
            >
              {REGULATORS.map((s) => (
                <option key={s} value={s}>
                  {t(`products.regulatorOpt.${s}` as TKey)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-bold text-fg">{t("products.keyFacts")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("products.apr")}
              error={err("apr")}
              optional
              optionalLabel={t("common.optional")}
            >
              <Input
                inputMode="decimal"
                value={f.apr}
                onChange={(e) => set("apr", e.target.value)}
                dir="ltr"
              />
            </Field>
            <Field label={t("products.aprType")} optional optionalLabel={t("common.optional")}>
              <Select
                value={f.aprType}
                onChange={(e) => set("aprType", e.target.value as ProductForm["aprType"])}
              >
                <option value="">{t("promo.unknown")}</option>
                <option value="fixed">{t("products.aprTypeOpt.fixed")}</option>
                <option value="variable">{t("products.aprTypeOpt.variable")}</option>
              </Select>
            </Field>
            <Field
              label={t("products.termMin")}
              error={err("term_months")}
              optional
              optionalLabel={t("common.optional")}
            >
              <Input
                inputMode="numeric"
                value={f.termMin}
                onChange={(e) => set("termMin", e.target.value)}
                dir="ltr"
              />
            </Field>
            <Field label={t("products.termMax")} optional optionalLabel={t("common.optional")}>
              <Input
                inputMode="numeric"
                value={f.termMax}
                onChange={(e) => set("termMax", e.target.value)}
                dir="ltr"
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-fg">{t("products.fees")}</p>
            {f.fees.map((fee, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2"
              >
                <Field label={t("products.feeName")} error={err(`fees.${i}.name_ar`)}>
                  <Input
                    value={fee.name_ar}
                    onChange={(e) => setFee(i, { name_ar: e.target.value })}
                    dir="auto"
                  />
                </Field>
                <Field label={t("products.feeAmount")} error={err(`fees.${i}.amount`)}>
                  <Input
                    inputMode="decimal"
                    value={fee.amount}
                    onChange={(e) => setFee(i, { amount: e.target.value })}
                    dir="ltr"
                  />
                </Field>
                <Field label={t("products.feeUnit")}>
                  <Select
                    value={fee.unit}
                    onChange={(e) => setFee(i, { unit: e.target.value as "percent" | "SAR" })}
                  >
                    <option value="percent">{t("products.feeUnitOpt.percent")}</option>
                    <option value="SAR">{t("products.feeUnitOpt.SAR")}</option>
                  </Select>
                </Field>
                <Field
                  label={t("products.feeCap")}
                  error={err(`fees.${i}.cap_sar`)}
                  optional
                  optionalLabel={t("common.optional")}
                >
                  <Input
                    inputMode="decimal"
                    value={fee.cap_sar}
                    onChange={(e) => setFee(i, { cap_sar: e.target.value })}
                    dir="ltr"
                  />
                </Field>
                <Checkbox
                  label={t("products.feeVat")}
                  checked={fee.vat_included}
                  onChange={(e) => setFee(i, { vat_included: e.target.checked })}
                />
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 />}
                    onClick={() =>
                      set(
                        "fees",
                        f.fees.filter((_, j) => j !== i),
                      )
                    }
                  >
                    {t("products.removeFee")}
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Plus />}
              className="self-start"
              onClick={() =>
                set("fees", [
                  ...f.fees,
                  { name_ar: "", amount: "", unit: "percent", cap_sar: "", vat_included: true },
                ])
              }
            >
              {t("products.addFee")}
            </Button>
          </div>

          <Field
            label={t("products.requirements")}
            hint={t("products.listHint")}
            error={err("min_requirements_ar")}
            optional
            optionalLabel={t("common.optional")}
          >
            <Textarea
              rows={3}
              value={f.requirements}
              onChange={(e) => set("requirements", e.target.value)}
              dir="auto"
            />
          </Field>
          <Field
            label={t("products.targetCustomers")}
            hint={t("products.listHint")}
            error={err("target_customers_ar")}
            optional
            optionalLabel={t("common.optional")}
          >
            <Textarea
              rows={2}
              value={f.targetCustomers}
              onChange={(e) => set("targetCustomers", e.target.value)}
              dir="auto"
            />
          </Field>
          <Checkbox
            label={t("products.sharia")}
            checked={f.sharia}
            onChange={(e) => set("sharia", e.target.checked)}
          />
          {f.sharia && (
            <Field label={t("products.shariaRef")} optional optionalLabel={t("common.optional")}>
              <Input
                value={f.shariaRef}
                onChange={(e) => set("shariaRef", e.target.value)}
                dir="auto"
              />
            </Field>
          )}
        </fieldset>
      </form>
    </Dialog>
  );
}
