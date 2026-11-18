import { Link, useSearch } from "@tanstack/react-router";
import { ApiErrorState } from "@/components/feedback/ApiErrorState";
import { Megaphone, Plus, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatusChip,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import {
  CHANNELS,
  COMMUNICATION_TYPES,
  REVIEW_STATUSES,
  usePromotions,
  type CommunicationType,
  type PromotionFilters,
  type ReviewStatus,
} from "@/lib/api/promotions";
import { resultOf } from "./model";
import { SavedViewsBar } from "@/features/libraries/SavedViewsBar";
import { promotionRows } from "@/features/libraries/model";

export function PromotionsListPage() {
  const { t, lang } = useI18n();
  const search = useSearch({ from: "/_app/promotions/" });
  const [status, setStatus] = useState<ReviewStatus | "">(
    REVIEW_STATUSES.includes(search.status as ReviewStatus) ? (search.status as ReviewStatus) : "",
  );
  const [productId, setProductId] = useState("");
  const [channel, setChannel] = useState("");
  const [communicationType, setCommunicationType] = useState<CommunicationType | "">("");
  const [q, setQ] = useState("");
  const filters: PromotionFilters = { status, productId, channel, communicationType, q };
  const list = usePromotions(filters);
  const all = usePromotions({});
  const productOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of all.data ?? [])
      if (p.product) m.set(p.product.id, (lang === "en" && p.product.name_en) || p.product.name_ar);
    return [...m.entries()];
  }, [all.data, lang]);
  const filtered = Boolean(status || productId || channel || communicationType || q.trim());
  const date = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")
      : "—";

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("promo.listTitle")}
        description={t("promo.listSubtitle")}
        actions={
          <Button asChild icon={<Plus />}>
            <Link to="/new">{t("promo.newPromotion")}</Link>
          </Button>
        }
      />

      <SavedViewsBar
        scope="promotions"
        filters={filters as unknown as Record<string, unknown>}
        apply={(f) => {
          setStatus(
            REVIEW_STATUSES.includes(f["status"] as ReviewStatus)
              ? (f["status"] as ReviewStatus)
              : "",
          );
          setProductId(typeof f["productId"] === "string" ? f["productId"] : "");
          setChannel(typeof f["channel"] === "string" ? f["channel"] : "");
          setCommunicationType(
            typeof f["communicationType"] === "string"
              ? (f["communicationType"] as CommunicationType | "")
              : "",
          );
          setQ(typeof f["q"] === "string" ? f["q"] : "");
        }}
        orgId={(all.data ?? []).find((p) => p.org_id)?.org_id ?? null}
        rows={() => promotionRows(list.data ?? [])}
        fileName="saleem-promotions.csv"
      />

      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={t("common.search")} className="lg:col-span-1">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("promo.searchPlaceholder")}
            dir="auto"
          />
        </Field>
        <Field label={t("promo.filterStatus")}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus | "")}>
            <option value="">{t("promo.allOption")}</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`promo.reviewStatus.${s}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("promo.filterProduct")}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{t("promo.allOption")}</option>
            {productOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("promo.filterChannel")}>
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">{t("promo.allOption")}</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {t(`promo.channel.${c}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("promo.filterType")}>
          <Select
            value={communicationType}
            onChange={(e) => setCommunicationType(e.target.value as CommunicationType | "")}
          >
            <option value="">{t("promo.allOption")}</option>
            {COMMUNICATION_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`promo.commType.${c}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : list.isError ? (
        <ApiErrorState
          title={t("promo.loadError")}
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<SearchX />}
            title={t("promo.noMatchesTitle")}
            body={t("promo.noMatchesBody")}
          />
        ) : (
          <EmptyState
            icon={<Megaphone />}
            title={t("promo.emptyTitle")}
            body={t("promo.emptyBody")}
            action={
              <Button asChild icon={<Plus />}>
                <Link to="/new">{t("promo.newPromotion")}</Link>
              </Button>
            }
          />
        )
      ) : (
        <ul className="flex flex-col gap-3" data-testid="promotion-list">
          {list.data.map((p) => {
            const r = resultOf(p.current);
            return (
              <li key={p.id}>
                <Link
                  to="/promotions/$id"
                  params={{ id: p.id }}
                  className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold break-words text-fg" dir="auto">
                        {p.title}
                      </p>
                      <p className="mt-1 text-sm text-fg-muted">
                        {p.product
                          ? (lang === "en" && p.product.name_en) || p.product.name_ar
                          : t("promo.noProduct")}
                        {p.channels.length > 0 &&
                          ` · ${p.channels.map((c) => t(`promo.channel.${c}` as TKey)).join("، ")}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{t(`promo.reviewStatus.${p.review_status}` as TKey)}</Badge>
                      {r && (
                        <StatusChip tone={r.tone} size="sm">
                          {t(r.key)}
                        </StatusChip>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                    {p.current?.version_no && (
                      <span>
                        {t("promo.colVersion")}: <bdi>{p.current.version_no}</bdi>
                      </span>
                    )}
                    {p.deadline_at && (
                      <span>
                        {t("promo.colDeadline")}: {date(p.deadline_at)}
                      </span>
                    )}
                    <span>
                      {t("promo.colUpdated")}: {date(p.updated_at)}
                    </span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
