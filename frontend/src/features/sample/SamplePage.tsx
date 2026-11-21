// Public interactive sample — «كريم ندى» (D206). A guided, read-only walk through five stages: the original ad and its
// findings, what each finding means, the correction tools, the version comparison and the human review. Static data
// only: no uploads, decisions, comments or AI requests are possible from this page.
import { ArrowLeft, ArrowRight, FlaskConical, Info } from "lucide-react";
import { useRef, useState } from "react";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { Container, Eyebrow, PhoneFrame } from "@/features/public/ui";
import { NADA_MEDIA, NADA_V1, NADA_V2 } from "./nadaSample";
import {
  CompareStage,
  CorrectStage,
  FindingsStage,
  OriginalStage,
  ReviewStage,
  V1_GROUPS,
  V2_GROUPS,
} from "./stages";

const STAGES = ["original", "findings", "correct", "compare", "review"] as const;
type Stage = (typeof STAGES)[number];

export function SamplePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const startTo = user ? "/new" : "/signup";
  const [stage, setStage] = useState<Stage>("original");
  const [selected, setSelected] = useState<string | null>(V1_GROUPS[0]?.key ?? null);
  const [seekRequest, setSeekRequest] = useState<{ t: number; n: number } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const idx = STAGES.indexOf(stage);
  const go = (s: Stage) => {
    setStage(s);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div className="flex flex-col">
      <header
        data-testid="sample-page"
        className="relative overflow-hidden bg-forest-glow text-cream"
      >
        <Container className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:py-16">
          <div className="flex flex-col gap-5">
            <Eyebrow inverse>
              <FlaskConical aria-hidden="true" className="size-4" />
              {t("sample.badge")}
            </Eyebrow>
            <h1 className="font-display text-[40px] leading-[1.2] font-bold sm:text-[52px] ltr:font-sans ltr:tracking-tight">
              {t("sample.title")}
            </h1>
            <div className="flex flex-wrap gap-2 text-sm">
              {[t("sample.fictional"), t("demo.category"), t("demo.versions")].map((x) => (
                <span key={x} className="rounded-full px-3 py-1 text-cream/85 ring-1 ring-cream/20">
                  {x}
                </span>
              ))}
            </div>
            <p className="max-w-2xl text-lg text-cream/80">{t("demo.explore")}</p>
            <dl className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                label={t("sample.v1")}
                value={String(V1_GROUPS.length)}
                sub={t("sample.counts", {
                  v: NADA_V1.rawCounts.violations,
                  w: NADA_V1.rawCounts.warnings,
                })}
                tone="text-[#ff8a7e]"
              />
              <Stat
                label={t("sample.v2")}
                value={String(V2_GROUPS.length)}
                sub={t("sample.counts", {
                  v: NADA_V2.rawCounts.violations,
                  w: NADA_V2.rawCounts.warnings,
                })}
                tone="text-gold"
              />
              <Stat
                label={t("sample.grouping")}
                value={`${NADA_V1.findings.length} → ${V1_GROUPS.length}`}
                valueLtr
                sub={t("sample.groupingValue", {
                  raw: NADA_V1.findings.length,
                  groups: V1_GROUPS.length,
                })}
                tone="text-mint"
                className="col-span-2 sm:col-span-1"
              />
            </dl>
            <p className="flex max-w-2xl items-start gap-2 text-sm text-cream/60">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t("sample.honesty")}
            </p>
          </div>
          <div aria-hidden="true" className="relative hidden h-[360px] w-[340px] lg:block">
            <div className="absolute end-0 top-0 w-[170px] rotate-[5deg] rtl:-rotate-[5deg]">
              <PhoneFrame>
                <img
                  src={NADA_MEDIA.v2Poster}
                  alt=""
                  width={540}
                  height={945}
                  className="size-full object-cover"
                />
              </PhoneFrame>
            </div>
            <div className="absolute start-0 bottom-0 w-[170px] -rotate-[4deg] rtl:rotate-[4deg]">
              <PhoneFrame>
                <img
                  src={NADA_MEDIA.v1Claim}
                  alt=""
                  width={540}
                  height={945}
                  fetchPriority="high"
                  className="size-full object-cover"
                />
              </PhoneFrame>
            </div>
          </div>
        </Container>
      </header>

      <div
        ref={top}
        className="sticky top-16 z-30 scroll-mt-16 border-b border-forest/10 bg-cream/95 backdrop-blur-md"
      >
        <Container>
          <div
            role="tablist"
            aria-label={t("demo.stagesLabel")}
            className="-mx-1 flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]"
          >
            {STAGES.map((s, n) => {
              const on = s === stage;
              return (
                <button
                  key={s}
                  id={`stage-tab-${s}`}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  aria-controls="stage-panel"
                  onClick={() => go(s)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors sm:px-4",
                    on
                      ? "bg-forest text-cream"
                      : "text-forest/70 hover:bg-forest/5 hover:text-forest",
                  )}
                >
                  <span
                    className={cn(
                      "tabular grid size-6 place-items-center rounded-full text-xs font-bold",
                      on ? "bg-gold text-forest" : "bg-white ring-1 ring-forest/15",
                    )}
                  >
                    {n + 1}
                  </span>
                  {t(`demo.stage.${s}` as TKey)}
                </button>
              );
            })}
          </div>
        </Container>
      </div>

      <Container className="py-10 sm:py-14">
        <section
          id="stage-panel"
          role="tabpanel"
          aria-labelledby={`stage-tab-${stage}`}
          className="flex flex-col gap-8"
        >
          <div className="flex max-w-3xl flex-col gap-2">
            <p className="text-sm font-medium text-gold-deep">
              {idx + 1} / {STAGES.length}
            </p>
            <h2 className="font-display text-3xl font-bold text-forest sm:text-4xl ltr:font-sans ltr:tracking-tight">
              {t(`demo.stage.${stage}` as TKey)}
            </h2>
            <p className="text-lg text-muted">{t(`demo.lead.${stage}` as TKey)}</p>
          </div>
          {stage === "original" && (
            <OriginalStage selected={selected} onSelect={setSelected} seekRequest={seekRequest} />
          )}
          {stage === "findings" && (
            <FindingsStage
              selected={selected}
              onSelect={setSelected}
              onSeekOriginal={(key, s) => {
                setSelected(key);
                setSeekRequest({ t: s, n: Date.now() });
                go("original");
              }}
            />
          )}
          {stage === "correct" && <CorrectStage />}
          {stage === "compare" && <CompareStage />}
          {stage === "review" && <ReviewStage startTo={startTo} />}

          <nav
            aria-label={t("demo.stagesLabel")}
            className="flex items-center justify-between gap-3 border-t border-forest/10 pt-6"
          >
            {idx > 0 ? (
              <button
                type="button"
                onClick={() => go(STAGES[idx - 1]!)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-forest ring-1 ring-forest/20 hover:bg-forest/5"
              >
                <ArrowRight aria-hidden="true" className="size-4 ltr:rotate-180" />
                {t("demo.prev")}
              </button>
            ) : (
              <span />
            )}
            {idx < STAGES.length - 1 && (
              <button
                type="button"
                onClick={() => go(STAGES[idx + 1]!)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-5 text-cream hover:bg-forest-2"
              >
                {t("demo.next")}: {t(`demo.stage.${STAGES[idx + 1]!}` as TKey)}
                <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
              </button>
            )}
          </nav>
        </section>

        <aside className="mt-12 grid gap-4 rounded-[24px] bg-white p-6 ring-1 ring-forest/10 md:grid-cols-[auto_minmax(0,1fr)]">
          <p className="font-bold text-forest">{t("sample.limitsTitle")}</p>
          <ul className="grid gap-x-8 gap-y-2 text-sm text-muted md:grid-cols-2">
            {(["readOnly"] as const).map((k) => (
              <li key={k} className="font-medium text-forest">
                {t(`demo.${k}`)}
              </li>
            ))}
            {(["limit1", "limit2", "limit3", "limit4"] as const).map((k) => (
              <li key={k}>{t(`sample.${k}`)}</li>
            ))}
          </ul>
        </aside>
      </Container>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  className,
  valueLtr,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
  className?: string;
  valueLtr?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[16px] bg-white/[0.06] p-4 ring-1 ring-white/10",
        className,
      )}
    >
      <dt className="text-xs text-cream/70">{label}</dt>
      <dd
        dir={valueLtr ? "ltr" : undefined}
        className={cn(
          "tabular font-display text-3xl leading-none font-bold ltr:font-sans",
          valueLtr && "rtl:text-right",
          tone,
        )}
      >
        {value}
      </dd>
      <dd className="text-xs text-cream/60">{sub}</dd>
    </div>
  );
}
