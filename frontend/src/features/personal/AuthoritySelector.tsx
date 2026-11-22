import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, CircleDashed, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, SegmentedControl, Skeleton } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import {
  AUTHORITIES,
  excludedRecommended,
  fetchAuthorityCoverage,
  recommendAuthorities,
  type Authority,
  type AuthorityCoverage,
  type RecommendInput,
} from "@/lib/api/personal";
import { cn } from "@/lib/utils";

export const useAuthorityCoverage = () =>
  useQuery({
    queryKey: ["authority-coverage"],
    queryFn: fetchAuthorityCoverage,
    staleTime: 10 * 60_000,
  });

export const useRecommendedAuthorities = (input: RecommendInput) =>
  useQuery({
    queryKey: ["recommend-authorities", input],
    queryFn: () => recommendAuthorities(input),
    staleTime: 60_000,
  });

/** Verified coverage of one authority: active rules are applied; draft rules never are. */
export function CoverageBadge({ c }: { c: AuthorityCoverage | undefined }) {
  const { t } = useI18n();
  if (!c || c.active_rules === 0)
    return (
      <Badge variant="outline" className="gap-1">
        <CircleDashed aria-hidden="true" className="size-3" />
        {c?.draft_rules
          ? t("authority.draftOnly", { n: c.draft_rules })
          : t("authority.noCoverage")}
      </Badge>
    );
  return (
    <Badge variant="green" className="gap-1">
      <ShieldCheck aria-hidden="true" className="size-3" />
      {t("authority.verified", { n: c.active_rules })}
    </Badge>
  );
}

/**
 * D211 regulatory authority selection for a personal advertisement. «Automatic» lets SALEEM recommend from the
 * content context (the server function recommend_authorities, the same one the analysis uses); «manual» lets the
 * user pick one or more authorities. Each authority shows what SALEEM can actually check (verified active rules vs
 * drafts that are never applied), and leaving out a recommended authority shows a warning.
 */
export function AuthoritySelector({
  value,
  onChange,
  context,
  usual = [],
}: {
  /** null = automatic. */
  value: Authority[] | null;
  onChange: (v: Authority[] | null) => void;
  context: RecommendInput;
  usual?: Authority[];
}) {
  const { t } = useI18n();
  const coverage = useAuthorityCoverage();
  const recommended = useRecommendedAuthorities(context);
  const rec = recommended.data ?? [];
  const cov = new Map((coverage.data ?? []).map((c) => [c.authority, c]));
  const manual = value !== null;
  const shown = manual ? value : rec;
  const excluded = excludedRecommended(value, rec);
  const uncovered = shown.filter((a) => !cov.get(a)?.active_rules);

  const toggle = (a: Authority) => {
    const cur = value ?? rec;
    onChange(cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="authority-selector">
      <SegmentedControl
        label={t("authority.mode")}
        value={manual ? "manual" : "auto"}
        onValueChange={(v) => onChange(v === "auto" ? null : [...(value ?? rec)])}
        options={[
          { value: "auto", label: t("authority.auto") },
          { value: "manual", label: t("authority.manual") },
        ]}
      />
      <p className="text-sm text-fg-muted">
        {manual ? t("authority.manualHint") : t("authority.autoHint")}
      </p>

      {!manual && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-[14px] bg-green-bg px-3 py-2.5"
          data-testid="authority-recommended"
        >
          <Sparkles aria-hidden="true" className="size-4 text-green" />
          <span className="text-sm font-medium">{t("authority.recommended")}</span>
          {recommended.isPending ? (
            <Skeleton className="h-5 w-40" />
          ) : rec.length ? (
            rec.map((a) => (
              <Badge key={a} variant="neutral">
                {t(`authority.name.${a}` as TKey)}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-fg-muted">{t("authority.noneRecommended")}</span>
          )}
        </div>
      )}

      {manual && (
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="authority-options">
          {AUTHORITIES.map((a) => {
            const on = value!.includes(a);
            const isRec = rec.includes(a);
            return (
              <li key={a}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(a)}
                  data-testid={`authority-${a}`}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[14px] border p-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-green",
                    on
                      ? "border-green bg-green-bg"
                      : "border-border bg-card hover:border-border-strong",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border",
                      on ? "border-green bg-green text-white" : "border-border-strong",
                    )}
                  >
                    {on && <Check aria-hidden="true" className="size-3.5" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                      {t(`authority.name.${a}` as TKey)}
                      {isRec && <Badge variant="amber">{t("authority.recommendedShort")}</Badge>}
                    </span>
                    <span className="text-xs leading-relaxed text-fg-muted">
                      {t(`authority.scope.${a}` as TKey)}
                    </span>
                    {coverage.isSuccess && <CoverageBadge c={cov.get(a)} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {manual && usual.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([...usual])}
          className="self-start text-sm font-medium text-green hover:underline"
        >
          {t("authority.useUsual")}
        </button>
      )}

      {excluded.length > 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[14px] border border-amber/40 bg-amber-bg px-3 py-2.5 text-sm text-amber-text"
          data-testid="authority-excluded-warning"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("authority.excludedWarning", {
            list: excluded.map((a) => t(`authority.name.${a}` as TKey)).join("، "),
          })}
        </p>
      )}
      {manual && value!.length === 0 && (
        <p role="alert" className="text-sm text-red">
          {t("authority.noneSelected")}
        </p>
      )}
      {coverage.isSuccess && uncovered.length > 0 && (
        <p
          className="flex items-start gap-2 rounded-[14px] bg-sunken px-3 py-2.5 text-xs leading-relaxed text-fg-muted"
          data-testid="authority-uncovered"
        >
          <CircleDashed aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {t("authority.uncoveredNote", {
            list: uncovered.map((a) => t(`authority.name.${a}` as TKey)).join("، "),
          })}
        </p>
      )}
      <Link to="/rules" className="self-start text-sm font-medium text-green hover:underline">
        {t("authority.browse")}
      </Link>
    </div>
  );
}

/**
 * D211: what SALEEM can check per authority today — verified active rules (applied) vs drafts (shown, never applied).
 * Clicking an authority filters the rulebook to it.
 */
export function AuthorityCoveragePanel({
  onPick,
  picked,
}: {
  onPick?: (a: string) => void;
  picked?: string;
}) {
  const { t } = useI18n();
  const coverage = useAuthorityCoverage();
  const cov = new Map((coverage.data ?? []).map((c) => [c.authority, c]));
  return (
    <section
      aria-labelledby="coverage-title"
      className="flex flex-col gap-3"
      data-testid="authority-coverage"
    >
      <div>
        <h2 id="coverage-title" className="text-lg font-bold">
          {t("authority.coverageTitle")}
        </h2>
        <p className="text-sm text-fg-muted">{t("authority.coverageBody")}</p>
      </div>
      {coverage.isPending ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {AUTHORITIES.map((a) => (
            <li key={a}>
              <button
                type="button"
                onClick={() => onPick?.(picked === a ? "all" : a)}
                aria-pressed={picked === a}
                data-testid={`coverage-${a}`}
                className={cn(
                  "flex h-full w-full flex-col items-start gap-2 rounded-[14px] border p-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-green",
                  picked === a
                    ? "border-green bg-green-bg"
                    : "border-border bg-card hover:border-border-strong",
                )}
              >
                <span className="text-sm font-bold leading-snug">
                  {t(`authority.name.${a}` as TKey)}
                </span>
                <CoverageBadge c={cov.get(a)} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
