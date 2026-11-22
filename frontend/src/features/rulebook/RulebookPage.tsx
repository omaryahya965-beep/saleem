import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  Filter,
  Info,
  Layers,
  Plus,
  Scale,
  ScrollText,
  Search,
  SearchX,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ApiErrorState } from "@/components/feedback/ApiErrorState";
import {
  Badge,
  Button,
  Card,
  Dialog,
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
import { AuthorityCoveragePanel } from "@/features/personal/RegulatoryCoverage";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { enrichRules, type EnrichedRule, type PackRow, type SourceRow } from "./enrich";

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

const AUTHORITIES = [
  { id: "all", ar: "كافة الجهات", en: "All Authorities" },
  { id: "SAMA", ar: "البنك المركزي السعودي (SAMA)", en: "Saudi Central Bank (SAMA)" },
  { id: "CMA", ar: "هيئة السوق المالية (CMA)", en: "Capital Market Authority (CMA)" },
  { id: "MC", ar: "وزارة التجارة (MC)", en: "Ministry of Commerce (MC)" },
  { id: "GMEDIA", ar: "هيئة تنظيم الإعلام (GMEDIA)", en: "General Media Authority (GMEDIA)" },
  { id: "SFDA", ar: "الغذاء والدواء (SFDA)", en: "Saudi FDA (SFDA)" },
  { id: "REGA", ar: "الهيئة العامة للعقار (REGA)", en: "Real Estate Authority (REGA)" },
  { id: "SDAIA", ar: "سدايا (SDAIA)", en: "SDAIA (Data & AI)" },
  { id: "MT", ar: "وزارة السياحة (MT)", en: "Ministry of Tourism (MT)" },
  { id: "MOHU", ar: "وزارة الحج والعمرة (MOHU)", en: "Hajj & Umrah (MOHU)" },
  { id: "IA", ar: "هيئة التأمين (IA)", en: "Insurance Authority (IA)" },
  { id: "INTERNAL", ar: "فحوص سَليم الداخلية", en: "SALEEM system checks" },
] as const;

const STATUSES = [
  { id: "all", ar: "كافة الحالات", en: "All Statuses" },
  { id: "active", ar: "سارية ومطبقة", en: "Active & Enforced" },
  { id: "pending_review", ar: "قيد المراجعة القانونية", en: "Pending Legal Review" },
  { id: "draft", ar: "مسودة بحثية", en: "Research Draft" },
  { id: "superseded", ar: "مستبدلة بمرجع رسمي", en: "Superseded" },
  { id: "archived", ar: "مؤرشفة / معطّلة", en: "Archived" },
] as const;

const SECTORS = [
  { id: "all", ar: "كافة القطاعات", en: "All Sectors" },
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

export function RulebookPage() {
  const { t, lang } = useI18n();
  const book = useRulebook();
  const searchParams = useSearch({ strict: false }) as { q?: string } | undefined;

  const [q, setQ] = useState(searchParams?.q || "");
  const [authority, setAuthority] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sector, setSector] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [selectedRule, setSelectedRule] = useState<EnrichedRule | null>(null);
  // D211: the personal workspace has no company rules; it sees what SALEEM can verify per authority first.
  const picker = useOrgPicker();
  const personal = picker.mode === "personal";

  const packs = usePacks();
  const sources = useSources();
  const loading = book.isPending || packs.isPending || sources.isPending;
  const failed = book.isError || packs.isError || sources.isError;
  // D216: database rules mapped to authority, sector and source verification (see enrich.ts).
  const rules: EnrichedRule[] = useMemo(() => {
    if (!book.data || !packs.data || !sources.data) return [];
    const label = (code: string) => {
      const s = SECTORS.find((x) => x.id === code);
      return s ? (lang === "en" ? s.en : s.ar) : "";
    };
    return enrichRules(
      book.data.rules as unknown as Record<string, unknown>[],
      packs.data,
      sources.data,
      label,
    );
  }, [book.data, packs.data, sources.data, lang]);

  // Summary counts
  const stats = useMemo(() => {
    const total = rules.length;
    let active = 0;
    let draft = 0;
    let pending = 0;
    const authorities = new Set<string>();

    for (const r of rules) {
      if (r.authority && !["INTERNAL", "OTHER"].includes(String(r.authority)))
        authorities.add(r.authority);
      if (r.review_state === "active") active++;
      else if (r.review_state === "pending_review") pending++;
      else draft++;
    }

    return { total, active, draft, pending, authorities: authorities.size };
  }, [rules]);

  // Filtered rules
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rules.filter((r) => {
      // Search filter
      if (term) {
        const hay = [
          r.code,
          r.title_ar,
          r.title_en,
          r.description_ar,
          r.description_en,
          r.source_name,
          r.article_ref,
          r.authority,
          r.authority_ar,
          r.sector_ar,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!hay.includes(term)) return false;
      }

      // Authority filter
      if (authority !== "all") {
        if (r.authority !== authority) return false;
      }

      // Status filter
      if (status !== "all") {
        if (status === "active" && !(r.review_state === "active")) return false;
        if (status === "pending_review" && r.review_state !== "pending_review") return false;
        if (status === "draft" && r.review_state !== "draft") return false;
        if (status === "superseded" && r.review_state !== "superseded") return false;
        if (status === "archived" && r.review_state !== "archived") return false;
      }

      // Sector filter
      if (sector !== "all") {
        if (r.sector_code !== sector) return false;
      }

      // Severity filter
      if (severity !== "all") {
        if (r.default_severity !== severity) return false;
      }

      return true;
    });
  }, [rules, q, authority, status, sector, severity]);

  const version = book.data?.version?.version_label;

  return (
    <Page className="flex flex-col gap-6">
      {/* Page Header with Company Rules Action */}
      <PageHeader
        title={t("rulebook.title")}
        description={t("rulebook.subtitle")}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {version && <Badge variant="green">{t("rulebook.version", { v: version })}</Badge>}
            <Badge variant="outline">
              {stats.total} {t("rulebook.totalRules")}
            </Badge>
          </span>
        }
        actions={
          personal ? undefined : (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="secondary" icon={<ScrollText />}>
                <Link to="/company-rules">{t("rulebook.addCompanyRules")}</Link>
              </Button>
            </div>
          )
        }
      />

      {/* Info notice about official vs draft status */}
      <div className="flex items-start gap-3 rounded-lg border border-amber/25 bg-amber-bg p-4 text-sm text-fg shadow-xs">
        <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-amber-text" />
        <div className="flex flex-col gap-1">
          <strong className="font-semibold">شفافية الدليل التنظيمي ومسار الاعتماد</strong>
          <p className="text-fg-muted">{t("rulebook.illustrativeBody")}</p>
        </div>
      </div>

      <AuthorityCoveragePanel picked={authority} onPick={setAuthority} />
      <p className="-mt-3 text-xs text-fg-muted" data-testid="rulebook-browse-only">
        {t("rulebook.browseOnly")}
      </p>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex flex-col gap-1 p-3.5">
          <span className="text-xs font-medium text-fg-muted">{t("rulebook.totalRules")}</span>
          <span className="text-2xl font-bold tracking-tight text-fg">{stats.total}</span>
          <span className="text-[11px] text-fg-muted">شاملة كافة الجهات والقطاعات</span>
        </Card>
        <Card className="flex flex-col gap-1 p-3.5 border-l-4 border-l-green">
          <span className="text-xs font-medium text-fg-muted">{t("rulebook.activeRules")}</span>
          <span className="text-2xl font-bold tracking-tight text-green">{stats.active}</span>
          <span className="text-[11px] text-fg-muted">مطبقة في الفحص التلقائي</span>
        </Card>
        <Card className="flex flex-col gap-1 p-3.5 border-l-4 border-l-amber">
          <span className="text-xs font-medium text-fg-muted">{t("rulebook.pendingRules")}</span>
          <span className="text-2xl font-bold tracking-tight text-amber-text">
            {stats.pending + stats.draft}
          </span>
          <span className="text-[11px] text-fg-muted">مسودات وقواعد بحثية للمعاينة</span>
        </Card>
        <Card className="flex flex-col gap-1 p-3.5">
          <span className="text-xs font-medium text-fg-muted">{t("rulebook.authorities")}</span>
          <span className="text-2xl font-bold tracking-tight text-fg">{stats.authorities}</span>
          <span className="text-[11px] text-fg-muted">جهات سعودية معتمدة</span>
        </Card>
      </div>

      {/* Search and Advanced Filters */}
      <Card className="flex flex-col gap-4 p-4 shadow-sm">
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
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("rulebook.searchPlaceholder")}
              className="ps-10"
            />
          </label>
          {(q ||
            authority !== "all" ||
            status !== "all" ||
            sector !== "all" ||
            severity !== "all") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQ("");
                setAuthority("all");
                setStatus("all");
                setSector("all");
                setSeverity("all");
              }}
            >
              إعادة ضبط التصفية
            </Button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="rb-authority" className="text-xs font-medium text-fg-muted">
              {t("rulebook.filterAuthority")}
            </label>
            <Select
              id="rb-authority"
              value={authority}
              onChange={(e) => setAuthority(e.target.value)}
            >
              {AUTHORITIES.map((a) => (
                <option key={a.id} value={a.id}>
                  {lang === "en" ? a.en : a.ar}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="rb-status" className="text-xs font-medium text-fg-muted">
              {t("rulebook.filterStatus")}
            </label>
            <Select id="rb-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {lang === "en" ? s.en : s.ar}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="rb-sector" className="text-xs font-medium text-fg-muted">
              {t("rulebook.filterSector")}
            </label>
            <Select id="rb-sector" value={sector} onChange={(e) => setSector(e.target.value)}>
              {SECTORS.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {lang === "en" ? sec.en : sec.ar}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="rb-severity" className="text-xs font-medium text-fg-muted">
              {t("rulebook.filterSeverity")}
            </label>
            <Select id="rb-severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="all">{t("rulebook.all")}</option>
              <option value="violation">مخالفة نظامية (Violation)</option>
              <option value="warning">تنبيه / تحذير (Warning)</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Rules Catalog Table / List */}
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
        <Card className="flex flex-col gap-4 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex gap-4 border-b border-border pb-3 last:border-b-0">
              <Skeleton className="h-6 w-20" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<SearchX />} title={t("rulebook.noResults")} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>
              عرض <strong>{filtered.length}</strong> من إجمالي <strong>{rules.length}</strong> قاعدة
              تنظيمية
            </span>
            {authority !== "all" && (
              <Badge variant="outline">{AUTHORITIES.find((a) => a.id === authority)?.ar}</Badge>
            )}
          </div>

          <div className="flex flex-col gap-2.5" data-testid="rule-results">
            {filtered.map((r) => {
              const isActive = r.review_state === "active";
              const isPending = r.review_state === "pending_review";
              const isArchived = r.review_state === "archived";

              return (
                <Card
                  key={r.code}
                  className="flex flex-col justify-between gap-3 p-4 transition-all hover:border-green/40 hover:shadow-xs sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 flex-col gap-2 min-w-0">
                    {/* Header line: Code, Authority, Status, Severity */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge mono className="font-semibold">
                        {r.code}
                      </Badge>
                      <Badge variant="outline" className="bg-sunken/50">
                        {r.authority || "جهة تنظيمية"}
                      </Badge>
                      <Badge
                        variant={
                          isActive
                            ? "green"
                            : isPending
                              ? "amber"
                              : isArchived
                                ? "outline"
                                : "neutral"
                        }
                      >
                        {r.review_state === "active"
                          ? "سارية ومطبقة"
                          : r.review_state === "pending_review"
                            ? "قيد المراجعة"
                            : r.review_state === "superseded"
                              ? "مستبدلة"
                              : r.review_state === "archived"
                                ? "معطّلة"
                                : "مسودة بحثية"}
                      </Badge>
                      {r.sector_ar && (
                        <span className="text-fg-muted font-medium">· {r.sector_ar}</span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-fg leading-snug" dir="auto">
                      {lang === "en" ? r.title_en : r.title_ar}
                    </h3>

                    {/* Legal reference and official source link */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                      {r.article_ref && (
                        <span className="font-medium text-fg">
                          المادة: <span dir="ltr">{r.article_ref}</span>
                        </span>
                      )}
                      {r.source_url ? (
                        <a
                          href={r.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-green hover:underline"
                        >
                          <span>{r.source_name || "المصدر الرسمي"}</span>
                          <ExternalLink aria-hidden="true" className="size-3" />
                        </a>
                      ) : (
                        <span>{r.source_name}</span>
                      )}
                      {r.article_ref && <span>{r.article_ref}</span>}
                      {r.source_verification && (
                        <span data-testid="rule-verification">
                          <Badge variant="outline" className="text-[11px]">
                            {t(`findingType.verification.${r.source_verification}` as TKey)}
                          </Badge>
                        </span>
                      )}
                      {r.check_mode && (
                        <Badge variant="outline" className="text-[11px]">
                          {r.check_mode === "content"
                            ? "فحص محتوى"
                            : r.check_mode === "document"
                              ? "فحص وثائق"
                              : r.check_mode === "workflow"
                                ? "إجرائي"
                                : "مركب"}
                        </Badge>
                      )}
                    </div>

                    {/* Applicability snippet */}
                    {r.applicability_ar && (
                      <p className="line-clamp-1 text-xs text-fg-muted" dir="auto">
                        <strong>نطاق الانطباق:</strong> {r.applicability_ar}
                      </p>
                    )}
                  </div>

                  {/* Actions column */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t border-border pt-2 sm:border-t-0 sm:pt-0">
                    <StatusChip tone={r.default_severity} size="sm">
                      {t(`severity.${r.default_severity}`)}
                    </StatusChip>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedRule(r)}>
                      {t("rulebook.detailsBtn")}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Rule Detail Dialog */}
      <Dialog
        open={Boolean(selectedRule)}
        onOpenChange={(open) => !open && setSelectedRule(null)}
        title={`${selectedRule?.code || ""} — ${t("rulebook.detailsTitle")}`}
        description={selectedRule?.source_name || ""}
        className="sm:max-w-2xl max-h-[88vh] overflow-y-auto"
      >
        {selectedRule && (
          <div className="flex flex-col gap-4 text-sm" dir="auto">
            {/* Header info badge strip */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge mono className="text-sm font-bold">
                {selectedRule.code}
              </Badge>
              <Badge variant="outline">{selectedRule.authority_ar || selectedRule.authority}</Badge>
              {selectedRule.source_verification && (
                <Badge variant="outline">
                  {t(`findingType.verification.${selectedRule.source_verification}` as TKey)}
                </Badge>
              )}
              <Badge
                variant={
                  selectedRule.review_state === "active"
                    ? "green"
                    : selectedRule.review_state === "pending_review"
                      ? "amber"
                      : "neutral"
                }
              >
                {selectedRule.review_state === "active"
                  ? "سارية ومطبقة نظامياً"
                  : selectedRule.review_state === "pending_review"
                    ? "قيد المراجعة القانونية"
                    : selectedRule.review_state === "superseded"
                      ? "مستبدلة"
                      : "مسودة بحثية"}
              </Badge>
              <StatusChip tone={selectedRule.default_severity} size="sm">
                {t(`severity.${selectedRule.default_severity}`)}
              </StatusChip>
            </div>

            {/* Reconciliation Note if superseded */}
            {selectedRule.superseded_note && (
              <div className="rounded-lg border border-green/30 bg-green/10 p-3 text-xs text-fg">
                <strong className="block font-semibold text-green mb-1">
                  {t("rulebook.reconciliationNote")}
                </strong>
                {selectedRule.superseded_note}
              </div>
            )}

            {/* 1. Official Regulatory Reference */}
            <div className="flex flex-col gap-1 rounded-md border border-border p-3">
              <span className="text-xs font-semibold text-fg-muted">
                {t("rulebook.officialRef")}
              </span>
              <p className="font-semibold text-fg text-base">
                {selectedRule.source_name} —{" "}
                {selectedRule.article_ref || "المادة النظامية المعتمدة"}
              </p>
              {selectedRule.source_url && (
                <a
                  href={selectedRule.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-xs text-green hover:underline"
                >
                  <span>{t("rulebook.officialSource")} (فتح الرابط الرسمي)</span>
                  <ArrowUpRight className="size-3.5" />
                </a>
              )}
            </div>

            {/* 2. Direct Requirement Text */}
            <div className="flex flex-col gap-1 rounded-md border border-border p-3 bg-sunken/40">
              <span className="text-xs font-semibold text-fg-muted">{t("rulebook.legalText")}</span>
              <p className="font-bold text-fg leading-relaxed">{selectedRule.title_ar}</p>
            </div>

            {/* 3. Explanation & Practical Description */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-fg-muted">
                {t("rulebook.explanation")}
              </span>
              <p className="leading-relaxed text-fg-muted">
                {selectedRule.description_ar || selectedRule.summary_ar}
              </p>
            </div>

            {/* 4. Applicability */}
            <div className="flex flex-col gap-1 rounded-md border border-border p-3">
              <span className="text-xs font-semibold text-fg-muted">
                {t("rulebook.applicability")}
              </span>
              <p className="leading-relaxed text-fg">
                {selectedRule.applicability_ar ||
                  "تنطبق على كافة المواد الإعلانية الترويجية في هذا القطاع."}
              </p>
            </div>

            {/* 5. Evidence Policy */}
            <div className="flex flex-col gap-1 rounded-md border border-border p-3">
              <span className="text-xs font-semibold text-fg-muted">
                {t("rulebook.evidencePolicy")}
              </span>
              <p className="leading-relaxed text-fg-muted">
                {selectedRule.evidence_policy_ar ||
                  "نص الإعلان، تفريغ الصوت، والنصوص المكتوبة على الشاشة."}
              </p>
            </div>

            {/* 6. How SALEEM Evaluates It */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border p-3">
                <span className="text-xs font-semibold text-fg-muted">
                  {t("rulebook.howWeCheck")}
                </span>
                <p className="mt-1 text-fg font-medium">
                  {selectedRule.check_mode === "content"
                    ? "فحص ذكاء اصطناعي وتحليل محتوى متعدد الوسائط"
                    : selectedRule.check_mode === "document"
                      ? "مطابقة التراخيص والمستندات والباركود"
                      : selectedRule.check_mode === "workflow"
                        ? "تحقق من مسار الاعتماد الإجرائي المسبق"
                        : "فحص مركب (تحليل آلي + مطابقة قواعد)"}
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <span className="text-xs font-semibold text-fg-muted">{t("rulebook.package")}</span>
                <p className="mt-1 font-mono text-xs text-fg">
                  {selectedRule.pack} ({selectedRule.sector_ar || "عام"})
                </p>
              </div>
            </div>

            {/* Footer metadata */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-fg-muted">
              <span>
                {t("rulebook.lastVerified")}: {selectedRule.last_verified_at || "2026-11-18"}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setSelectedRule(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Sector Rule Packs section */}
    </Page>
  );
}
