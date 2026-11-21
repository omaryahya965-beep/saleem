// Hero product stage (D206): real frames of the fictional Nada Cream ad moving through SALEEM — original, a detected
// on-screen claim with its timestamp, the proposed correction, and version 2 awaiting a human decision. The four
// cards are always rendered (prerender and screen readers see the whole story); the active one is emphasised.
import { BadgeCheck, Pause, Play, ScanSearch, UserRound, Video, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { NADA_MEDIA } from "@/features/sample/nadaSample";
import { usePrefersReducedMotion } from "@/features/public/motion";
import { PhoneFrame } from "@/features/public/ui";

const STEPS = ["original", "detect", "fix", "review"] as const;
type Step = (typeof STEPS)[number];
const INTERVAL = 4200;

export function HeroStage() {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(1);
  const [playing, setPlaying] = useState(true);
  const auto = playing && !reduced;
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => setI((x) => (x + 1) % STEPS.length), INTERVAL);
    return () => window.clearTimeout(id);
  }, [auto, i]);
  const step = STEPS[i]!;
  const go = (n: number) => {
    setI(n);
    setPlaying(false);
  };

  return (
    <figure role="group" aria-label={t("home.hero.stageLabel")} className="relative m-0">
      {/* Soft light behind the phone */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[15%] top-[8%] h-[70%] rounded-full bg-gold/20 blur-[90px]"
      />
      <div className="relative mx-auto min-h-[460px] max-w-[620px] sm:min-h-[600px]">
        <div className="relative z-10 mx-auto w-[220px] sm:w-[262px]">
          <PhoneFrame>
            <img
              src={NADA_MEDIA.v1Claim}
              alt=""
              width={540}
              height={945}
              fetchPriority="high"
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-700",
                step === "review" ? "opacity-0" : "opacity-100",
              )}
            />
            <img
              src={NADA_MEDIA.v2Poster}
              alt=""
              width={540}
              height={945}
              loading="lazy"
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-700",
                step === "review" ? "opacity-100" : "opacity-0",
              )}
            />
            {step === "detect" && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-mint/25 to-transparent motion-safe:animate-[scan_1.6s_ease-in-out_infinite]"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-x-[7%] top-[45.5%] h-[9%] rounded-md ring-2 ring-[#ff6b5e] motion-safe:animate-[pulse-ring_1.4s_ease-out_infinite]"
                />
              </>
            )}
            {step === "fix" && (
              <span
                aria-hidden="true"
                className="absolute inset-x-[7%] top-[45.5%] h-[9%] rounded-md bg-forest/85 backdrop-blur-sm transition-opacity"
              />
            )}
            {/* Mini player bar with the finding markers of version 1 */}
            <div
              aria-hidden="true"
              className="absolute inset-x-3 bottom-3 rounded-full bg-black/45 p-2 backdrop-blur"
            >
              <div className="relative h-1 rounded-full bg-white/25">
                <span
                  className="absolute inset-y-0 start-0 rounded-full bg-gold transition-[width] duration-700"
                  style={{
                    width: step === "original" ? "20%" : step === "review" ? "100%" : "73%",
                  }}
                />
                {[0, 36, 73, 100].map((p) => (
                  <span
                    key={p}
                    className={cn(
                      "absolute top-1/2 size-2 -translate-y-1/2 rounded-full ring-2 ring-black/40 rtl:translate-x-1/2 ltr:-translate-x-1/2",
                      step === "review" ? "bg-mint" : "bg-[#ff6b5e]",
                    )}
                    style={{ insetInlineStart: `${p}%` }}
                  />
                ))}
              </div>
            </div>
          </PhoneFrame>
        </div>

        <StageCard
          step="original"
          active={step}
          className="sm:start-0 sm:top-6"
          head={<CardHead icon={<Video />} label={t("home.hero.step.original")} />}
        >
          <p className="text-sm text-forest/80" dir="rtl">
            «ودّعي التصبغات مع كريم ندى! بشرة صافية خلال 3 أيام فقط…»
          </p>
          <p className="text-xs text-muted">0:15 · {t("home.hero.fictional")}</p>
        </StageCard>

        <StageCard
          step="detect"
          active={step}
          className="sm:end-0 sm:top-[30%]"
          head={<CardHead icon={<ScanSearch />} label={t("home.hero.step.detect")} />}
        >
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-red-bg px-2 py-0.5 text-xs font-medium text-red">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-red" />
            {t("severity.violation")} · {t("home.hero.flag")}
          </span>
          <p className="font-display text-lg leading-snug font-bold text-forest" dir="rtl">
            «النتيجة مضمونة خلال ٣ أيام»
          </p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="tabular rounded-full bg-forest px-2 py-0.5 font-bold text-cream">
              0:11
            </span>
            {t("home.hero.onScreen")}
            <span className="font-mono text-[11px]">COM-01</span>
          </p>
          <p className="border-t border-forest/10 pt-2 text-xs text-muted">
            {t("home.hero.evidenceCount")}
          </p>
        </StageCard>

        <StageCard
          step="fix"
          active={step}
          className="sm:start-0 sm:bottom-24"
          head={<CardHead icon={<Wand2 />} label={t("home.hero.fixTitle")} />}
        >
          <p
            className="rounded-md bg-red-bg px-2 py-1 text-sm text-red line-through decoration-2"
            dir="rtl"
          >
            {t("home.hero.fixRemove")}
          </p>
          <p className="rounded-md bg-green-bg px-2 py-1 text-sm font-medium text-green" dir="rtl">
            {t("home.hero.fixAdd")}
          </p>
        </StageCard>

        <StageCard
          step="review"
          active={step}
          className="sm:end-0 sm:bottom-4"
          head={
            <CardHead
              icon={<BadgeCheck />}
              label={`${t("home.hero.v2")} · ${t("home.hero.step.review")}`}
            />
          }
        >
          <p className="text-sm text-forest">{t("home.hero.v2Result")}</p>
          <div className="flex items-center gap-2 border-t border-forest/10 pt-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest text-cream">
              <UserRound aria-hidden="true" className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-xs font-bold text-forest">
                {t("home.hero.reviewer")} ·{" "}
                <span className="text-amber-text">{t("home.hero.reviewState")}</span>
              </span>
              <span className="text-xs text-muted">{t("home.hero.reviewerNote")}</span>
            </span>
          </div>
        </StageCard>
      </div>

      <figcaption className="relative z-10 mt-6 flex items-center gap-3">
        <ol className="grid flex-1 grid-cols-4 gap-2">
          {STEPS.map((s, n) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => go(n)}
                aria-current={n === i ? "step" : undefined}
                className="flex w-full flex-col gap-2 rounded-md py-1 text-start text-xs font-medium text-cream/60 hover:text-cream aria-[current=step]:text-cream sm:text-sm"
              >
                <span className="relative h-0.5 w-full overflow-hidden rounded-full bg-cream/15">
                  <span
                    key={`${i}-${auto}`}
                    className={cn(
                      "absolute inset-y-0 start-0 rounded-full bg-gold",
                      n < i && "w-full",
                      n > i && "w-0",
                      n === i &&
                        (auto ? "w-0 motion-safe:animate-[grow_4.2s_linear_forwards]" : "w-full"),
                    )}
                  />
                </span>
                {t(`home.hero.step.${s}`)}
              </button>
            </li>
          ))}
        </ol>
        {!reduced && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="grid size-11 shrink-0 place-items-center rounded-full text-cream ring-1 ring-cream/25 hover:bg-cream/10"
            aria-label={playing ? t("home.hero.pause") : t("home.hero.play")}
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-4" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
          </button>
        )}
      </figcaption>
    </figure>
  );
}

function CardHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-gold-deep [&_svg]:size-4">
      <span aria-hidden="true">{icon}</span>
      {label}
    </p>
  );
}

/**
 * The active step is a full card; the others collapse to a labelled pill in the same place, so the whole path stays
 * readable without crowding the footage. On phones only the active card shows, under the phone.
 */
function StageCard({
  step,
  active,
  className,
  head,
  children,
}: {
  step: Step;
  active: Step;
  className?: string;
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  const on = step === active;
  return (
    <div
      className={cn(
        "z-20 text-start sm:absolute",
        on ? "mx-auto mt-5 w-full max-w-[320px] sm:mt-0 sm:w-[244px]" : "hidden sm:block",
        className,
      )}
    >
      {on ? (
        <div className="flex flex-col gap-2 rounded-[20px] bg-cream p-4 shadow-[0_28px_60px_-20px_rgb(0_0_0/0.65)] ring-1 ring-gold/40 motion-safe:animate-[stage-in_400ms_ease-out]">
          {head}
          {children}
        </div>
      ) : (
        <div className="rounded-full bg-forest-2/90 px-3.5 py-2 ring-1 ring-cream/15 backdrop-blur [&_p]:text-cream/75">
          {head}
        </div>
      )}
    </div>
  );
}
