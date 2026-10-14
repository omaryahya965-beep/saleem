import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BookCheck,
  Building2,
  FilePlus2,
  FlaskConical,
  Scale,
  Home,
  LayoutList,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppShell, Brand, LanguageToggle, type NavItem } from "@/components/ui";
import { useI18n } from "@/i18n";
import { signOut, useAuth } from "@/lib/api/auth";
import { useIsAdmin } from "@/lib/api/hooks";
import { NotificationsBell } from "./Notifications";

const ActionBarContext = createContext<HTMLElement | null>(null);

/**
 * Renders `children` in the shell's sticky mobile action bar (above the bottom nav), via a portal.
 * Also leaves a spacer so page content isn't hidden behind the bar.
 */
export function MobileActionBar({ children }: { children: ReactNode }) {
  const slot = useContext(ActionBarContext);
  return (
    <>
      <div aria-hidden="true" className="h-20 md:hidden" />
      {slot && createPortal(children, slot)}
    </>
  );
}

function AccountMenu() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id).data === true;
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (!user) {
    return (
      <Link
        to="/login"
        className="hidden h-11 items-center rounded-full bg-green px-5 text-sm font-medium text-white hover:bg-green-hover sm:inline-flex"
      >
        {t("nav.signIn")}
      </Link>
    );
  }
  const initial =
    (user.user_metadata?.["display_name"] as string | undefined)?.[0] ?? user.email?.[0] ?? "?";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("nav.account")}
        className="grid size-11 place-items-center rounded-full hover:bg-line/60"
      >
        <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-bold text-paper uppercase">
          {initial}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-md border border-border bg-surface p-1.5 shadow-overlay animate-[fade-in_150ms_ease-out]"
        >
          <div className="px-3 py-2">
            <p className="text-xs text-fg-muted">{t("nav.signedInAs")}</p>
            <p dir="ltr" className="truncate text-sm font-medium text-fg rtl:text-end">
              {user.email}
            </p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link
              to="/settings"
              className="flex h-11 items-center gap-2.5 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sunken"
            >
              <Settings aria-hidden="true" className="size-4" />
              {t("nav.settings")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              to="/archive"
              className="flex h-11 items-center gap-2.5 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sunken"
            >
              <Archive aria-hidden="true" className="size-4" />
              {t("nav.archive")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              to="/org"
              className="flex h-11 items-center gap-2.5 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sunken"
            >
              <Building2 aria-hidden="true" className="size-4" />
              {t("nav.workspace")}
            </Link>
          </DropdownMenu.Item>
          {isAdmin && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <Link
                  to="/admin/eval"
                  className="flex h-11 items-center gap-2.5 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sunken"
                >
                  <FlaskConical aria-hidden="true" className="size-4" />
                  {t("nav.evalNav")}
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  to="/admin/rules"
                  className="flex h-11 items-center gap-2.5 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sunken"
                >
                  <BookCheck aria-hidden="true" className="size-4" />
                  {t("nav.rulesAdmin")}
                </Link>
              </DropdownMenu.Item>
            </>
          )}
          <DropdownMenu.Item asChild>
            <Link
              to="/legal/$doc"
              params={{ doc: "privacy" }}
              className="flex h-11 items-center gap-2.5 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sunken"
            >
              <Scale aria-hidden="true" className="size-4" />
              {t("nav.legal")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={async () => {
              await signOut();
              qc.clear();
              void navigate({ to: "/" });
            }}
            className="flex h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-sm text-red outline-none data-[highlighted]:bg-red-bg"
          >
            <LogOut aria-hidden="true" className="size-4 flip-rtl" />
            {t("nav.signOut")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Site chrome for every page: signed-in product nav, or marketing nav when signed out. */
export function SiteShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  const link =
    (to: string) => (p: { className: string; children: ReactNode; "aria-current"?: "page" }) => (
      <Link to={to} className={p.className} aria-current={p["aria-current"]}>
        {p.children}
      </Link>
    );

  const items: (Omit<NavItem, "render"> & { to: string })[] = user
    ? [
        {
          key: "dashboard",
          to: "/dashboard",
          label: t("nav.dashboard"),
          icon: <LayoutList />,
          active: pathname.startsWith("/dashboard") || pathname.startsWith("/checks"),
        },
        {
          key: "new",
          to: "/new",
          label: t("nav.newCheck"),
          icon: <FilePlus2 />,
          active: pathname.startsWith("/new"),
        },
        {
          key: "rules",
          to: "/rules",
          label: t("nav.rulebook"),
          icon: <ShieldCheck />,
          active: pathname.startsWith("/rules"),
        },
        {
          key: "settings",
          to: "/settings",
          label: t("nav.settings"),
          icon: <Settings />,
          active: pathname.startsWith("/settings"),
        },
      ]
    : [
        { key: "home", to: "/", label: t("nav.home"), icon: <Home />, active: pathname === "/" },
        {
          key: "rules",
          to: "/rules",
          label: t("nav.rulebook"),
          icon: <ShieldCheck />,
          active: pathname.startsWith("/rules"),
        },
        {
          key: "login",
          to: "/login",
          label: t("nav.signIn"),
          icon: user ? <UserRound /> : <LogIn />,
          active: pathname.startsWith("/login"),
          mobileOnly: true,
        },
      ];

  const nav: NavItem[] = items.map((i) => ({ ...i, render: link(i.to) }));

  return (
    <ActionBarContext.Provider value={slot}>
      <AppShell
        brand={
          <Link to={user ? "/dashboard" : "/"} aria-label={t("brand.name")} className="rounded-sm">
            <Brand />
          </Link>
        }
        nav={ready ? nav : []}
        actions={
          <>
            <LanguageToggle />
            {ready && user && <NotificationsBell />}
            {ready && <AccountMenu />}
          </>
        }
        mobileActionBar={<div data-slot ref={setSlot} />}
      >
        {children}
      </AppShell>
    </ActionBarContext.Provider>
  );
}
