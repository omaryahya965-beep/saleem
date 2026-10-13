import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronLeft,
  FileImage,
  FileText,
  Film,
  LayoutList,
  Plus,
  Search,
  SearchX,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Page,
  PageHeader,
  Skeleton,
  StatusChip,
  Tabs,
  TabsList,
  TabsTrigger,
  type StatusTone,
} from "@/components/ui";
import { formatClock, useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import type { DashboardFilter, SubmissionListItem } from "@/lib/api/data";
import { useSubmissions } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const FILTERS: { value: DashboardFilter; label: TKey }[] = [
  { value: "all", label: "common.all" },
  { value: "needs_fixes", label: "status.needs_fixes" },
  { value: "review", label: "status.review" },
  { value: "ready", label: "status.ready" },
  { value: "processing", label: "status.processing" },
  { value: "failed", label: "status.failed" },
];

export function statusOf(s: { status: string; overall_status: string | null }): {
  tone: StatusTone;
  key: TKey;
} {
  if (s.status === "failed") return { tone: "neutral", key: "status.failed" };
  if (s.status !== "done") return { tone: "processing", key: "status.processing" };
  if (s.overall_status === "needs_fixes") return { tone: "violation", key: "status.needs_fixes" };
  if (s.overall_status === "review") return { tone: "warning", key: "status.review" };
  return { tone: "ready", key: "status.ready" };
}

function Thumb({ item }: { item: SubmissionListItem }) {
  const Icon = item.kind === "video" ? Film : item.kind === "image" ? FileImage : FileText;
  return (
    <span className="relative grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-ink text-mint">
      {item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <Icon aria-hidden="true" className="size-5" />
      )}
      {item.duration_seconds ? (
        <span className="tabular absolute inset-x-0 bottom-0 bg-ink/75 text-center text-[10px] leading-4 text-white">
          {formatClock(Number(item.duration_seconds))}
        </span>
      ) : null}
    </span>
  );
}

function Row({ item }: { item: SubmissionListItem }) {
  const { t, formatDate } = useI18n();
  const st = statusOf(item);
  return (
    <li>
      <Link
        to="/checks/$id"
        params={{ id: item.id }}
        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-sunken sm:px-5 md:grid-cols-[auto_minmax(0,1fr)_140px_160px_150px_auto]"
      >
        <Thumb item={item} />
        <span className="min-w-0">
          <span dir="auto" className="block truncate font-medium text-fg">
            {item.title || t("dashboard.untitled")}
          </span>
          <span className="block truncate text-sm text-fg-muted md:hidden">
            {t(`platforms.${item.platform}`)} · {formatDate(item.created_at)}
          </span>
          {item.is_demo && (
            <Badge variant="outline" className="mt-1">
              {t("common.demo")}
            </Badge>
          )}
        </span>
        <span className="hidden text-sm text-fg md:block">{t(`platforms.${item.platform}`)}</span>
        <span className="hidden text-sm text-fg-muted md:block">{formatDate(item.created_at)}</span>
        <span className="col-start-2 md:col-start-auto">
          <StatusChip tone={st.tone} size="sm">
            {t(st.key)}
          </StatusChip>
        </span>
        <ChevronLeft
          aria-hidden="true"
          className="row-span-2 size-5 text-fg-muted transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 md:row-span-1"
        />
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul aria-hidden="true" className="divide-y divide-border">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex items-center gap-4 px-5 py-3">
          <Skeleton className="h-16 w-12" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </span>
          <Skeleton className="h-6 w-24 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { t, tn } = useI18n();
  const { user, ready } = useAuth();
  const navigate = useNavigate({ from: "/dashboard" });
  const search = useSearch({ from: "/_app/dashboard" });
  const filter = search.status ?? "all";
  const page = search.page ?? 1;
  const [term, setTerm] = useState(search.q ?? "");

  // Debounce the search box into the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      if ((search.q ?? "") !== term)
        void navigate({
          search: (s) => ({ ...s, q: term || undefined, page: undefined }),
          replace: true,
        });
    }, 300);
    return () => clearTimeout(id);
  }, [term, search.q, navigate]);

  const list = useSubmissions(
    {
      userId: user?.id ?? null,
      filter,
      search: search.q ?? "",
      page,
      pageSize: PAGE_SIZE,
    },
    ready,
  );
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = filter !== "all" || Boolean(search.q);

  const newButton = (
    <Button asChild>
      <Link to="/new">
        <Plus aria-hidden="true" />
        {t("nav.newCheck")}
      </Link>
    </Button>
  );

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle")}
        actions={newButton}
      />

      <div className="flex flex-col gap-3">
        <label className="relative block max-w-md">
          <span className="sr-only">{t("dashboard.searchLabel")}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-fg-muted"
          />
          <Input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("dashboard.searchPlaceholder")}
            className="ps-10"
          />
        </label>
        <Tabs
          value={filter}
          onValueChange={(v) =>
            void navigate({
              search: (s) => ({
                ...s,
                status: v === "all" ? undefined : (v as DashboardFilter),
                page: undefined,
              }),
            })
          }
        >
          <TabsList label={t("dashboard.filtersLabel")}>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {t(f.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {list.isError ? (
        <ErrorState
          title={t("dashboard.loadError")}
          body={t("errors.network")}
          retryLabel={t("common.retry")}
          onRetry={() => void list.refetch()}
        />
      ) : list.isPending ? (
        <Card padded={false}>
          <ListSkeleton />
        </Card>
      ) : list.data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<SearchX />}
            title={t("dashboard.emptyFilteredTitle")}
            body={t("dashboard.emptyFilteredBody")}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setTerm("");
                  void navigate({ search: {} });
                }}
              >
                {t("dashboard.clearFilters")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<LayoutList />}
            title={t("dashboard.emptyTitle")}
            body={t("dashboard.emptyBody")}
            action={newButton}
          />
        )
      ) : (
        <Card
          padded={false}
          className={cn(
            "overflow-hidden transition-opacity",
            list.isPlaceholderData && "opacity-60",
          )}
        >
          <div
            aria-hidden="true"
            className="hidden grid-cols-[48px_minmax(0,1fr)_140px_160px_150px_20px] gap-x-4 border-b border-border bg-sunken px-5 py-2.5 text-xs font-medium text-fg-muted md:grid"
          >
            <span />
            <span>{t("dashboard.colContent")}</span>
            <span>{t("dashboard.colPlatform")}</span>
            <span>{t("dashboard.colDate")}</span>
            <span>{t("dashboard.colStatus")}</span>
          </div>
          <ul className="divide-y divide-border">
            {list.data.items.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </ul>
        </Card>
      )}

      {list.data && total > 0 && (
        <nav
          aria-label={t("common.pageOf", { page, total: pages })}
          className="flex items-center justify-between gap-4"
        >
          <span className="text-sm text-fg-muted">{tn("count.checks", total)}</span>
          {pages > 1 && (
            <span className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  void navigate({
                    search: (s) => ({ ...s, page: page - 1 > 1 ? page - 1 : undefined }),
                  })
                }
              >
                {t("common.previous")}
              </Button>
              <span className="tabular text-sm text-fg-muted">
                {t("common.pageOf", { page, total: pages })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => void navigate({ search: (s) => ({ ...s, page: page + 1 }) })}
              >
                {t("common.next")}
              </Button>
            </span>
          )}
        </nav>
      )}
    </Page>
  );
}
