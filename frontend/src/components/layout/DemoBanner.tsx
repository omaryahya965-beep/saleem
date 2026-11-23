import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/i18n";
import { signOut, useAuth } from "@/lib/api/auth";
import { useOrgPicker } from "@/features/libraries/orgPicker";

/** Demo sessions end this long after sign-in (users flagged app_metadata.demo by the server-side seed). */
export const DEMO_SESSION_MS = 2 * 60 * 60 * 1000;

/**
 * Demo sessions: signs the session out when it expires (unchanged security model, D211/D215) and marks it with a
 * compact «تجريبي» chip in the top bar. The full-width banner on every page was removed (D219): demo identification
 * stays at entry (login), in the account menu and in this chip. Nothing for real users.
 */
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
    <span
      data-testid="demo-chip"
      title={personalDemo ? t("auth.demo.chipTitlePersonal") : t("auth.demo.chipTitle")}
      className="no-print hidden h-7 items-center gap-1 rounded-full border border-gold/50 bg-amber-bg px-2.5 text-xs font-medium text-amber-text sm:inline-flex [&_svg]:size-3.5"
    >
      <FlaskConical aria-hidden="true" />
      {t("auth.demo.chip")}
      <span className="sr-only">
        {" — "}
        {personalDemo ? t("auth.demo.chipTitlePersonal") : t("auth.demo.chipTitle")}
      </span>
    </span>
  );
}
