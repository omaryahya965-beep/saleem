// Landing sections (D206). Each section has its own composition; all sample numbers come from the Nada Cream data
// (consolidated groups computed by the same grouping the app uses), nothing is invented.
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  AudioLines,
  BadgeCheck,
  Building2,
  Captions,
  CircleCheck,
  CircleDashed,
  ClipboardCheck,
  Eraser,
  FilePlus2,
  Gavel,
  GitCompare,
  Handshake,
  History,
  Layers,
  ListChecks,
  Lock,
  MicOff,
  Pause,
  Play,
  Scale,
  ScanSearch,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n, type TKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { diffGroups, groupFindings, type FindingGroup } from "@/features/reports/grouping";
import { NADA_MEDIA, NADA_V1, NADA_V2 } from "@/features/sample/nadaSample";
import {
  AvailabilityTag,
  Container,
  PhoneFrame,
  SectionHeading,
  cta,
  type Availability,
} from "@/features/public/ui";

/** Title of a consolidated group: the claim facet when there is one, else the finding's explanation. */
export function useGroupTitle() {
  const { t, lang } = useI18n();
  return (g: FindingGroup) => {
    if (g.facet) return t(`ws.facet.${g.facet}` as TKey);
    const f = g.members[0]!;
    return (lang === "en" ? f.explanation_en : f.explanation_ar) ?? g.ruleCode;
  };
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Two journeys                                                                                                 */
/* ------------------------------------------------------------------------------------------------------------ */

const CREATE_STEPS: { key: string; tag: Availability }[] = [
  { key: "product", tag: "available" },
  { key: "goals", tag: "available" },
  { key: "brand", tag: "available" },
  { key: "script", tag: "soon" },
  { key: "media", tag: "soon" },
  { key: "analyse", tag: "available" },
  { key: "review", tag: "available" },
];
const CHECK_STEPS = [
  "upload",
  "detect",
  "evidence",
  "suggest",
  "fix",
  "compare",
  "reanalyse",
  "submit",
];

export function Journeys({ startTo }: { startTo: string }) {
  const { t } = useI18n();
  const tag = (k: Availability) => t(`home.journeys.tag.${k}` as TKey);
  return (
    <section aria-labelledby="journeys-title" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="journeys-title"
          eyebrow={t("home.journeys.eyebrow")}
          title={t("home.journeys.title")}
          body={t("home.journeys.body")}
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {/* A — create */}
          <article className="flex flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-forest/10">
            <div
              aria-hidden="true"
              className="relative bg-[linear-gradient(160deg,#f7f3ea,#efe7d6)] p-6 sm:p-8"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-2 rounded-[20px] bg-white p-4 shadow-[0_12px_30px_-18px_rgb(7_33_26/0.35)]">
                  <p className="text-xs font-bold text-gold-deep">
                    {t("home.journeys.create.briefTitle")}
                  </p>
                  {[
                    [t("home.journeys.create.briefProduct"), "كريم ندى"],
                    [t("home.journeys.create.briefGoal"), t("home.journeys.create.briefGoalValue")],
                    [
                      t("home.journeys.create.briefAudience"),
                      t("home.journeys.create.briefAudienceValue"),
                    ],
                    [
                      t("home.journeys.create.briefBrand"),
                      t("home.journeys.create.briefBrandValue"),
                    ],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-3 border-t border-forest/5 pt-2 text-sm"
                    >
                      <span className="text-muted">{k}</span>
                      <span className="truncate font-medium text-forest">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 rounded-[20px] border-2 border-dashed border-forest/15 p-4">
                  <p className="flex items-center justify-between gap-2 text-xs font-bold text-muted">
                    {t("home.journeys.create.draftTitle")}
                    <AvailabilityTag kind="soon" label={tag("soon")} />
                  </p>
                  {[92, 80, 86, 54].map((w, i) => (
                    <span
                      key={i}
                      className="h-2 rounded-full bg-forest/10"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                  <span className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted">
                    <AudioLines className="size-4" /> <Sparkles className="size-4" />
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-5 p-6 sm:p-8">
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl font-bold text-forest sm:text-[28px] ltr:font-sans">
                  {t("home.journeys.create.title")}
                </h3>
                <p className="text-muted">{t("home.journeys.create.lead")}</p>
              </div>
              <ol className="flex flex-col divide-y divide-forest/5">
                {CREATE_STEPS.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-3 py-2.5">
                    <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-cream text-xs font-bold text-forest">
                      {i + 1}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-[15px]",
                        s.tag === "soon" ? "text-muted" : "text-forest",
                      )}
                    >
                      {t(`home.journeys.create.steps.${s.key}` as TKey)}
                    </span>
                    <AvailabilityTag kind={s.tag} label={tag(s.tag)} />
                  </li>
                ))}
              </ol>
              <p className="rounded-[16px] bg-cream px-4 py-3 text-sm text-muted">
                {t("home.journeys.create.note")}
              </p>
              <div className="mt-auto">
                <Link to={startTo} className={cta("outline")}>
                  {t("home.journeys.create.cta")}
                </Link>
              </div>
            </div>
          </article>

          {/* B — check and correct */}
          <article className="flex flex-col overflow-hidden rounded-[28px] bg-forest text-cream">
            <div
              aria-hidden="true"
              className="relative flex items-end gap-5 overflow-hidden bg-forest-glow px-6 pt-8 sm:px-8"
            >
              <div className="w-[118px] shrink-0 translate-y-6 sm:w-[132px]">
                <PhoneFrame>
                  <img
                    src={NADA_MEDIA.v1Claim}
                    alt=""
                    loading="lazy"
                    width={540}
                    height={945}
                    className="size-full object-cover"
                  />
                </PhoneFrame>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 pb-6">
                {[
                  { tone: "bg-[#ff6b5e]", text: "«النتيجة مضمونة»", ts: "0:00 · 0:05 · 0:11" },
                  { tone: "bg-[#ff6b5e]", text: "«إعلان مدفوع» غير موجود", ts: "0:00" },
                  { tone: "bg-gold", text: "رخصة موثوق غير مُدخلة", ts: "—" },
                ].map((r) => (
                  <div
                    key={r.text}
                    className="flex items-center gap-2 rounded-[16px] bg-white/[0.06] px-3 py-2 ring-1 ring-white/10"
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", r.tone)} />
                    <span className="min-w-0 flex-1 truncate text-sm" dir="rtl">
                      {r.text}
                    </span>
                    <span className="tabular shrink-0 text-xs text-cream/60">{r.ts}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-5 p-6 sm:p-8">
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl font-bold sm:text-[28px] ltr:font-sans">
                  {t("home.journeys.check.title")}
                </h3>
                <p className="text-cream/75">{t("home.journeys.check.lead")}</p>
              </div>
              <ol className="flex flex-col divide-y divide-white/[0.06]">
                {CHECK_STEPS.map((k, i) => (
                  <li key={k} className="flex items-center gap-3 py-2.5">
                    <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-gold">
                      {i + 1}
                    </span>
                    <span className="text-[15px] text-cream/90">
                      {t(`home.journeys.check.steps.${k}` as TKey)}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex flex-wrap gap-3">
                <Link to={startTo} className={cta("gold")}>
                  {t("home.journeys.check.cta")}
                </Link>
                <Link to="/sample" className={cta("ghostLight")}>
                  {t("home.journeys.check.cta2")}
                </Link>
              </div>
            </div>
          </article>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Before / after                                                                                               */
/* ------------------------------------------------------------------------------------------------------------ */

export function BeforeAfter() {
  const { t } = useI18n();
  const title = useGroupTitle();
  const g1 = useMemo(() => groupFindings(NADA_V1.findings), []);
  const g2 = useMemo(() => groupFindings(NADA_V2.findings), []);
  const diff = useMemo(() => diffGroups(NADA_V1.findings, NADA_V2.findings), []);
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);
  const [both, setBoth] = useState(false);
  const toggleBoth = () => {
    const vids = [a.current, b.current].filter(Boolean) as HTMLVideoElement[];
    if (both) vids.forEach((v) => v.pause());
    else
      vids.forEach((v) => {
        v.muted = true;
        v.currentTime = 0;
        void v.play().catch(() => {});
      });
    setBoth(!both);
  };
  const row = (g: FindingGroup, state: "gone" | "pending") => (
    <li key={g.key} className="flex items-start gap-3 py-2.5">
      {state === "gone" ? (
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-green" />
      ) : (
        <CircleDashed aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-text" />
      )}
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "text-[15px] text-forest",
            state === "gone" && "line-through decoration-forest/30",
          )}
        >
          {title(g)}
        </span>
        <span className="text-xs text-muted">
          <span className="font-mono">{g.ruleCode}</span> · {t(`severity.${g.severity}` as TKey)}
          {g.members.length > 1 && ` · ${t("demo.occurrences", { n: g.members.length })}`}
        </span>
      </span>
    </li>
  );
  return (
    <section aria-labelledby="ba-title" className="bg-white py-20 sm:py-28">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="ba-title"
            eyebrow={t("home.ba.eyebrow")}
            title={t("home.ba.title")}
            body={t("home.ba.body")}
          />
          <button
            type="button"
            onClick={toggleBoth}
            className={cta("outline", "self-start lg:self-auto")}
          >
            {both ? (
              <Pause aria-hidden="true" className="size-4" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
            {both ? t("home.ba.pauseBoth") : t("home.ba.playBoth")}
          </button>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.25fr)_minmax(0,0.8fr)] lg:items-start">
          <BaVideo
            refEl={a}
            label={t("home.ba.v1")}
            src={NADA_V1.video}
            poster={NADA_MEDIA.v1Poster}
            stat={t("home.ba.summary", { groups: g1.length, raw: NADA_V1.findings.length })}
            tone="red"
          />
          <div className="order-last col-span-2 flex flex-col gap-6 rounded-[28px] bg-cream p-6 sm:p-8 lg:order-none lg:col-span-1">
            <div className="flex items-center justify-center gap-4 text-center">
              <Count n={g1.length} label={t("home.ba.v1")} tone="text-red" />
              <ArrowLeft aria-hidden="true" className="size-6 text-gold-deep ltr:rotate-180" />
              <Count n={g2.length} label={t("home.ba.v2")} tone="text-amber-text" />
            </div>
            <div>
              <p className="text-sm font-bold text-forest">{t("home.ba.gone")}</p>
              <ul className="divide-y divide-forest/5">
                {diff.noLongerDetected.map((g) => row(g, "gone"))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-bold text-forest">{t("home.ba.pending")}</p>
              <ul className="divide-y divide-forest/5">
                {diff.persistent.map((p) => row(p.after, "pending"))}
              </ul>
            </div>
            <p className="text-sm text-forest">
              <span className="font-bold">{t("home.ba.added")}: </span>
              {diff.added.length ? diff.added.map(title).join("، ") : t("home.ba.none")}
            </p>
            <p className="border-t border-forest/10 pt-4 text-xs text-muted">{t("home.ba.note")}</p>
            <Link to="/sample" className={cta("forest", "self-start")}>
              {t("home.ba.cta")}
            </Link>
          </div>
          <BaVideo
            refEl={b}
            label={t("home.ba.v2")}
            src={NADA_V2.video}
            poster={NADA_MEDIA.v2Poster}
            stat={t("home.ba.summary", { groups: g2.length, raw: NADA_V2.findings.length })}
            tone="amber"
          />
        </div>
      </Container>
    </section>
  );
}

function Count({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span className="flex flex-col items-center">
      <span
        className={cn("tabular font-display text-5xl leading-none font-bold ltr:font-sans", tone)}
      >
        {n}
      </span>
      <span className="mt-1 text-xs text-muted">{label}</span>
    </span>
  );
}

function BaVideo({
  refEl,
  label,
  src,
  poster,
  stat,
  tone,
}: {
  refEl: React.RefObject<HTMLVideoElement | null>;
  label: string;
  src: string;
  poster: string;
  stat: string;
  tone: "red" | "amber";
}) {
  return (
    <figure className="m-0 flex flex-col gap-3">
      <PhoneFrame tone="light">
        <video
          ref={refEl}
          src={src}
          poster={poster}
          controls
          playsInline
          preload="none"
          aria-label={label}
          className="size-full object-cover"
        />
      </PhoneFrame>
      <figcaption className="flex flex-col gap-1 px-1">
        <span className="text-sm font-bold text-forest">{label}</span>
        <span
          className={cn("text-xs font-medium", tone === "red" ? "text-red" : "text-amber-text")}
        >
          {stat}
        </span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Lifecycle                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

type Who = "ai" | "human" | "both";
const LIFECYCLE: { key: string; icon: LucideIcon; who: Who }[] = [
  { key: "start", icon: FilePlus2, who: "human" },
  { key: "analyse", icon: ScanSearch, who: "ai" },
  { key: "risks", icon: ListChecks, who: "ai" },
  { key: "evidence", icon: Search, who: "both" },
  { key: "correct", icon: Wand2, who: "both" },
  { key: "compare", icon: GitCompare, who: "ai" },
  { key: "submit", icon: Send, who: "human" },
  { key: "decide", icon: Gavel, who: "human" },
];

function WhoChip({ who, inverse }: { who: Who; inverse?: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        who === "ai" && (inverse ? "bg-mint/15 text-mint" : "bg-green-bg text-green"),
        who === "human" && (inverse ? "bg-gold/15 text-gold" : "bg-amber-bg text-gold-deep"),
        who === "both" && (inverse ? "bg-white/10 text-cream" : "bg-forest/5 text-forest"),
      )}
    >
      {who === "human" ? (
        <UserRound aria-hidden="true" className="size-3.5" />
      ) : (
        <Sparkles aria-hidden="true" className="size-3.5" />
      )}
      {t(`home.how.who.${who}` as TKey)}
    </span>
  );
}

export function Lifecycle() {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const s = LIFECYCLE[i]!;
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="how-title"
          eyebrow={t("home.how.eyebrow")}
          title={t("home.how.title")}
          body={t("home.how.body")}
        />
        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          <ol className="relative flex flex-col">
            <span
              aria-hidden="true"
              className="absolute inset-y-5 start-[19px] w-px bg-forest/15"
            />
            {LIFECYCLE.map((x, n) => {
              const on = n === i;
              return (
                <li key={x.key} className="relative">
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls="how-panel"
                    onClick={() => setI(n)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-[16px] px-0 py-2.5 text-start transition-colors",
                      on ? "text-forest" : "text-forest/60 hover:text-forest",
                    )}
                  >
                    <span
                      className={cn(
                        "tabular relative z-10 grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors",
                        on ? "bg-forest text-gold" : "bg-cream text-forest ring-1 ring-forest/15",
                      )}
                    >
                      {n + 1}
                    </span>
                    <span className={cn("text-lg", on ? "font-bold" : "font-medium")}>
                      {t(`home.how.steps.${x.key}.title` as TKey)}
                    </span>
                  </button>
                  {on && (
                    <div className="ms-14 mb-3 flex flex-col gap-3 lg:hidden">
                      <p className="text-muted">{t(`home.how.steps.${x.key}.body` as TKey)}</p>
                      <WhoChip who={x.who} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div
            id="how-panel"
            aria-live="polite"
            className="relative hidden overflow-hidden rounded-[28px] bg-forest-glow p-10 text-cream lg:flex lg:flex-col lg:justify-between"
          >
            <div
              key={s.key}
              className="flex flex-col gap-5 motion-safe:animate-[stage-in_350ms_ease-out]"
            >
              <div className="flex items-center justify-between">
                <span className="tabular font-display text-[88px] leading-none font-bold text-gold/90 ltr:font-sans">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="grid size-16 place-items-center rounded-[20px] bg-white/[0.06] ring-1 ring-white/10">
                  <s.icon aria-hidden="true" className="size-7 text-gold" />
                </span>
              </div>
              <h3 className="font-display text-3xl font-bold ltr:font-sans">
                {t(`home.how.steps.${s.key}.title` as TKey)}
              </h3>
              <p className="max-w-xl text-lg text-cream/80">
                {t(`home.how.steps.${s.key}.body` as TKey)}
              </p>
              <WhoChip who={s.who} inverse />
            </div>
            <div aria-hidden="true" className="mt-10 flex gap-1.5">
              {LIFECYCLE.map((x, n) => (
                <span
                  key={x.key}
                  className={cn("h-1 flex-1 rounded-full", n <= i ? "bg-gold" : "bg-white/15")}
                />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Capabilities                                                                                                 */
/* ------------------------------------------------------------------------------------------------------------ */

const MORE: { key: string; icon: LucideIcon }[] = [
  { key: "rules", icon: Scale },
  { key: "approvals", icon: ClipboardCheck },
  { key: "conditional", icon: BadgeCheck },
  { key: "agencies", icon: Handshake },
  { key: "audit", icon: History },
  { key: "org", icon: Building2 },
];

function Tile({
  className,
  children,
  dark,
}: {
  className?: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 overflow-hidden rounded-[28px] p-6 sm:p-8",
        dark ? "bg-forest text-cream" : "bg-white ring-1 ring-forest/10",
        className,
      )}
    >
      {children}
    </div>
  );
}
function TileText({ k, dark, tag }: { k: string; dark?: boolean; tag?: Availability }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={cn("text-xl font-bold", dark ? "text-cream" : "text-forest")}>
          {t(`home.cap.${k}.title` as TKey)}
        </h3>
        {tag && (
          <AvailabilityTag
            kind={tag}
            label={t(`home.journeys.tag.${tag}` as TKey)}
            inverse={dark}
          />
        )}
      </div>
      <p className={dark ? "text-cream/75" : "text-muted"}>{t(`home.cap.${k}.body` as TKey)}</p>
    </div>
  );
}

export function Capabilities() {
  const { t } = useI18n();
  return (
    <section
      id="capabilities"
      aria-labelledby="cap-title"
      className="scroll-mt-20 bg-white py-20 sm:py-28"
    >
      <Container>
        <SectionHeading
          id="cap-title"
          eyebrow={t("home.cap.eyebrow")}
          title={t("home.cap.title")}
          body={t("home.cap.body")}
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-6">
          {/* Analysis + Arabic understanding */}
          <Tile dark className="lg:col-span-4">
            <div className="grid gap-6 md:grid-cols-2">
              <TileText k="analysis" dark tag="provider" />
              <TileText k="arabic" dark tag="provider" />
            </div>
            <div
              aria-hidden="true"
              className="flex flex-col gap-1.5 rounded-[20px] bg-white/[0.05] p-4 ring-1 ring-white/10"
              dir="rtl"
            >
              {[
                {
                  ts: "00:00",
                  text: "كريم ندى التجريبي يزيل التصبغات تماماً خلال ثلاثة أيام فقط",
                  flag: true,
                },
                {
                  ts: "00:05",
                  text: "والنتيجة مضمونة لكل أنواع البشرة بلا أي آثار جانبية",
                  flag: true,
                },
                { ts: "00:11", text: "نص على الشاشة: «النتيجة مضمونة خلال ٣ أيام»", flag: true },
              ].map((l) => (
                <p key={l.ts} className="flex items-baseline gap-3 text-sm">
                  <span className="tabular shrink-0 text-xs font-bold text-gold">{l.ts}</span>
                  <span
                    className={cn(
                      "text-cream/85",
                      l.flag &&
                        "underline decoration-[#ff6b5e] decoration-2 underline-offset-[6px]",
                    )}
                  >
                    {l.text}
                  </span>
                </p>
              ))}
            </div>
          </Tile>

          {/* Timestamp evidence */}
          <Tile className="lg:col-span-2">
            <TileText k="evidence" />
            <div aria-hidden="true" className="mt-auto rounded-[20px] bg-cream p-4">
              <div className="relative h-1.5 rounded-full bg-forest/10">
                {[0, 36, 73, 100].map((p, n) => (
                  <span
                    key={p}
                    className={cn(
                      "absolute top-1/2 size-3 -translate-y-1/2 rounded-full ring-2 ring-cream rtl:translate-x-1/2 ltr:-translate-x-1/2",
                      n === 2 ? "bg-red" : "bg-red/60",
                    )}
                    style={{ insetInlineStart: `${p}%` }}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Timer className="size-4 text-gold-deep" />
                <span className="tabular rounded-full bg-forest px-2 py-0.5 text-xs font-bold text-cream">
                  0:11
                </span>
                <span className="truncate text-forest" dir="rtl">
                  «النتيجة مضمونة خلال ٣ أيام»
                </span>
              </div>
            </div>
          </Tile>

          {/* SALEEM Fix + media editing */}
          <Tile className="lg:col-span-3">
            <div className="grid gap-6 sm:grid-cols-2">
              <TileText k="fix" tag="provider" />
              <TileText k="media" tag="available" />
            </div>
            <div
              aria-hidden="true"
              className="mt-auto flex flex-col gap-3 rounded-[20px] bg-cream p-4"
            >
              <p className="flex items-center gap-2 text-xs text-muted">
                <span className="font-bold text-red">{t("home.cap.claimLabel")}</span>
              </p>
              <p className="rounded-md bg-red-bg px-2 py-1 text-sm text-red line-through" dir="rtl">
                والنتيجة مضمونة لكل أنواع البشرة
              </p>
              <p className="text-xs font-bold text-green">{t("home.cap.fixedLabel")}</p>
              <p className="rounded-md bg-green-bg px-2 py-1 text-sm text-green" dir="rtl">
                استخدميه وفق تعليمات الاستخدام الموضحة على العبوة.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {[MicOff, Eraser, Layers, Captions, AudioLines].map((I, n) => (
                  <span
                    key={n}
                    className="grid size-9 place-items-center rounded-full bg-white text-forest ring-1 ring-forest/10"
                  >
                    <I className="size-4" />
                  </span>
                ))}
              </div>
            </div>
          </Tile>

          {/* Compare */}
          <Tile className="lg:col-span-3">
            <TileText k="compare" />
            <div aria-hidden="true" className="mt-auto grid grid-cols-2 gap-3">
              {[
                {
                  img: NADA_MEDIA.v1Claim,
                  v: "V1",
                  n: groupFindings(NADA_V1.findings).length,
                  c: "text-red",
                },
                {
                  img: NADA_MEDIA.v2Poster,
                  v: "V2",
                  n: groupFindings(NADA_V2.findings).length,
                  c: "text-amber-text",
                },
              ].map((x) => (
                <div key={x.v} className="flex items-center gap-3 rounded-[20px] bg-cream p-3">
                  <img
                    src={x.img}
                    alt=""
                    loading="lazy"
                    width={540}
                    height={945}
                    className="h-24 w-[54px] rounded-lg object-cover"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs font-bold text-muted">{x.v}</span>
                    <span
                      className={cn(
                        "tabular font-display text-4xl leading-none font-bold ltr:font-sans",
                        x.c,
                      )}
                    >
                      {x.n}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Tile>
        </div>

        <ul className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {MORE.map((m) => (
            <li key={m.key} className="flex gap-4 border-t border-forest/10 pt-6">
              <m.icon aria-hidden="true" className="mt-1 size-6 shrink-0 text-gold-deep" />
              <span className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-forest">
                  {t(`home.cap.${m.key}.title` as TKey)}
                </h3>
                <p className="text-muted">{t(`home.cap.${m.key}.body` as TKey)}</p>
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Collaboration                                                                                                */
/* ------------------------------------------------------------------------------------------------------------ */

const FLOW: { key: string; icon: LucideIcon; decides?: boolean }[] = [
  { key: "partner", icon: Handshake },
  { key: "marketer", icon: UserRound },
  { key: "reviewer", icon: ShieldCheck, decides: true },
  { key: "legal", icon: Scale },
];

export function Collaboration() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="collab-title" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="collab-title"
          eyebrow={t("home.collab.eyebrow")}
          title={t("home.collab.title")}
          body={t("home.collab.body")}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-green-bg px-3 py-1 text-sm font-medium text-green">
            <Sparkles aria-hidden="true" className="size-4" />
            {t("home.collab.ai")}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-bg px-3 py-1 text-sm font-medium text-gold-deep">
            <Gavel aria-hidden="true" className="size-4" />
            {t("home.collab.human")}
          </span>
        </div>
        <div
          className="mt-10 rounded-[28px] bg-white p-6 ring-1 ring-forest/10 sm:p-10"
          role="group"
          aria-label={t("home.collab.flowLabel")}
        >
          <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
            <span
              aria-hidden="true"
              className="absolute inset-y-6 start-6 w-px border-s-2 border-dashed border-forest/15 md:inset-x-[12%] md:inset-y-auto md:top-6 md:h-px md:w-auto md:border-s-0 md:border-t-2"
            />
            {FLOW.map((r) => (
              <li
                key={r.key}
                className="relative flex gap-4 md:flex-col md:items-center md:text-center"
              >
                <span
                  className={cn(
                    "relative z-10 grid size-12 shrink-0 place-items-center rounded-full",
                    r.decides
                      ? "bg-forest text-gold ring-4 ring-gold/25"
                      : "bg-cream text-forest ring-1 ring-forest/15",
                  )}
                >
                  <r.icon aria-hidden="true" className="size-5" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-bold text-forest">
                    {t(`home.collab.roles.${r.key}.title` as TKey)}
                  </span>
                  <span className="text-sm text-muted">
                    {t(`home.collab.roles.${r.key}.body` as TKey)}
                  </span>
                  {r.key === "marketer" && (
                    <span className="mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-green-bg px-2 py-0.5 text-xs text-green md:self-center">
                      <Sparkles aria-hidden="true" className="size-3" /> {t("home.collab.ai")}
                    </span>
                  )}
                  {r.decides && (
                    <span className="mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-amber-bg px-2 py-0.5 text-xs text-gold-deep md:self-center">
                      <Gavel aria-hidden="true" className="size-3" /> {t("home.collab.human")}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex items-start gap-4 rounded-[20px] bg-cream p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-forest text-cream">
              <Users aria-hidden="true" className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-bold text-forest">{t("home.collab.roles.admin.title")}</span>
              <span className="text-sm text-muted">{t("home.collab.roles.admin.body")}</span>
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Trust                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

const TRUST: { key: string; icon: LucideIcon }[] = [
  { key: "evidence", icon: Search },
  { key: "references", icon: Scale },
  { key: "human", icon: UserRound },
  { key: "versions", icon: Layers },
  { key: "isolation", icon: Lock },
  { key: "roles", icon: Users },
  { key: "accountability", icon: History },
  { key: "limits", icon: Sparkles },
];

export function Trust() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="trust-title" className="bg-forest-glow py-20 text-cream sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          <div className="flex flex-col gap-8">
            <SectionHeading
              id="trust-title"
              eyebrow={t("home.trust.eyebrow")}
              title={t("home.trust.title")}
              body={t("home.trust.body")}
              inverse
            />
            <div className="flex flex-col gap-4 border-s-2 border-gold ps-5">
              <p className="text-cream/85">{t("home.trust.regulatory")}</p>
              <Link
                to="/rules"
                className="inline-flex items-center gap-2 self-start font-medium text-gold hover:underline"
              >
                {t("home.trust.rulesLink")}
                <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
              </Link>
            </div>
          </div>
          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {TRUST.map((x) => (
              <li key={x.key} className="flex flex-col gap-2 border-t border-cream/15 pt-5">
                <x.icon aria-hidden="true" className="size-5 text-gold" />
                <h3 className="text-lg font-bold">
                  {t(`home.trust.items.${x.key}.title` as TKey)}
                </h3>
                <p className="text-cream/70">{t(`home.trust.items.${x.key}.body` as TKey)}</p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Final call to action                                                                                         */
/* ------------------------------------------------------------------------------------------------------------ */

export function FinalCta({ startTo, signedIn }: { startTo: string; signedIn: boolean }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="final-title" className="relative overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 start-1/2 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-gold/20 blur-[100px] rtl:translate-x-1/2"
      />
      <Container className="relative flex flex-col items-center gap-6 text-center">
        <h2
          id="final-title"
          className="max-w-3xl font-display text-[34px] leading-[1.25] font-bold text-balance text-forest sm:text-5xl ltr:font-sans ltr:tracking-tight"
        >
          {t("home.final.title")}
        </h2>
        <p className="max-w-2xl text-lg text-muted">{t("home.final.body")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to={startTo} className={cta("forest")}>
            {signedIn ? t("home.final.check") : t("home.final.start")}
          </Link>
          <Link to="/sample" className={cta("outline")}>
            {t("home.final.sample")}
          </Link>
          {!signedIn && (
            <Link to="/login" className={cta("outline")}>
              {t("home.final.demo")}
            </Link>
          )}
        </div>
      </Container>
    </section>
  );
}
