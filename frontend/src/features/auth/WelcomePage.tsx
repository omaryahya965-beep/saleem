import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, MailOpen, UserRound } from "lucide-react";
import { useState } from "react";
import { Brand, Button, Card, Field, Input, Page } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { ensurePersonalWorkspace } from "@/lib/api/personal";
import { cn } from "@/lib/utils";
import { PERSONAL, setActiveOrg, useOrgPicker } from "@/features/libraries/orgPicker";

/**
 * D211 onboarding: «how will you use SALEEM?». Personal use creates the caller's own personal workspace (server RPC;
 * never an organisation, membership or role). Organisation use keeps the existing secure path: create an organisation
 * (you become its owner) or join one through an invitation link. The choice made at sign-up is pre-selected.
 */
export function WelcomePage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const picker = useOrgPicker();
  const metaIntent = user?.user_metadata?.["account_intent"] as string | undefined;
  const [choice, setChoice] = useState<"personal" | "organization">(
    metaIntent === "organization" ? "organization" : "personal",
  );
  const [name, setName] = useState(
    (user?.user_metadata?.["display_name"] as string | undefined) ?? "",
  );
  const hasOrg = (picker.orgs.data ?? []).length > 0 || (picker.mine.data ?? []).length > 0;

  const personal = useMutation({
    mutationFn: () => ensurePersonalWorkspace(name.trim() || undefined),
    onSuccess: async () => {
      setActiveOrg(PERSONAL);
      await qc.invalidateQueries({ queryKey: ["personal-workspace"] });
      void navigate({ to: "/dashboard" });
    },
  });

  return (
    <Page narrow>
      <div
        className="mx-auto flex max-w-3xl flex-col gap-6 py-6 sm:py-10"
        data-testid="welcome-page"
      >
        <div className="flex flex-col items-start gap-3">
          <Brand />
          <h1
            className={cn("text-3xl font-bold", lang === "ar" ? "font-display" : "tracking-tight")}
          >
            {t("welcome.title")}
          </h1>
          <p className="text-fg-muted">{t("welcome.body")}</p>
        </div>

        <div
          className="grid gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-label={t("welcome.title")}
        >
          {(
            [
              [
                "personal",
                <UserRound key="p" />,
                "border-gold-deep bg-cream",
                "bg-amber-bg text-amber-text",
              ],
              [
                "organization",
                <Building2 key="o" />,
                "border-forest bg-green-bg",
                "bg-green-bg text-green",
              ],
            ] as const
          ).map(([k, icon, on, iconCls]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={choice === k}
              onClick={() => setChoice(k)}
              data-testid={`welcome-${k}`}
              className={cn(
                "flex flex-col gap-2 rounded-[18px] border-2 p-5 text-start transition-colors focus-visible:outline-2 focus-visible:outline-green",
                choice === k ? on : "border-border bg-card hover:border-border-strong",
              )}
            >
              <span className="flex items-center justify-between">
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-full [&_svg]:size-5",
                    iconCls,
                  )}
                >
                  {icon}
                </span>
                {choice === k && <Check aria-hidden="true" className="size-5 text-green" />}
              </span>
              <span className="text-lg font-bold">{t(`welcome.${k}.title` as TKey)}</span>
              <span className="text-sm leading-relaxed text-fg-muted">
                {t(`welcome.${k}.body` as TKey)}
              </span>
            </button>
          ))}
        </div>

        {choice === "personal" ? (
          <Card className="flex flex-col gap-4">
            {picker.personal.data ? (
              <>
                <p className="text-sm text-fg">{t("welcome.personal.exists")}</p>
                <Button
                  onClick={() => {
                    setActiveOrg(PERSONAL);
                    void navigate({ to: "/dashboard" });
                  }}
                >
                  {t("welcome.personal.open")}
                </Button>
              </>
            ) : (
              <>
                <Field label={t("welcome.personal.name")} hint={t("welcome.personal.nameHint")}>
                  <Input
                    value={name}
                    dir="auto"
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <ul className="flex flex-col gap-1.5 text-sm text-fg-muted">
                  {(["noOrg", "noApproval", "advisory"] as const).map((k) => (
                    <li key={k} className="flex items-start gap-2">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green" />
                      {t(`welcome.personal.${k}` as TKey)}
                    </li>
                  ))}
                </ul>
                {personal.isError && (
                  <p role="alert" className="rounded-md bg-red-bg px-3 py-2 text-sm text-red">
                    {t(
                      (personal.error as Error).message === "demo_forbidden"
                        ? "welcome.demoForbidden"
                        : "errors.generic",
                    )}
                  </p>
                )}
                <Button
                  loading={personal.isPending}
                  onClick={() => personal.mutate()}
                  data-testid="welcome-personal-create"
                >
                  {t("welcome.personal.create")}
                </Button>
              </>
            )}
          </Card>
        ) : (
          <Card className="flex flex-col gap-4">
            <p className="text-sm text-fg">{t("welcome.organization.how")}</p>
            <div className="flex flex-wrap gap-2">
              {hasOrg ? (
                <Button onClick={() => void navigate({ to: "/dashboard" })}>
                  {t("welcome.organization.open")}
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/org">{t("welcome.organization.create")}</Link>
                </Button>
              )}
            </div>
            <p className="flex items-start gap-2 text-sm text-fg-muted">
              <MailOpen aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t("welcome.organization.invite")}
            </p>
          </Card>
        )}
      </div>
    </Page>
  );
}
