import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileQuestion, RefreshCw, Upload } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Page,
  Skeleton,
  StatusChip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/data";
import { fetchMyOrgs, rerunSubmission } from "@/lib/api/features";
import {
  OPEN_STATUSES,
  dbErrorCode,
  pk,
  updatePromotionContext,
  usePromotion,
  useProducts,
  type Promotion,
  type PromotionBundle,
  type VersionSummary,
} from "@/lib/api/promotions";
import { CheckPage } from "@/features/reports/CheckPage";
import { ContextFields, type ContextValue } from "./ContextFields";
import { pickVersion, resultOf } from "./model";
import { ReviewActions } from "@/features/review/ReviewActions";
import { ResponsesPanel } from "@/features/review/ResponsesPanel";
import { HistoryPanel } from "@/features/review/HistoryPanel";
import { CommentsPanel } from "@/features/collab/CommentsPanel";
import { CompareTab } from "@/features/collab/CompareTab";
import { LinkedClaims } from "@/features/libraries/LinkedClaims";

export function PromotionPage({ id, v }: { id: string; v?: number }) {
  const { t } = useI18n();
  const promo = usePromotion(id);
  if (promo.isPending)
    return (
      <Page className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </Page>
    );
  if (promo.isError) {
    if (promo.error instanceof ApiError && promo.error.code === "not_found")
      return (
        <Page narrow>
          <EmptyState
            icon={<FileQuestion />}
            title={t("promo.notFoundTitle")}
            body={t("promo.notFoundBody")}
            action={
              <Button asChild>
                <Link to="/promotions">{t("nav.promotions")}</Link>
              </Button>
            }
          />
        </Page>
      );
    return (
      <Page narrow>
        <ErrorState
          title={t("promo.notFoundTitle")}
          body={t("errors.network")}
          retryLabel={t("common.retry")}
          onRetry={() => void promo.refetch()}
        />
      </Page>
    );
  }
  return <PromotionView bundle={promo.data} v={v} />;
}

function PromotionView({ bundle, v }: { bundle: PromotionBundle; v?: number }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { promotion: p, versions, product } = bundle;
  const { version, missing } = pickVersion(versions, v);
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs, enabled: Boolean(user) });
  const role = orgs.data
    ?.find((o) => o.id === p.org_id)
    ?.org_members.find((m) => m.user_id === user?.id)?.role;
  const isOwner = Boolean(user && p.owner_id === user.id);
  const open = OPEN_STATUSES.has(p.review_status);
  const canUpload =
    !p.is_demo && (isOwner || role === "owner" || role === "admin" || role === "creator");
  const canEdit = !p.is_demo && open && (isOwner || role === "owner" || role === "admin");
  const result = resultOf(version);
  const statusLabel = t(`promo.reviewStatus.${p.review_status}` as TKey);

  return (
    <Tabs defaultValue="findings">
      <Page className="flex flex-col gap-5 pb-0 sm:pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold break-words sm:text-3xl" dir="auto">
              {p.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span data-testid="review-status">
                <Badge>{statusLabel}</Badge>
              </span>
              {result && (
                <StatusChip tone={result.tone} size="sm">
                  {t(result.key)}
                </StatusChip>
              )}
              {p.is_demo && <Badge variant="neutral">{t("common.demo")}</Badge>}
              {product && <Badge>{(lang === "en" && product.name_en) || product.name_ar}</Badge>}
            </div>
          </div>
          {canUpload && (
            <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
              {open ? (
                <Button asChild icon={<Upload />}>
                  <Link to="/new" search={{ promotion: p.id }}>
                    {t("promo.uploadNewVersion")}
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-fg-muted">
                  {t("promo.lockedHint", { status: statusLabel })}
                </p>
              )}
            </div>
          )}
        </div>

        <ReviewActions
          promotion={p}
          current={versions.at(-1) ?? null}
          me={{ userId: user?.id ?? null, orgRole: role ?? null, isOwner }}
        />

        {versions.length > 0 && (
          <nav aria-label={t("promo.versions")} className="flex flex-wrap items-center gap-2">
            {versions.map((x) => {
              const active = x.id === version?.id;
              return (
                <Button
                  key={x.id}
                  size="sm"
                  variant={active ? "primary" : "secondary"}
                  aria-current={active ? "page" : undefined}
                  onClick={() =>
                    void navigate({
                      to: "/promotions/$id",
                      params: { id: p.id },
                      search: { v: x.version_no ?? undefined },
                    })
                  }
                >
                  <bdi>{t("promo.versionShort", { n: x.version_no ?? 0 })}</bdi>
                  {x === versions.at(-1) && versions.length > 1 ? ` · ${t("promo.latest")}` : ""}
                </Button>
              );
            })}
          </nav>
        )}
        {missing && (
          <p role="status" className="text-sm text-amber-text">
            {t("promo.versionNotFound")}
          </p>
        )}
        {result && version?.status === "done" && (
          <p className="text-sm text-fg-muted" data-testid="advisory">
            {t("promo.advisory")}
          </p>
        )}

        <TabsList label={t("promo.versions")}>
          <TabsTrigger value="findings">{t("promo.tabFindings")}</TabsTrigger>
          <TabsTrigger value="info">{t("promo.tabInfo")}</TabsTrigger>
          <TabsTrigger value="comments">{t("promo.tabComments")}</TabsTrigger>
          <TabsTrigger value="compare">{t("promo.tabCompare")}</TabsTrigger>
          <TabsTrigger value="history">{t("review.history.title")}</TabsTrigger>
        </TabsList>
      </Page>

      <TabsContent value="findings">
        {version ? <CheckPage key={version.id} id={version.id} /> : null}
        {version && version.id === versions.at(-1)?.id && (
          <ResponsesPanel
            promotion={p}
            version={version}
            orgRole={role ?? null}
            userId={user?.id ?? null}
            isOwner={isOwner}
          />
        )}
      </TabsContent>
      <TabsContent value="comments">
        <Page narrow className="pt-6 sm:pt-6">
          {version && (
            <CommentsPanel
              promotion={p}
              version={version}
              versions={versions}
              orgRole={role ?? null}
              userId={user?.id ?? null}
            />
          )}
        </Page>
      </TabsContent>
      <TabsContent value="compare">
        <Page className="pt-6 sm:pt-6">
          <CompareTab versions={versions} />
        </Page>
      </TabsContent>
      <TabsContent value="history">
        <Page narrow className="pt-6 sm:pt-6">
          <HistoryPanel promotion={p} versions={versions} />
        </Page>
      </TabsContent>
      <TabsContent value="info">
        <Page narrow className="pt-6 sm:pt-6">
          <InfoPanel
            promotion={p}
            bundle={bundle}
            canEdit={canEdit}
            currentVersion={versions.at(-1) ?? null}
          />
          <div className="mt-4">
            <LinkedClaims
              promotion={p}
              current={versions.at(-1) ?? null}
              canLink={
                !p.is_demo &&
                (isOwner || ["owner", "admin", "reviewer", "creator"].includes(role ?? ""))
              }
            />
          </div>
        </Page>
      </TabsContent>
    </Tabs>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </div>
  );
}

function InfoPanel({
  promotion: p,
  bundle,
  canEdit,
  currentVersion,
}: {
  promotion: Promotion;
  bundle: PromotionBundle;
  canEdit: boolean;
  currentVersion: VersionSummary | null;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const products = useProducts(p.org_id);
  const [editing, setEditing] = useState(false);
  const [changed, setChanged] = useState(false);
  const [title, setTitle] = useState(p.title);
  const [caption, setCaption] = useState(p.caption ?? "");
  const [ctx, setCtx] = useState<ContextValue>({
    productId: p.product_id,
    channels: p.channels,
    communicationType: p.communication_type,
    audience: p.audience,
    isPaid: p.is_paid,
    distribution: p.distribution as ContextValue["distribution"],
    creatorLicenseNo: p.creator_license_no,
    reviewerNotes: p.reviewer_notes,
    deadlineAt: p.deadline_at,
  });
  const date = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")
      : t("common.none");
  const list = (xs: string[], prefix: string) =>
    xs.length ? xs.map((x) => t(`${prefix}.${x}` as TKey)).join("، ") : t("common.none");

  const save = useMutation({
    mutationFn: () => updatePromotionContext(p.id, { ...ctx, title, caption }),
    onSuccess: () => {
      toast.success(t("promo.contextSaved"));
      setEditing(false);
      if (currentVersion?.status === "done") setChanged(true);
      void qc.invalidateQueries({ queryKey: pk.promotion(p.id) });
      void qc.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: (e) => toast.error(t(`promo.errors.${dbErrorCode(e) ?? "forbidden"}` as TKey)),
  });
  const rerun = useMutation({
    mutationFn: () => rerunSubmission(currentVersion!.id),
    onSuccess: () => {
      toast.success(t("promo.rerunStarted"));
      setChanged(false);
      void qc.invalidateQueries({ queryKey: pk.promotion(p.id) });
      void qc.invalidateQueries({ queryKey: ["submission", currentVersion!.id] });
    },
    onError: () => toast.error(t("errors.generic")),
  });
  const canRerun = Boolean(user && currentVersion && currentVersion.user_id === user.id);

  return (
    <div className="flex flex-col gap-4">
      {changed && (
        <div
          role="status"
          data-testid="context-changed"
          className="flex flex-col gap-3 rounded-md border border-amber/30 bg-amber-bg p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-bold text-amber-text">{t("promo.contextChangedTitle")}</p>
            <p className="mt-1 text-fg">{t("promo.contextChangedBody")}</p>
          </div>
          {canRerun && (
            <Button icon={<RefreshCw />} loading={rerun.isPending} onClick={() => rerun.mutate()}>
              {t("promo.rerun")}
            </Button>
          )}
        </div>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t("promo.contextTitle")}</CardTitle>
          {canEdit && !editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              {t("promo.editContext")}
            </Button>
          )}
        </div>
        {editing ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Field label={t("promo.fieldTitle")}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                dir="auto"
              />
            </Field>
            <Field label={t("promo.fieldCaption")} optional optionalLabel={t("common.optional")}>
              <Textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                dir="auto"
              />
            </Field>
            {p.org_id && (
              <ContextFields value={ctx} onChange={setCtx} products={products.data ?? []} />
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {t("promo.saveContext")}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="divide-y divide-border">
            <InfoRow label={t("promo.product")}>
              {bundle.product
                ? (lang === "en" && bundle.product.name_en) || bundle.product.name_ar
                : t("promo.noProduct")}
            </InfoRow>
            <InfoRow label={t("promo.communicationType")}>
              {t(`promo.commType.${p.communication_type}` as TKey)}
            </InfoRow>
            <InfoRow label={t("promo.channels")}>{list(p.channels, "promo.channel")}</InfoRow>
            <InfoRow label={t("promo.audience")}>{list(p.audience, "promo.audienceOpt")}</InfoRow>
            <InfoRow label={t("promo.paid")}>
              {p.is_paid === null
                ? t("promo.unknown")
                : p.is_paid
                  ? t("common.yes")
                  : t("common.no")}
            </InfoRow>
            <InfoRow label={t("promo.distribution")}>
              {p.distribution
                ? t(`promo.distributionOpt.${p.distribution}` as TKey)
                : t("promo.unknown")}
            </InfoRow>
            {p.creator_license_no && (
              <InfoRow label={t("promo.creatorLicense")}>
                <bdi>{p.creator_license_no}</bdi>
              </InfoRow>
            )}
            <InfoRow label={t("promo.deadline")}>{date(p.deadline_at)}</InfoRow>
            <InfoRow label={t("promo.fieldCaption")}>
              <span dir="auto" className="whitespace-pre-wrap">
                {p.caption || t("common.none")}
              </span>
            </InfoRow>
            <InfoRow label={t("promo.reviewerNotes")}>
              <span dir="auto" className="whitespace-pre-wrap">
                {p.reviewer_notes || t("common.none")}
              </span>
            </InfoRow>
            <InfoRow label={t("promo.fieldCreated")}>{date(p.created_at)}</InfoRow>
            <InfoRow label={t("promo.fieldUpdated")}>{date(p.updated_at)}</InfoRow>
          </dl>
        )}
      </Card>
    </div>
  );
}
