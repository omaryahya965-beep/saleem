// D211: SALEEM serves two audiences — individuals and content creators (create, check, correct, download) and companies
// and organisations (create, check, correct, collaborate, review, approve). Each card leads to the real experience:
// sign-up with the matching intent, or the demo on the sign-in page.
import { Link } from "@tanstack/react-router";
import { Building2, UserRound } from "lucide-react";
import { useI18n, type TKey } from "@/i18n";
import { Container, SectionHeading } from "@/features/public/ui";
import { cta } from "@/features/public/cta";
import { cn } from "@/lib/utils";

const INDIVIDUAL = ["create", "check", "correct", "download"] as const;
const COMPANY = ["create", "check", "correct", "collaborate", "review", "approve"] as const;

export function Audiences({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();
  const steps = (list: readonly string[], dark: boolean) => (
    <ol className="flex flex-wrap gap-2">
      {list.map((k, i) => (
        <li
          key={k}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium",
            dark ? "bg-cream/10 text-cream" : "bg-white text-forest ring-1 ring-forest/10",
          )}
        >
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full text-[11px] font-bold",
              dark ? "bg-gold text-forest" : "bg-gold/30 text-forest",
            )}
          >
            {i + 1}
          </span>
          {t(`home.audiences.step.${k}` as TKey)}
        </li>
      ))}
    </ol>
  );
  return (
    <section
      aria-labelledby="audiences-title"
      className="bg-paper py-20 sm:py-24"
      data-testid="audiences"
    >
      <Container>
        <SectionHeading
          id="audiences-title"
          eyebrow={t("home.audiences.eyebrow")}
          title={t("home.audiences.title")}
          body={t("home.audiences.body")}
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <article
            className="flex flex-col gap-6 rounded-[28px] bg-cream p-7 ring-1 ring-gold/30 sm:p-9"
            data-testid="audience-individual"
          >
            <span className="grid size-12 place-items-center rounded-full bg-white text-gold-deep">
              <UserRound aria-hidden="true" className="size-6" />
            </span>
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-2xl font-bold text-forest ltr:font-sans">
                {t("home.audiences.individual.title")}
              </h3>
              <p className="text-forest/75">{t("home.audiences.individual.body")}</p>
            </div>
            {steps(INDIVIDUAL, false)}
            <ul className="flex flex-col gap-1.5 text-sm text-forest/80">
              {(["noTeam", "authorities", "advisory"] as const).map((k) => (
                <li key={k}>• {t(`home.audiences.individual.${k}` as TKey)}</li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap gap-3">
              <Link to={signedIn ? "/dashboard" : "/signup"} className={cta("forest")}>
                {signedIn
                  ? t("home.audiences.individual.open")
                  : t("home.audiences.individual.cta")}
              </Link>
              {!signedIn && (
                <Link to="/login" className={cta("outline")}>
                  {t("home.audiences.demo")}
                </Link>
              )}
            </div>
          </article>
          <article
            className="flex flex-col gap-6 rounded-[28px] bg-forest p-7 text-cream sm:p-9"
            data-testid="audience-company"
          >
            <span className="grid size-12 place-items-center rounded-full bg-cream/10 text-gold">
              <Building2 aria-hidden="true" className="size-6" />
            </span>
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-2xl font-bold ltr:font-sans">
                {t("home.audiences.company.title")}
              </h3>
              <p className="text-cream/75">{t("home.audiences.company.body")}</p>
            </div>
            {steps(COMPANY, true)}
            <ul className="flex flex-col gap-1.5 text-sm text-cream/75">
              {(["roles", "approval", "audit"] as const).map((k) => (
                <li key={k}>• {t(`home.audiences.company.${k}` as TKey)}</li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap gap-3">
              <Link to={signedIn ? "/dashboard" : "/signup"} className={cta("gold")}>
                {signedIn ? t("home.audiences.company.open") : t("home.audiences.company.cta")}
              </Link>
              {!signedIn && (
                <Link to="/login" className={cta("ghostLight")}>
                  {t("home.audiences.demo")}
                </Link>
              )}
            </div>
          </article>
        </div>
      </Container>
    </section>
  );
}
