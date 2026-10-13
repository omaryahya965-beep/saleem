import { Languages } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** LanguageToggle — switches AR ⇄ EN; the label is shown in the target language. */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const target = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => setLang(target)}
      lang={target}
      aria-label={`${t("nav.language")}: ${t("nav.switchTo")}`}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-fg hover:bg-line/60",
        className,
      )}
    >
      <Languages aria-hidden="true" className="size-4.5" />
      {t("nav.switchTo")}
    </button>
  );
}

/** Brand — wordmark with the س mark. */
export function Brand({ className, inverse }: { className?: string; inverse?: boolean }) {
  const { t, lang } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-9 place-items-center rounded-[10px] font-display text-xl leading-none font-bold",
          inverse ? "bg-mint text-ink" : "bg-green text-white",
        )}
      >
        س
      </span>
      <span
        className={cn(
          "text-2xl leading-none font-bold",
          lang === "ar" ? "font-display" : "font-sans text-xl tracking-wide",
          inverse ? "text-paper" : "text-fg",
        )}
      >
        {t("brand.name")}
      </span>
    </span>
  );
}

export interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  /** Rendered link element — keeps the shell router-agnostic. */
  render: (props: { className: string; children: ReactNode; "aria-current"?: "page" }) => ReactNode;
}

interface AppShellProps {
  brand: ReactNode;
  nav: NavItem[];
  /** Right/left-end actions in the top bar (language toggle, account menu). */
  actions?: ReactNode;
  /** Sticky bar above the bottom nav on mobile (primary page action). */
  mobileActionBar?: ReactNode;
  children: ReactNode;
  /** Hide the bottom nav (e.g. signed-out marketing pages). */
  hideMobileNav?: boolean;
}

/**
 * AppShell — top bar (brand, primary nav, actions) on desktop; top bar + bottom tab bar
 * on mobile. Includes a skip link and a single <main> landmark.
 */
export function AppShell({
  brand,
  nav,
  actions,
  mobileActionBar,
  children,
  hideMobileNav,
}: AppShellProps) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("common.skipToContent")}
      </a>
      <header className="no-print sticky top-0 z-40 border-b border-border bg-paper/92 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-8">
          {brand}
          <nav aria-label={t("nav.mainNav")} className="hidden h-full items-stretch gap-1 md:flex">
            {nav.map((item) => (
              <span key={item.key} className="flex">
                {item.render({
                  className: cn(
                    "relative inline-flex items-center px-3 text-[15px] font-medium transition-colors duration-150",
                    "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full",
                    item.active ? "text-fg after:bg-green" : "text-fg-muted hover:text-fg",
                  ),
                  children: item.label,
                  ...(item.active ? { "aria-current": "page" as const } : {}),
                })}
              </span>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">{actions}</div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className={cn("flex-1 outline-none", !hideMobileNav && "pb-24 md:pb-0")}
      >
        {children}
      </main>

      {!hideMobileNav && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 md:hidden">
          {mobileActionBar && (
            <div className="border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
              {mobileActionBar}
            </div>
          )}
          <nav
            aria-label={t("nav.mainNav")}
            className="grid border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
            style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
          >
            {nav.map((item) => (
              <span key={item.key} className="flex">
                {item.render({
                  className: cn(
                    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium [&_svg]:size-5",
                    item.active ? "text-green" : "text-fg-muted",
                  ),
                  children: (
                    <>
                      {item.icon}
                      <span>{item.label}</span>
                    </>
                  ),
                  ...(item.active ? { "aria-current": "page" as const } : {}),
                })}
              </span>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

/** PageHeader — page title, optional description, and actions (one primary). */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  const { lang } = useI18n();
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1
          className={cn(
            "text-2xl font-bold text-fg sm:text-3xl",
            lang === "ar" ? "font-display" : "font-sans tracking-tight",
          )}
        >
          {title}
        </h1>
        {description && <p className="prose-measure mt-1.5 text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Page — standard page container (max 1200px, 16/32px gutters, vertical rhythm). */
export function Page({
  children,
  className,
  narrow,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-8 sm:py-10",
        narrow ? "max-w-[880px]" : "max-w-[1200px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
