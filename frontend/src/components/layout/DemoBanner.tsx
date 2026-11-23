import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/i18n";
import { signOut, useAuth } from "@/lib/api/auth";
import { useOrgPicker } from "@/features/libraries/orgPicker";

/** Demo sessions end this long after sign-in (users flagged app_metadata.demo by the server-side seed). */
export const DEMO_SESSION_MS = 2 * 60 * 60 * 1000;

/** Marks a demo session (fictional data) and signs it out when it expires. Nothing for real users. */
export function DemoBanner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const demo = user?.app_metadata?.["demo"] === true;
  // D211: the individual demo is a personal workspace, not the fictional bank.
  const personalDemo = useOrgPicker().personal.data?.is_demo === true;
  const started = user?.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : Date.now();
  useEffect(() => {
    if (!demo) return;
    const left = started + DEMO_SESSION_MS - Date.now();
    const end = async () => {
      await signOut();
      qc.clear();
      void navigate({ to: "/login" });
    };
    if (left <= 0) {
      void end();
      return;
    }
    const timer = setTimeout(() => void end(), left);
    return () => clearTimeout(timer);
  }, [demo, started, navigate, qc]);
  if (!demo) return null;
  return (
    <div
      role="status"
      data-testid="demo-banner"
      className="no-print flex items-center justify-center gap-2 bg-amber-bg px-4 py-1.5 text-xs text-amber-text [&_svg]:size-3.5"
    >
      <FlaskConical aria-hidden="true" />
      {personalDemo ? t("auth.demo.bannerPersonal") : t("auth.demo.banner")}
    </div>
  );
}
