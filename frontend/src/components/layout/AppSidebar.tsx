import * as RDialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  Archive,
  BadgeCheck,
  BarChart3,
  BookCheck,
  FileCheck2,
  FilePlus2,
  FlaskConical,
  Gauge,
  Inbox,
  LayoutList,
  Megaphone,
  MessageCircleQuestion,
  Package,
  PanelRightClose,
  PanelRightOpen,
  ScrollText,
  Settings2,
  ShieldCheck,
  History,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n, type TKey } from "@/i18n";
import { cn } from "@/lib/utils";
import type { NavEntry, NavGroup, NavKey } from "./navModel";

export const NAV_ICONS: Record<NavKey, ReactNode> = {
  dashboard: <LayoutList />,
  promotions: <Megaphone />,
  new: <FilePlus2 />,
  queue: <Inbox />,
  archive: <Archive />,
  rules: <ShieldCheck />,
  companyRules: <ScrollText />,
  claims: <BadgeCheck />,
  disclaimers: <FileCheck2 />,
  products: <Package />,
  team: <Users />,
  roles: <ShieldCheck />,
  features: <Settings2 />,
  analytics: <BarChart3 />,
  audit: <History />,
  ask: <MessageCircleQuestion />,
  adminMetrics: <Activity />,
  adminRules: <BookCheck />,
  adminEval: <FlaskConical />,
  adminCalibration: <Gauge />,
};

export const isActive = (i: NavEntry, pathname: string) =>
  i.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

const COLLAPSE_KEY = "saleem.sidebarCollapsed";
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

function Groups({
  groups,
  pathname,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`nav-${g.key}`} className="flex flex-col gap-0.5">
          <h2
            id={`nav-${g.key}`}
            className={cn(
              "px-3 pt-4 pb-1 text-xs font-medium text-fg-muted",
              collapsed && "sr-only",
            )}
          >
            {t(`appNav.group.${g.key}` as TKey)}
          </h2>
          {g.items.map((i) => {
            const active = isActive(i, pathname);
            const label = t(`appNav.item.${i.key}` as TKey);
            return (
              <Link
                key={i.key}
                to={i.to}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                data-testid={`nav-${i.key}`}
                className={cn(
                  "flex h-10 items-center gap-2.5 rounded-md px-3 text-sm outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-green [&_svg]:size-4 [&_svg]:shrink-0",
                  active ? "bg-green/10 font-medium text-green" : "text-fg hover:bg-sunken",
                  collapsed && "justify-center px-0",
                )}
              >
                {NAV_ICONS[i.key]}
                <span className={cn(collapsed && "sr-only")}>{label}</span>
              </Link>
            );
          })}
        </section>
      ))}
    </>
  );
}

/** Desktop sidebar: grouped sections, active state, collapsible to icons (remembered per browser). */
export function AppSidebar({ groups, pathname }: { groups: NavGroup[]; pathname: string }) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <nav
      aria-label={t("nav.mainNav")}
      data-testid="app-sidebar"
      className={cn("flex flex-col gap-1 px-2 pb-6", collapsed ? "w-16" : "w-60")}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? t("appNav.expand") : t("appNav.collapse")}
        aria-expanded={!collapsed}
        className="mt-3 flex h-9 items-center justify-center self-end rounded-md px-2 text-fg-muted hover:bg-sunken [&_svg]:size-4"
      >
        {collapsed ? (
          <PanelRightOpen className="flip-rtl" />
        ) : (
          <PanelRightClose className="flip-rtl" />
        )}
      </button>
      <Groups groups={groups} pathname={pathname} collapsed={collapsed} />
    </nav>
  );
}

/** Mobile: the full navigation in a side drawer opened from the bottom bar's «القائمة». */
export function NavDrawer({
  groups,
  pathname,
  trigger,
}: {
  groups: NavGroup[];
  pathname: string;
  trigger: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <RDialog.Root open={open} onOpenChange={setOpen}>
      <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <RDialog.Content
          className="fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-surface p-2 shadow-overlay"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between px-3 py-2">
            <RDialog.Title className="font-bold">{t("appNav.menu")}</RDialog.Title>
            <RDialog.Close
              aria-label={t("common.close")}
              className="grid size-10 place-items-center rounded-md hover:bg-sunken [&_svg]:size-5"
            >
              <X />
            </RDialog.Close>
          </div>
          <nav aria-label={t("nav.mainNav")}>
            <Groups
              groups={groups}
              pathname={pathname}
              collapsed={false}
              onNavigate={() => setOpen(false)}
            />
          </nav>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
