import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  Info,
  Landmark,
  ScrollText,
  Search,
  SearchX,
} from "lucide-react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ApiErrorState } from "@/components/feedback/ApiErrorState";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatusChip,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useRulebook } from "@/lib/api/hooks";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  AUTHORITY_NAMES,
  displayStatus,
  enrichRules,
  type DisplayStatus,
  type EnrichedRule,
  type PackRow,
  type SourceRow,
} from "./enrich";

// D216: packs and sources are public (RLS: anon + authenticated); they give each database rule its authority,
// sector and source verification.
const untyped = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
const usePacks = () =>
  useQuery({
    queryKey: ["rulebook-packs"],
    queryFn: async () => {
      const { data, error } = await untyped
        .from("rule_packs")
        .select("code, authority, name_ar, name_en");
      if (error) throw error;
      return (data ?? []) as unknown as PackRow[];
    },
    staleTime: 10 * 60_000,
  });
const useSources = () =>
  useQuery({
    queryKey: ["rulebook-sources"],
    queryFn: async () => {
      const { data, error } = await untyped
        .from("regulatory_sources")
        .select("id, authority, title_ar, title_en, url, status, verification");
      if (error) throw error;
      return (data ?? []) as unknown as SourceRow[];
    },
    staleTime: 10 * 60_000,
  });

/** Authority order in the rulebook (the four most used first). */
const AUTHORITY_ORDER = [
  "GMEDIA",
  "MC",
  "SAMA",
  "SFDA",
  "CMA",
  "REGA",
  "SDAIA",
  "IA",
  "MT",
  "MOHU",
  "INTERNAL",
] as const;

const STATUSES: (DisplayStatus | "all")[] = [
  "all",
  "active",
  "needs_review",
  "verifying",
  "superseded",
  "archived",
];

const SECTORS = [
  { id: "all", ar: "كل القطاعات", en: "All sectors" },
  { id: "BANK", ar: "الخدمات المالية والمصرفية", en: "Banking & Finance" },
  { id: "CMA", ar: "السوق والأوراق المالية", en: "Capital Market" },
  { id: "GEN", ar: "التجارة الإلكترونية العامة", en: "E-Commerce" },
  { id: "SALE", ar: "التخفيضات التجارية", en: "Discounts & Sales" },
  { id: "COMP", ar: "المسابقات والجوائز", en: "Contests & Prizes" },
  { id: "MEDIA", ar: "الإعلام والمؤثرون (موثوق)", en: "Media & Mawthooq" },
  { id: "RE", ar: "العقار والتسويق العقاري", en: "Real Estate" },
  { id: "FOOD", ar: "الغذاء والأعلاف", en: "Food & Feed" },
  { id: "DRUG", ar: "الأدوية والمستحضرات", en: "Drugs & Pharma" },
  { id: "DEV", ar: "الأجهزة الطبية", en: "Medical Devices" },
  { id: "COS", ar: "منتجات التجميل", en: "Cosmetics" },
  { id: "TR", ar: "السياحة والسفر", en: "Tourism & Travel" },
  { id: "HOT", ar: "مرافق الضيافة", en: "Hospitality" },
  { id: "PD", ar: "حماية البيانات والتسويق", en: "Data Protection" },
  { id: "AI", ar: "الذكاء الاصطناعي والتزييف العميق", en: "AI & Deepfakes" },
  { id: "INS", ar: "التأمين", en: "Insurance" },
  { id: "HAJ", ar: "الحج والعمرة", en: "Hajj & Umrah" },
  { id: "SYS", ar: "فحوص سَليم الداخلية", en: "System checks" },
] as const;

const STATUS_BADGE: Record<DisplayStatus, "green" | "amber" | "neutral" | "outline"> = {
  active: "green",
  needs_review: "amber",
  verifying: "neutral",
  superseded: "outline",
  archived: "outline",
};

/**
 * Regulatory rulebook (D216–D219): every rule of the active rulebook, grouped in one collapsible section per
 * authority (name, total, active and not-yet-active counts), all collapsed at first; search and the authority
 * filter open the matching sections. Each rule expands in place for its article, explanation, applicability,
 * official source and verification. Reference only: browsing never changes which rules an analysis applies
 * (only «سارية» rules, of every authority, automatically).
 */
export function RulebookPage() {
  const { t, lang } = useI18n();
  const en = lang === "en";
  const book = useRulebook();
  const searchParams = useSearch({ strict: false }) as { q?: string } | undefined;

  const [q, setQ] = useState(searchParams?.q || "");
  const [authority, setAuthority] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sector, setSector] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  // D211: the personal workspace has no company rules.
  const personal = useOrgPicker().mode === "personal";

  const packs = usePacks();
  const sources = useSources();
  const loading = book.isPending || packs.isPending || sources.isPending;
  const failed = book.isError || packs.isError || sources.isError;
  const sectorLabel = (code: string) => {
    const s = SECTORS.find((x) => x.id === code);
    return s ? (en ? s.en : s.ar) : "";
  };
  // D216: database rules mapped to authority, sector and source verification (see enrich.ts).
  const rules: (EnrichedRule & { display: DisplayStatus })[] = useMemo(() => {
    if (!book.data || !packs.data || !sources.data) return [];
    return enrichRules(
      book.data.rules as unknown as Record<string, unknown>[],
      packs.data,
      sources.data,
      () => "",
    ).map((r) => ({ ...r, display: displayStatus(r) }));
  }, [book.data, packs.data, sources.data]);

  const stats = useMemo(() => {
    const by = (s: DisplayStatus) => rules.filter((r) => r.display === s).length;
    const authorities = new Set(
      rules.map((r) => String(r.authority)).filter((a) => !["INTERNAL", "OTHER"].includes(a)),
    );
    return {
      total: rules.length,
      active: by("active"),
      verifying: by("verifying"),
      needsReview: by("needs_review"),
      authorities: authorities.size,
    };
  }, [rules]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rules.filter((r) => {
      if (term) {
        const names = AUTHORITY_NAMES[String(r.authority)];
        const hay = [
          r.code,
          r.title_ar,
          r.title_en,
          r.description_ar,
          r.description_en,
          r.source_name,
          r.article_ref,
          r.authority,
          names?.ar,
          names?.en,
          sectorLabel(r.sector_code),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (authority !== "all" && r.authority !== authority) return false;
      if (status !== "all" && r.display !== status) return false;
      if (sector !== "all" && r.sector_code !== sector) return false;
      if (severity !== "all" && r.default_severity !== severity) return false;
      return true;
    });
    // sectorLabel only depends on lang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, q, authority, status, sector, severity, lang]);

  const groups = useMemo(() => {
    const by = new Map<string, typeof filtered>();
    for (const r of filtered)
      by.set(String(r.authority), [...(by.get(String(r.authority)) ?? []), r]);
    const rank = (a: string) => {
      const i = (AUTHORITY_ORDER as readonly string[]).indexOf(a);
      return i < 0 ? 99 : i;
    };
    return [...by.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([code, list]) => ({
        code,
        name: AUTHORITY_NAMES[code] ? AUTHORITY_NAMES[code][en ? "en" : "ar"] : code,
        rules: list,
        active: list.filter((r) => r.display === "active").length,
        pending: list.filter((r) => r.display === "needs_review" || r.display === "verifying")
          .length,
        archived: list.filter((r) => r.display === "archived" || r.display === "superseded").length,
      }));
  }, [filtered, en]);

  // Sections start collapsed. While searching (or filtering one authority) the matching sections open; the user can
  // still close any of them. Clearing the search returns to the user's own choice.
  const searching = q.trim() !== "" || authority !== "all";
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [closedInSearch, setClosedInSearch] = useState<Set<string>>(new Set());
  const isOpen = (a: string) => (searching ? !closedInSearch.has(a) : expanded.has(a));
  const toggle = (a: string) => {
    const flip = (cur: Set<string>) => {
      const next = new Set(cur);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    };
    if (searching) setClosedInSearch(flip);
    else setExpanded(flip);
  };
  const allOpen = groups.length > 0 && groups.every((g) => isOpen(g.code));
  const setAll = (open: boolean) => {
    if (searching) setClosedInSearch(open ? new Set() : new Set(groups.map((g) => g.code)));
    else setExpanded(open ? new Set(groups.map((g) => g.code)) : new Set());
  };
  const filtersOn =
    q || authority !== "all" || status !== "all" || sector !== "all" || severity !== "all";

  const version = book.data?.version?.version_label;

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("rulebook.title")}
        description={t("rulebook.subtitle")}
        eyebrow={
          version ? <Badge variant="green">{t("rulebook.version", { v: version })}</Badge> : null
        }
        actions={
          personal ? undefined : (
            <Button asChild variant="secondary" icon={<ScrollText />}>
              <Link to="/company-rules">{t("rulebook.addCompanyRules")}</Link>
            </Button>
          )
        }
      />

      {/* Material limitation, said once and plainly */}
      <p
        className="flex items-start gap-2.5 rounded-[14px] border border-green/15 bg-green-bg/50 px-4 py-3 text-sm leading-relaxed text-fg"
        data-testid="rulebook-browse-only"
      >
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green" />
        {t("rulebook.notice")}
      </p>

      {/* Database-driven counts */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="rulebook-stats">
        <Stat label={t("rulebook.stat.total")} value={stats.total} loading={loading} />
        <Stat
          label={t("rulebook.stat.active")}
          hint={t("rulebook.stat.activeHint")}
          value={stats.active}
          tone="text-green"
          loading={loading}
          testId="stat-active"
        />
        <Stat
          label={t("rulebook.stat.needsReview")}
          hint={t("rulebook.stat.needsReviewHint")}
          value={stats.needsReview}
          tone="text-amber-text"
          loading={loading}
          testId="stat-needs-review"
        />
        <Stat
          label={t("rulebook.stat.verifying")}
          hint={t("rulebook.stat.verifyingHint")}
          value={stats.verifying}
          loading={loading}
          testId="stat-verifying"
        />
        <Stat
          label={t("rulebook.stat.authorities")}
          value={stats.authorities}
          loading={loading}
          className="col-span-2 lg:col-span-1"
        />
      </dl>

      {/* Search and filters (browsing only) */}
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">{t("rulebook.searchLabel")}</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-fg-muted"
            />
            <Input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setClosedInSearch(new Set());
              }}
              placeholder={t("rulebook.searchPlaceholder")}
              className="ps-10"
              data-testid="rulebook-search"
            />
          </label>
          {filtersOn && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQ("");
                setAuthority("all");
                setStatus("all");
                setSector("all");
                setSeverity("all");
                setClosedInSearch(new Set());
              }}
            >
              {t("rulebook.filter.reset")}
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            id="rb-authority"
            label={t("rulebook.filterAuthority")}
            value={authority}
            onChange={(v) => {
              setAuthority(v);
              setClosedInSearch(new Set());
            }}
            options={[
              ["all", t("rulebook.filter.allAuthorities")],
              ...AUTHORITY_ORDER.map(
                (a) => [a, `${AUTHORITY_NAMES[a]![en ? "en" : "ar"]} (${a})`] as [string, string],
              ),
            ]}
          />
          <FilterSelect
            id="rb-status"
            label={t("rulebook.filterStatus")}
            value={status}
            onChange={setStatus}
            options={STATUSES.map((s) => [
              s,
              s === "all" ? t("rulebook.filter.allStatuses") : t(`rulebook.display.${s}` as TKey),
            ])}
          />
          <FilterSelect
            id="rb-sector"
            label={t("rulebook.filterSector")}
            value={sector}
            onChange={setSector}
            options={SECTORS.map((s) => [s.id, en ? s.en : s.ar])}
          />
          <FilterSelect
            id="rb-severity"
            label={t("rulebook.filterSeverity")}
            value={severity}
            onChange={setSeverity}
            options={[
              ["all", t("rulebook.all")],
              ["violation", t("rulebook.filter.violation")],
              ["warning", t("rulebook.filter.warning")],
            ]}
          />
        </div>
      </Card>

      {failed ? (
        <ApiErrorState
          title={t("rulebook.loadError")}
          error={book.error ?? packs.error ?? sources.error}
          onRetry={() => {
            void book.refetch();
            void packs.refetch();
            void sources.refetch();
          }}
        />
      ) : loading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-[16px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<SearchX />} title={t("rulebook.noResults")} />
      ) : (
        <section className="flex flex-col gap-3" aria-label={t("rulebook.title")}>
          <div className="flex items-center justify-between gap-2 text-sm text-fg-muted">
            <span aria-live="polite" data-testid="rulebook-showing">
              {t("rulebook.showing", { n: filtered.length, total: rules.length })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon={allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
              onClick={() => setAll(!allOpen)}
              data-testid="rulebook-toggle-all"
            >
              {allOpen ? t("rulebook.collapseAll") : t("rulebook.expandAll")}
            </Button>
          </div>

          <div className="flex flex-col gap-2.5" data-testid="rule-results">
            {groups.map((g) => {
              const open = isOpen(g.code);
              return (
                <section
                  key={g.code}
                  className={cn(
                    "overflow-hidden rounded-[18px] border bg-card transition-colors",
                    open
                      ? "border-green/30 shadow-[0_8px_24px_-18px_rgb(7_33_26/0.5)]"
                      : "border-border",
                  )}
                  data-testid={`rule-group-${g.code}`}
                >
                  <h2>
                    <button
                      type="button"
                      id={`rule-group-head-${g.code}`}
                      aria-expanded={open}
                      aria-controls={`rule-group-panel-${g.code}`}
                      onClick={() => toggle(g.code)}
                      data-testid={`rule-group-toggle-${g.code}`}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 text-start outline-none hover:bg-sunken/40 focus-visible:bg-sunken/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green sm:px-5"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-green-bg text-green [&_svg]:size-5">
                        <Landmark aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold text-fg">{g.name}</span>
                        <span className="font-mono text-xs text-fg-muted" dir="ltr">
                          {g.code === "INTERNAL" ? "SALEEM" : g.code}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant="outline">
                          {t("rulebook.group.total", { n: g.rules.length })}
                        </Badge>
                        {g.active > 0 ? (
                          <Badge variant="green">
                            {t("rulebook.group.active", { n: g.active })}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">{t("rulebook.group.none")}</Badge>
                        )}
                        {g.pending > 0 && (
                          <Badge variant="amber">
                            {t("rulebook.group.pending", { n: g.pending })}
                          </Badge>
                        )}
                        {g.archived > 0 && (
                          <Badge variant="outline">
                            {t("rulebook.group.archived", { n: g.archived })}
                          </Badge>
                        )}
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "size-5 shrink-0 text-fg-muted transition-transform duration-200",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                  </h2>
                  {open && (
                    <ul
                      id={`rule-group-panel-${g.code}`}
                      role="region"
                      aria-labelledby={`rule-group-head-${g.code}`}
                      className="flex flex-col divide-y divide-border border-t border-border"
                    >
                      {g.rules.map((r) => (
                        <RuleRow key={r.code} rule={r} sectorLabel={sectorLabel(r.sector_code)} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}
    </Page>
  );
}

function Stat({
  label,
  hint,
  value,
  tone = "text-fg",
  loading,
  className,
  testId,
}: {
  label: string;
  hint?: string;
  value: number;
  tone?: string;
  loading: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-[16px] border border-border bg-card p-4",
        className,
      )}
      data-testid={testId}
    >
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className={cn("text-2xl font-bold tabular-nums", tone)}>
        {loading ? <Skeleton className="h-8 w-12" /> : value}
      </dd>
      {hint && <dd className="text-[11px] leading-snug text-fg-muted">{hint}</dd>}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** One rule: code, status, severity, title, article and source; expands in place for the full record. */
function RuleRow({
  rule: r,
  sectorLabel,
}: {
  rule: EnrichedRule & { display: DisplayStatus };
  sectorLabel: string;
}) {
  const { t, lang } = useI18n();
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const none = <span className="text-fg-muted italic">{t("rulebook.rule.notSpecified")}</span>;
  const title = (en && r.title_en) || r.title_ar;
  const explanation = en
    ? r.description_en || r.summary_en || r.description_ar || r.summary_ar
    : r.description_ar || r.summary_ar;
  const panel = `rule-panel-${r.code}`;
  return (
    <li className="px-4 py-3.5 sm:px-5" data-testid={`rule-${r.code}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge mono className="font-semibold">
              {r.code}
            </Badge>
            <span data-testid="rule-status" className="contents">
              <Badge variant={STATUS_BADGE[r.display]}>
                {t(`rulebook.display.${r.display}` as TKey)}
              </Badge>
            </span>
            {sectorLabel && <span className="text-fg-muted">· {sectorLabel}</span>}
          </div>
          <h3 className="leading-snug font-bold text-fg" dir="auto">
            {title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
            {r.article_ref && (
              <span>
                {t("rulebook.rule.article")}:{" "}
                <span className="font-medium text-fg" dir="auto">
                  {r.article_ref}
                </span>
              </span>
            )}
            {r.source_url ? (
              <a
                href={r.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-sm text-green hover:underline focus-visible:outline-2 focus-visible:outline-green"
              >
                {(en && r.source_name_en) || r.source_name || t("rulebook.rule.officialSource")}
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            ) : (
              r.source_name && <span>{(en && r.source_name_en) || r.source_name}</span>
            )}
            {r.source_verification && (
              <span data-testid="rule-verification">
                <Badge variant="outline" className="text-[11px]">
                  {t(`findingType.verification.${r.source_verification}` as TKey)}
                </Badge>
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end">
          <StatusChip tone={r.default_severity} size="sm">
            {t(`severity.${r.default_severity}`)}
          </StatusChip>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panel}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-green hover:bg-green-bg focus-visible:outline-2 focus-visible:outline-green"
            data-testid="rule-details-toggle"
          >
            {open ? t("rulebook.rule.less") : t("rulebook.rule.more")}
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4 transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
      </div>
      {open && (
        <dl
          id={panel}
          className="mt-3 grid gap-3 rounded-[14px] bg-sunken/60 p-4 text-sm sm:grid-cols-2"
          data-testid="rule-details"
        >
          <Field label={t("rulebook.explanation")} wide>
            {explanation ? <span dir="auto">{explanation}</span> : none}
          </Field>
          <Field label={t("rulebook.applicability")} wide>
            {r.applicability_ar ? (
              <span dir="auto" lang="ar">
                {r.applicability_ar}
              </span>
            ) : (
              none
            )}
          </Field>
          {r.official_text_ar && (
            <Field label={t("rulebook.rule.officialText")} wide>
              <blockquote
                dir="rtl"
                lang="ar"
                className="border-s-2 border-green/40 ps-3 leading-loose text-fg"
                data-testid="rule-official-text"
              >
                {r.official_text_ar}
              </blockquote>
            </Field>
          )}
          <Field label={t("rulebook.rule.article")}>
            {r.article_ref ? <span dir="auto">{r.article_ref}</span> : none}
          </Field>
          <Field label={t("rulebook.rule.officialSource")}>
            {r.source_url ? (
              <a
                href={r.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-green hover:underline"
              >
                {(en && r.source_name_en) || r.source_name || t("rulebook.rule.openSource")}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : (
              r.source_name || none
            )}
          </Field>
          <Field label={t("rulebook.rule.verification")}>
            {r.source_verification
              ? t(`findingType.verification.${r.source_verification}` as TKey)
              : none}
          </Field>
          <Field label={t("rulebook.filterStatus")}>
            {t(`rulebook.display.${r.display}` as TKey)}
            {r.display !== "active" && (
              <span className="block text-xs text-fg-muted">{t("rulebook.rule.notApplied")}</span>
            )}
          </Field>
          <Field label={t("rulebook.rule.severity")}>{t(`severity.${r.default_severity}`)}</Field>
          {r.legal_reviewed_by && (
            <Field label={t("rulebook.rule.reviewedBy")}>
              <span dir="auto">{r.legal_reviewed_by}</span>
              {r.legal_reviewed_at && (
                <span className="block text-xs text-fg-muted" dir="ltr">
                  {r.legal_reviewed_at.slice(0, 10)}
                </span>
              )}
            </Field>
          )}
          {r.check_mode && (
            <Field label={t("rulebook.howWeCheck")}>
              {t(`rulebook.checkMode.${r.check_mode}` as TKey)}
            </Field>
          )}
          {r.evidence_policy_ar && (
            <Field label={t("rulebook.evidencePolicy")} wide>
              <span dir="auto" lang="ar">
                {r.evidence_policy_ar}
              </span>
            </Field>
          )}
          {r.superseded_note && (
            <Field label={t("rulebook.reconciliationNote")} wide>
              <span dir="auto">{r.superseded_note}</span>
            </Field>
          )}
          {r.last_verified_at && (
            <Field label={t("rulebook.rule.lastVerified")}>{r.last_verified_at}</Field>
          )}
        </dl>
      )}
    </li>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", wide && "sm:col-span-2")}>
      <dt className="text-xs font-semibold text-fg-muted">{label}</dt>
      <dd className="leading-relaxed text-fg">{children}</dd>
    </div>
  );
}
