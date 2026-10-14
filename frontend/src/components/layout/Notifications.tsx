import * as Popover from "@radix-ui/react-dropdown-menu";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CircleCheck, CircleX, MessageSquare } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { fetchNotifications, markNotificationsRead, type Notification } from "@/lib/api/features";
import { cn } from "@/lib/utils";

function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: fetchNotifications,
    enabled: Boolean(user),
    refetchInterval: 20_000,
  });
}

function text(n: Notification, t: ReturnType<typeof useI18n>["t"]) {
  const p = (n.payload ?? {}) as {
    title?: string;
    overall_status?: string;
    decision?: string;
    reviewer?: string;
  };
  if (n.kind === "check_done")
    return t("notifications.done", {
      title: p.title || t("dashboard.untitled"),
      status: p.overall_status ? t(`status.${p.overall_status}` as never) : "",
    });
  if (n.kind === "check_failed")
    return t("notifications.failed", { title: p.title || t("dashboard.untitled") });
  if (n.kind === "share_review")
    return t("notifications.review", {
      reviewer: p.reviewer ?? "",
      decision: t(`share.decision.${p.decision}` as never),
    });
  return t("notifications.generic");
}

/** Bell with unread count; shows a toast for notifications that arrive while the app is open. */
export function NotificationsBell() {
  const { t, formatDate } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useNotifications();
  const seen = useRef<Set<string> | null>(null);
  const unread = (q.data ?? []).filter((n) => !n.read_at);

  useEffect(() => {
    if (!q.data) return;
    if (seen.current === null) {
      seen.current = new Set(q.data.map((n) => n.id));
      return;
    }
    for (const n of q.data) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      const ok = n.kind !== "check_failed";
      (ok ? toast.success : toast.error)(text(n, t), {
        action: n.submission_id
          ? {
              label: t("common.open"),
              onClick: () => void navigate({ to: "/checks/$id", params: { id: n.submission_id! } }),
            }
          : undefined,
      });
      void qc.invalidateQueries({ queryKey: ["submissions"] });
    }
  }, [q.data, t, navigate, qc]);

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (!open && unread.length)
          void markNotificationsRead(unread.map((n) => n.id)).then(() => q.refetch());
      }}
    >
      <Popover.Trigger
        aria-label={t("notifications.title") + (unread.length ? ` (${unread.length})` : "")}
        className="relative grid size-11 place-items-center rounded-full hover:bg-line/60"
      >
        <Bell aria-hidden="true" className="size-5" />
        {unread.length > 0 && (
          <span className="tabular absolute end-1.5 top-1.5 grid min-w-4.5 place-items-center rounded-full bg-red px-1 text-[11px] leading-4.5 font-bold text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[min(92vw,360px)] rounded-md border border-border bg-surface p-1.5 shadow-overlay"
        >
          <p className="px-3 py-2 text-sm font-bold">{t("notifications.title")}</p>
          {(q.data ?? []).length === 0 ? (
            <p className="px-3 pb-3 text-sm text-fg-muted">{t("notifications.empty")}</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {(q.data ?? []).map((n) => {
                const Icon =
                  n.kind === "check_failed"
                    ? CircleX
                    : n.kind === "share_review"
                      ? MessageSquare
                      : CircleCheck;
                return (
                  <Popover.Item key={n.id} asChild>
                    <Link
                      to={n.submission_id ? "/checks/$id" : "/dashboard"}
                      params={n.submission_id ? { id: n.submission_id } : undefined}
                      className={cn(
                        "flex gap-3 rounded-sm px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-sunken",
                        !n.read_at && "bg-green-bg/50",
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          n.kind === "check_failed" ? "text-red" : "text-green",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-fg">{text(n, t)}</span>
                        <span className="text-xs text-fg-muted">
                          {formatDate(n.created_at, true)}
                        </span>
                      </span>
                    </Link>
                  </Popover.Item>
                );
              })}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
