// Public website chrome (D206): sticky navigation with a real mobile menu, one <main id="main"> landmark (the
// prerenderer and the skip link rely on it) and a footer with existing links only. Used by «/» and «/sample».
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Brand, LanguageToggle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { Container } from "./ui";
import { cta } from "./cta";

type NavLink = { key: string; to: string; hash?: string };
const LINKS: NavLink[] = [
  { key: "capabilities", to: "/", hash: "capabilities" },
  { key: "how", to: "/", hash: "how" },
  { key: "sample", to: "/sample" },
  { key: "rules", to: "/rules" },
];

export function PublicLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-forest px-4 py-2 text-cream focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("common.skipToContent")}
      </a>
      <PublicNav />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

function PublicNav() {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const panelId = useId();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const signedIn = ready && Boolean(user);
  const active = (l: NavLink) => !l.hash && pathname.startsWith(l.to);
  const linkClass = (l: NavLink) =>
    cn(
      "relative inline-flex h-11 items-center px-3 text-[15px] font-medium transition-colors",
      active(l) ? "text-forest" : "text-forest/70 hover:text-forest",
      active(l) &&
        "after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-gold",
    );
  return (
    <header className="no-print sticky top-0 z-40 border-b border-forest/10 bg-cream/95 backdrop-blur-md supports-[backdrop-filter]:bg-cream/90">
      <Container className="flex h-16 items-center gap-4">
        <Link to="/" aria-label={t("brand.name")} className="rounded-sm">
          <Brand />
        </Link>
        <nav aria-label={t("site.nav.label")} className="ms-4 hidden lg:block">
          <ul className="flex items-center">
            {LINKS.map((l) => (
              <li key={l.key}>
                <Link
                  to={l.to}
                  hash={l.hash}
                  className={linkClass(l)}
                  aria-current={active(l) ? "page" : undefined}
                >
                  {t(`site.nav.${l.key}` as never)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <LanguageToggle className="text-forest" />
          {ready && !signedIn && (
            <Link
              to="/login"
              className="hidden h-11 items-center rounded-full px-4 text-[15px] font-medium text-forest hover:bg-forest/5 sm:inline-flex"
            >
              {t("site.nav.login")}
            </Link>
          )}
          {ready && (
            <Link
              to={signedIn ? "/dashboard" : "/signup"}
              className={cta("forest", "hidden px-5 sm:inline-flex")}
            >
              {signedIn ? t("site.nav.dashboard") : t("site.nav.start")}
            </Link>
          )}
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-forest hover:bg-forest/5 lg:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? t("site.nav.close") : t("site.nav.menu")}
            onClick={() => setOpen((x) => !x)}
          >
            {open ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </Container>
      <div id={panelId} hidden={!open} className="border-t border-forest/10 bg-cream lg:hidden">
        <Container className="flex flex-col gap-1 py-4">
          <nav aria-label={t("site.nav.label")}>
            <ul className="flex flex-col">
              {LINKS.map((l) => (
                <li key={l.key}>
                  <Link
                    to={l.to}
                    hash={l.hash}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center rounded-md px-3 text-lg font-medium text-forest hover:bg-forest/5"
                  >
                    {t(`site.nav.${l.key}` as never)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {!signedIn && (
              <Link to="/login" className={cta("outline")}>
                {t("site.nav.login")}
              </Link>
            )}
            <Link
              to={signedIn ? "/dashboard" : "/signup"}
              className={cta("forest", signedIn ? "col-span-2" : "")}
            >
              {signedIn ? t("site.nav.dashboard") : t("site.nav.start")}
            </Link>
          </div>
        </Container>
      </div>
    </header>
  );
}

function PublicFooter() {
  const { t } = useI18n();
  const col = (title: string, items: { label: string; node: ReactNode }[]) => (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-cream">{title}</p>
      <ul className="flex flex-col gap-2 text-sm text-cream/70">
        {items.map((i) => (
          <li key={i.label}>{i.node}</li>
        ))}
      </ul>
    </div>
  );
  const a = "rounded-sm hover:text-cream";
  return (
    <footer className="no-print bg-forest text-cream">
      <Container className="grid gap-10 py-14 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="flex max-w-sm flex-col gap-4">
          <Brand inverse />
          <p className="text-sm text-cream/70">{t("site.footer.tagline")}</p>
        </div>
        {col(t("site.footer.product"), [
          {
            label: "cap",
            node: (
              <Link to="/" hash="capabilities" className={a}>
                {t("site.nav.capabilities")}
              </Link>
            ),
          },
          {
            label: "how",
            node: (
              <Link to="/" hash="how" className={a}>
                {t("site.nav.how")}
              </Link>
            ),
          },
          {
            label: "sample",
            node: (
              <Link to="/sample" className={a}>
                {t("site.nav.sample")}
              </Link>
            ),
          },
          {
            label: "rules",
            node: (
              <Link to="/rules" className={a}>
                {t("site.nav.rules")}
              </Link>
            ),
          },
        ])}
        {col(t("site.footer.account"), [
          {
            label: "login",
            node: (
              <Link to="/login" className={a}>
                {t("site.nav.login")}
              </Link>
            ),
          },
          {
            label: "signup",
            node: (
              <Link to="/signup" className={a}>
                {t("site.footer.signup")}
              </Link>
            ),
          },
        ])}
        {col(
          t("site.footer.legal"),
          (["terms", "privacy", "disclaimer", "ai"] as const).map((d) => ({
            label: d,
            node: (
              <Link to="/legal/$doc" params={{ doc: d }} className={a}>
                {t(`site.footer.${d}`)}
              </Link>
            ),
          })),
        )}
      </Container>
      <Container className="flex flex-col gap-3 border-t border-cream/10 py-6 text-xs text-cream/60 md:flex-row md:items-start md:justify-between">
        <p className="max-w-3xl">{t("site.footer.notice")}</p>
        <p className="shrink-0">{t("site.footer.rights", { year: new Date().getFullYear() })}</p>
      </Container>
    </footer>
  );
}
