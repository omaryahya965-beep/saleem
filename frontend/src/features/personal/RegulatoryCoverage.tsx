import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  HelpCircle,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Skeleton } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { AUTHORITIES, fetchAuthorityCoverage, type AuthorityCoverage } from "@/lib/api/personal";
import { cn } from "@/lib/utils";
import { reasonKey } from "@/features/reports/model";

export const useAuthorityCoverage = () =>
  useQuery({
    queryKey: ["authority-coverage"],
    queryFn: fetchAuthorityCoverage,
    staleTime: 10 * 60_000,
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
 * D213: what SALEEM can check per authority today — verified active rules (applied) vs drafts (shown, never applied).
 * Read-only: every authority is considered automatically. In the rulebook a click filters the rule list.
 */
export function AuthorityCoveragePanel({
  onPick,
  picked,
  compact,
}: {
  onPick?: (a: string) => void;
  picked?: string;
  compact?: boolean;
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
        <h2 id="coverage-title" className={cn("font-bold", compact ? "text-base" : "text-lg")}>
          {t("authority.coverageTitle")}
        </h2>
        <p className="text-sm text-fg-muted">{t("authority.coverageBody")}</p>
      </div>
      {coverage.isPending ? (
        <Skeleton className="h-32" />
      ) : (
        <ul
          className={cn("grid gap-2 sm:grid-cols-2", compact ? "lg:grid-cols-3" : "lg:grid-cols-5")}
        >
          {AUTHORITIES.map((a) => {
            const body = (
              <>
                <span className="text-sm font-bold leading-snug">
                  {t(`authority.name.${a}` as TKey)}
                </span>
                <CoverageBadge c={cov.get(a)} />
              </>
            );
            return (
              <li key={a}>
                {onPick ? (
                  <button
                    type="button"
                    onClick={() => onPick(picked === a ? "all" : a)}
                    aria-pressed={picked === a}
                    data-testid={`coverage-${a}`}
                    className={cn(
                      "flex h-full w-full flex-col items-start gap-2 rounded-[14px] border p-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-green",
                      picked === a
                        ? "border-green bg-green-bg"
                        : "border-border bg-card hover:border-border-strong",
                    )}
                  >
                    {body}
                  </button>
                ) : (
                  <div
                    data-testid={`coverage-${a}`}
                    className="flex h-full flex-col items-start gap-2 rounded-[14px] border border-border bg-card p-3"
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type AuthorityStatus =
  | "evaluated"
  | "manual_verification"
  | "not_applicable"
  | "insufficient_coverage"
  | "unable_to_evaluate";
export interface RunAuthority {
  authority: string;
  status: AuthorityStatus;
  relevant: boolean;
  active_rules: number;
  draft_rules: number;
  evaluated: number;
  manual: number;
  unable: number;
  failed_rules: string[];
  /** D217 (absent on older runs): verified rules that apply, findings by severity, excluded rules and why. */
  applicable?: number;
  violations?: number;
  warnings?: number;
  excluded?: number;
  excluded_reasons?: Record<string, number>;
}
export interface RunCoverage {
  mode: string;
  selected_sector: string | null;
  content_sectors: string[];
  sector_mismatch: string[];
  authorities?: RunAuthority[];
}

const STATUS: Record<AuthorityStatus, { icon: ReactNode; cls: string }> = {
  evaluated: { icon: <CheckCircle2 />, cls: "text-green" },
  manual_verification: { icon: <UserCheck />, cls: "text-amber-text" },
  not_applicable: { icon: <CircleSlash />, cls: "text-fg-muted" },
  insufficient_coverage: { icon: <CircleDashed />, cls: "text-amber-text" },
  unable_to_evaluate: { icon: <HelpCircle />, cls: "text-red" },
};

/**
 * D213: the read-only regulatory coverage of one analysed personal advertisement — every supported authority with
 * its evaluation status, verified/draft rule counts and the rules that found issues. Relevant authorities without
 * verified rules are highlighted: a gap is never presented as compliance.
 */
export function RunCoverageTable({ run }: { run: RunCoverage | null }) {
  const { t } = useI18n();
  if (!run?.authorities?.length)
    return <p className="text-sm text-fg-muted">{t("coverageRun.notYet")}</p>;
  const rows = [...run.authorities].sort((a, b) => Number(b.relevant) - Number(a.relevant));
  const gaps = rows.filter((r) => r.relevant && r.status === "insufficient_coverage");
  return (
    <div className="flex flex-col gap-3" data-testid="run-coverage">
      {run.sector_mismatch.length > 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[14px] border border-amber/40 bg-amber-bg px-3 py-2.5 text-sm text-amber-text"
          data-testid="sector-mismatch"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("coverageRun.mismatch", {
            selected: t(`ws.sector.${run.selected_sector ?? "other"}` as TKey),
            detected: run.sector_mismatch.map((s) => t(`ws.sector.${s}` as TKey)).join("، "),
          })}
        </p>
      )}
      {gaps.length > 0 && (
        <p
          className="flex items-start gap-2 rounded-[14px] bg-sunken px-3 py-2.5 text-sm"
          data-testid="coverage-gaps"
        >
          <CircleDashed aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-text" />
          {t("coverageRun.gaps", {
            list: gaps.map((g) => t(`authority.name.${g.authority}` as TKey)).join("، "),
          })}
        </p>
      )}
      <div className="overflow-x-auto rounded-[14px] border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-sunken text-xs text-fg-muted">
            <tr>
              <th className="p-2.5 text-start font-medium">{t("coverageRun.col.authority")}</th>
              <th className="p-2.5 text-start font-medium">{t("coverageRun.col.status")}</th>
              <th className="p-2.5 text-start font-medium">{t("coverageRun.col.rules")}</th>
              <th className="p-2.5 text-start font-medium">{t("coverageRun.col.result")}</th>
              <th className="p-2.5 text-start font-medium">{t("coverageRun.col.excluded")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.authority}
                className="border-t border-border"
                data-testid={`run-authority-${r.authority}`}
                data-status={r.status}
              >
                <td className="p-2.5">
                  <span className="font-medium">{t(`authority.name.${r.authority}` as TKey)}</span>
                  {r.relevant && (
                    <Badge variant="amber" className="ms-1.5">
                      {t("coverageRun.relevant")}
                    </Badge>
                  )}
                </td>
                <td className="p-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 [&_svg]:size-4",
                      STATUS[r.status].cls,
                    )}
                  >
                    {STATUS[r.status].icon}
                    {t(`coverageRun.status.${r.status}` as TKey)}
                  </span>
                </td>
                <td className="p-2.5 text-xs text-fg-muted">
                  {t("coverageRun.counts", { active: r.active_rules, drafts: r.draft_rules })}
                  {r.applicable !== undefined && r.active_rules > 0 && (
                    <span className="block">
                      {t("coverageRun.applicableEvaluated", {
                        applicable: r.applicable,
                        evaluated: r.evaluated,
                      })}
                    </span>
                  )}
                </td>
                <td className="p-2.5 text-xs">
                  {r.failed_rules.length ? (
                    <span className="text-red">
                      {r.violations !== undefined &&
                        t("coverageRun.severityCounts", { v: r.violations, w: r.warnings ?? 0 }) +
                          " · "}
                      {t("coverageRun.failed", { list: r.failed_rules.join("، ") })}
                    </span>
                  ) : r.status === "evaluated" ? (
                    <span className="text-green">
                      {t("coverageRun.noIssues", { n: r.evaluated })}
                    </span>
                  ) : r.status === "manual_verification" ? (
                    t("coverageRun.manualItems", { n: r.manual })
                  ) : (
                    "—"
                  )}
                  {r.manual > 0 && r.status === "evaluated" && (
                    <span className="block text-amber-text">
                      {t("coverageRun.manualItems", { n: r.manual })}
                    </span>
                  )}
                </td>
                <td className="p-2.5 text-xs text-fg-muted">
                  {r.excluded ? (
                    <details>
                      <summary className="cursor-pointer">
                        {t("coverageRun.excludedCount", { n: r.excluded })}
                      </summary>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {Object.entries(r.excluded_reasons ?? {}).map(([reason, n]) => {
                          const k = reasonKey(reason);
                          return (
                            <li key={reason}>
                              {t(k.key, { signal: k.signal ?? "", code: k.code ?? "" })} ({n})
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-fg-muted">{t("coverageRun.note")}</p>
    </div>
  );
}
