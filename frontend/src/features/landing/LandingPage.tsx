// Public landing page (D206): SALEEM as an advertising creation, correction, compliance and approval workspace.
// Every capability shown is implemented; upcoming and provider-dependent ones are labelled. No endorsement, customer,
// statistic or compliance guarantee is claimed. Product visuals use real frames of the fictional Nada Cream ad.
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Languages, Layers, ShieldCheck, Timer } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { Container, Eyebrow, cta } from "@/features/public/ui";
import { HeroStage } from "./HeroStage";
import {
  BeforeAfter,
  Capabilities,
  Collaboration,
  FinalCta,
  Journeys,
  Lifecycle,
  Trust,
} from "./sections";

/** Older public demo (herbal tea) — still reachable at /checks/<id> for existing links. */
export const DEMO_ID = "d0000000-0000-0000-0000-000000000003";

const FACTS = [
  { key: "arabic", icon: Languages },
  { key: "evidence", icon: Timer },
  { key: "versions", icon: Layers },
  { key: "human", icon: BadgeCheck },
] as const;

export function LandingPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const startTo = user ? "/new" : "/signup";
  return (
    <div className="flex flex-col">
      <section
        aria-labelledby="hero-title"
        className="relative overflow-hidden bg-forest-glow text-cream"
      >
        <Container className="grid gap-12 pt-14 pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-center lg:gap-10 lg:pt-20 lg:pb-16">
          <div className="flex flex-col gap-6">
            <Eyebrow inverse>{t("home.hero.eyebrow")}</Eyebrow>
            <h1
              id="hero-title"
              className="font-display text-[40px] leading-[1.2] font-bold text-balance sm:text-[56px] xl:text-[64px] ltr:font-sans ltr:leading-[1.08] ltr:tracking-tight"
            >
              {t("home.hero.title")}
            </h1>
            <p className="max-w-xl text-lg text-cream/80 sm:text-xl">{t("home.hero.body")}</p>
            <div className="flex flex-wrap gap-3">
              <Link to={startTo} className={cta("gold")}>
                {t("home.hero.ctaCheck")}
              </Link>
              <Link to="/sample" className={cta("ghostLight")}>
                {t("home.hero.ctaSample")}
              </Link>
            </div>
            <p className="flex max-w-xl items-start gap-2 text-sm text-cream/65">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mint" />
              {t("home.hero.note")}
            </p>
          </div>
          <HeroStage />
        </Container>
        <div className="border-t border-cream/10">
          <Container>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-4 py-6 lg:grid-cols-4">
              {FACTS.map((f) => (
                <li key={f.key} className="flex items-center gap-3 text-sm text-cream/80">
                  <f.icon aria-hidden="true" className="size-5 shrink-0 text-gold" />
                  {t(`home.facts.${f.key}`)}
                </li>
              ))}
            </ul>
          </Container>
        </div>
      </section>
      <Journeys startTo={startTo} />
      <BeforeAfter />
      <Lifecycle />
      <Capabilities />
      <Collaboration />
      <Trust />
      <FinalCta startTo={startTo} signedIn={Boolean(user)} />
    </div>
  );
}
