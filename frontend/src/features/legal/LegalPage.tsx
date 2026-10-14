import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { Page } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { cn } from "@/lib/utils";

export const LEGAL_DOCS = ["terms", "privacy", "disclaimer", "ai"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
const SECTIONS: Record<LegalDoc, number> = { terms: 6, privacy: 8, disclaimer: 3, ai: 6 };

/** /legal/$doc — terms, privacy (PDPL-aware), disclaimer, how the AI works. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { t, lang } = useI18n();
  const k = (s: string) => `legal.${doc}.${s}` as TKey;
  return (
    <Page narrow className="flex flex-col gap-6">
      <nav aria-label={t("legal.nav")} className="flex flex-wrap gap-2">
        {LEGAL_DOCS.map((d) => (
          <Link
            key={d}
            to="/legal/$doc"
            params={{ doc: d }}
            className={cn(
              "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium",
              d === doc
                ? "border-green bg-green-bg text-ready"
                : "border-border-strong bg-surface hover:bg-sunken",
            )}
          >
            {t(`legal.${d}.title` as TKey)}
          </Link>
        ))}
      </nav>
      <article className="flex flex-col gap-5">
        <header>
          <h1
            className={cn("text-3xl font-bold", lang === "ar" ? "font-display" : "tracking-tight")}
          >
            {t(k("title"))}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{t("legal.updated")}</p>
        </header>
        <p className="flex items-start gap-2 rounded-md border border-amber/25 bg-amber-bg px-4 py-3 text-sm">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-text" />
          {t("legal.draftNotice")}
        </p>
        {Array.from({ length: SECTIONS[doc] }, (_, i) => (
          <section key={i} className="prose-measure">
            <h2 className="text-lg font-bold">{t(k(`s${i + 1}.h`))}</h2>
            <p className="mt-1.5 text-fg">{t(k(`s${i + 1}.p`))}</p>
          </section>
        ))}
      </article>
    </Page>
  );
}
