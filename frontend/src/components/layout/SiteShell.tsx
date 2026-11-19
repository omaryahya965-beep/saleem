import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  Home,
  LogIn,
  LogOut,
  Menu,
  Scale,
  Settings,
  ShieldCheck,
} from "lucide-react";
import {
  Suspense,
  createContext,
  lazy,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AppShell,
  Brand,
  Button,
  EmptyState,
  LanguageToggle,
  Page,
  type NavItem,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { signOut, useAuth } from "@/lib/api/auth";
import { useIsAdmin } from "@/lib/api/roles";
import { useOrgSettings } from "@/lib/api/promotions";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { AppSidebar, NAV_ICONS, NavDrawer, isActive } from "./AppSidebar";
import { DemoBanner } from "./DemoBanner";
import { buildNav, pageForPath, primaryMobile, type NavGroup } from "./navModel";
import { ShieldOff } from "lucide-react";
const NotificationsBell = lazy(() =>
  import("./Notifications").then((m) => ({ default: m.NotificationsBell })),
);

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

const itemClass =
  "flex h-11 items-center gap-2.5 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sunken [&_svg]:size-4";

type Picker = ReturnType<typeof useOrgPicker>;

/** Account menu: who you are, the active organisation (switcher), personal settings, terms and sign out only. */
function AccountMenu({ picker }: { picker: Picker }) {
  const { t } = useI18n();
  const { user } = useAuth();
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
  const name = user.user_metadata?.["display_name"] as string | undefined;
  const initial = name?.[0] ?? user.email?.[0] ?? "?";
  const orgs = picker.orgs.data ?? [];
  const active = orgs.find((o) => o.id === picker.orgId);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("nav.account")}
        data-testid="account-menu"
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
          data-testid="account-menu-content"
          className="z-50 min-w-64 rounded-md border border-border bg-surface p-1.5 shadow-overlay animate-[fade-in_150ms_ease-out]"
        >
          <div className="px-3 py-2">
            {name && <p className="text-sm font-medium text-fg">{name}</p>}
            <p dir="ltr" className="truncate text-xs text-fg-muted rtl:text-end">
              {user.email}
            </p>
            {/* Partners cannot read the organisation row: show their role even without its name. */}
            {(active || picker.role) && (
              <p className="mt-1 text-xs text-fg-muted">
                {[active?.name, picker.role && t(`org.roles.${picker.role}` as TKey)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          {orgs.length > 1 && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Label className="px-3 py-1 text-xs text-fg-muted">
                {t("appNav.switchOrg")}
              </DropdownMenu.Label>
              {orgs.map((o) => (
                <DropdownMenu.Item
                  key={o.id}
                  onSelect={() => picker.setOrgId(o.id)}
                  className={itemClass}
                >
                  {o.id === picker.orgId ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Building2 aria-hidden="true" />
                  )}
                  <span className="truncate">{o.name}</span>
                </DropdownMenu.Item>
              ))}
            </>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link to="/settings" className={itemClass}>
              <Settings aria-hidden="true" />
              {t("appNav.personalSettings")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link to="/legal/$doc" params={{ doc: "privacy" }} className={itemClass}>
              <Scale aria-hidden="true" />
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
            className="flex h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-sm text-red outline-none data-[highlighted]:bg-red-bg [&_svg]:size-4"
          >
            <LogOut aria-hidden="true" className="flip-rtl" />
            {t("nav.signOut")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Navigation groups for the signed-in user: active organisation role + its feature flags + platform admin. */
function useAppNav(picker: Picker): NavGroup[] {
  const { user } = useAuth();
  const platformAdmin = useIsAdmin(user?.id).data === true;
  const settings = useOrgSettings(picker.orgId || null);
  const features = (settings.data?.features ?? {}) as Record<string, unknown>;
  const flags = Object.fromEntries(Object.entries(features).map(([k, v]) => [k, v === true]));
  // Until memberships load, the role is unknown: show nothing rather than the personal-account menu.
  if (picker.orgs.isPending || picker.mine.isPending || (picker.orgId && settings.isPending))
    return [];
  return buildNav({ role: picker.role, orgId: picker.orgId || null, flags, platformAdmin });
}

/** Shown instead of a page the current role has no use for (never reached from the sidebar). */
function NotForRole() {
  const { t } = useI18n();
  return (
    <Page narrow>
      <EmptyState
        icon={<ShieldOff aria-hidden="true" />}
        title={t("access.notForRoleTitle")}
        body={t("access.notForRoleBody")}
        action={
          <Button asChild>
            <Link to="/dashboard">{t("access.home")}</Link>
          </Button>
        }
      />
    </Page>
  );
}

/** Site chrome: signed-in app (sidebar + slim account menu) or the marketing nav when signed out. */
export function SiteShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const picker = useOrgPicker();
  // A different signed-in user (e.g. switching demo roles) must never see the previous user's cached data or role.
  const qcShell = useQueryClient();
  const lastUser = useRef(user?.id);
  useEffect(() => {
    if (lastUser.current && lastUser.current !== user?.id) qcShell.clear();
    lastUser.current = user?.id;
  }, [user?.id, qcShell]);
  const groups = useAppNav(picker);
  // Route guard: a page outside the role's navigation is not rendered, even by typed URL (the server still filters
  // every query). Decided only once the navigation is known (memberships loaded), so nothing flashes.
  const page = pageForPath(pathname);
  const blocked = Boolean(
    page &&
    groups.length &&
    !groups.some((g) =>
      g.items.some((i) => i.key === page || (page === "adminMetrics" && i.key.startsWith("admin"))),
    ),
  );
  const signedIn = ready && Boolean(user);

  const link =
    (to: string) => (p: { className: string; children: ReactNode; "aria-current"?: "page" }) => (
      <Link to={to} className={p.className} aria-current={p["aria-current"]}>
        {p.children}
      </Link>
    );

  const appNav: NavItem[] = [
    ...primaryMobile(groups).map((i) => ({
      key: i.key,
      label: t(`appNav.item.${i.key}` as TKey),
      icon: NAV_ICONS[i.key],
      active: isActive(i, pathname),
      render: link(i.to),
    })),
    {
      key: "menu",
      label: t("appNav.menu"),
      icon: <Menu />,
      active: false,
      render: (p) => (
        <NavDrawer
          groups={groups}
          pathname={pathname}
          trigger={
            <button type="button" className={p.className} data-testid="nav-menu">
              {p.children}
            </button>
          }
        />
      ),
    },
  ];
  const publicNav: NavItem[] = [
    {
      key: "home",
      label: t("nav.home"),
      icon: <Home />,
      active: pathname === "/",
      render: link("/"),
    },
    {
      key: "rules",
      label: t("nav.rulebook"),
      icon: <ShieldCheck />,
      active: pathname.startsWith("/rules"),
      render: link("/rules"),
    },
    {
      key: "login",
      label: t("nav.signIn"),
      icon: <LogIn />,
      active: pathname.startsWith("/login"),
      mobileOnly: true,
      render: link("/login"),
    },
  ];

  return (
    <ActionBarContext.Provider value={slot}>
      <AppShell
        brand={
          <Link to={user ? "/dashboard" : "/"} aria-label={t("brand.name")} className="rounded-sm">
            <Brand />
          </Link>
        }
        nav={!ready ? [] : signedIn ? appNav : publicNav}
        sidebar={signedIn ? <AppSidebar groups={groups} pathname={pathname} /> : undefined}
        actions={
          <>
            <LanguageToggle />
            {signedIn && (
              <Suspense fallback={<span className="size-11" />}>
                <NotificationsBell />
              </Suspense>
            )}
            {ready && <AccountMenu picker={picker} />}
          </>
        }
        mobileActionBar={<div data-slot ref={setSlot} />}
      >
        {signedIn && <DemoBanner />}
        {signedIn && blocked ? <NotForRole /> : children}
      </AppShell>
    </ActionBarContext.Provider>
  );
}
