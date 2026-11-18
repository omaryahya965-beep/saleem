import {
  BadgeCheck,
  Building2,
  Crown,
  Eye,
  Gavel,
  Handshake,
  Megaphone,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Dialog, Spinner } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { DEMO_PERSONAS, signInAsPersona, type DemoPersona } from "@/lib/api/auth";

const ICONS: Record<DemoPersona, ReactNode> = {
  creator: <Megaphone />,
  reviewer: <ScanSearch />,
  compliance_lead: <ShieldCheck />,
  legal: <Gavel />,
  admin: <Building2 />,
  owner: <Crown />,
  external_uploader: <Handshake />,
  external_reviewer: <BadgeCheck />,
  viewer: <Eye />,
};

/**
 * «تجربة سَليم حسب الدور»: one button opening a compact dialog with every real role. One click asks the demo
 * broker for a one-time token (no credential in the client) and opens that role's dashboard.
 */
export function DemoRolePicker({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DemoPersona | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enter = async (p: DemoPersona) => {
    setBusy(p);
    setError(null);
    try {
      await signInAsPersona(p);
      setOpen(false);
      onSignedIn();
    } catch (e) {
      const code = (e as Error).message;
      setError(
        t(
          (["rate_limited", "demo_disabled", "demo_not_seeded"].includes(code)
            ? `auth.demo.error.${code}`
            : "auth.demo.error.generic") as TKey,
        ),
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <section
      aria-labelledby="demo-roles"
      data-testid="demo-roles"
      className="flex flex-col gap-2 border-t border-border pt-4"
    >
      <h2 id="demo-roles" className="text-sm font-bold">
        {t("auth.demo.title")}
      </h2>
      <p className="text-xs text-fg-muted">{t("auth.demo.hint")}</p>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="demo-open">
        {t("auth.demo.explore")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("auth.demo.title")}
        description={t("auth.demo.dialogHint")}
        className="sm:max-w-3xl"
      >
        {error && (
          <p role="alert" className="mb-3 rounded-md bg-red-bg px-3 py-2 text-sm text-red">
            {error}
          </p>
        )}
        <ul className="grid gap-2 sm:grid-cols-3">
          {DEMO_PERSONAS.map((p) => (
            <li key={p}>
              <div className="flex h-full flex-col gap-2 rounded-md border border-border p-3">
                <span className="flex items-center gap-2 font-medium text-fg [&_svg]:size-4 [&_svg]:text-green">
                  {ICONS[p]}
                  {t(`org.roles.${p}` as TKey)}
                </span>
                <span className="flex-1 text-xs text-fg-muted">
                  {t(`rolesPage.desc.${p}` as TKey)}
                </span>
                <Button
                  size="sm"
                  onClick={() => void enter(p)}
                  disabled={busy !== null}
                  data-testid={`demo-enter-${p}`}
                >
                  {busy === p ? <Spinner /> : t("auth.demo.enter")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg-muted">{t("auth.demo.fictional")}</p>
      </Dialog>
    </section>
  );
}
