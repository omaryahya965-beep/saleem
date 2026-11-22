import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, CardTitle, Field, Input, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import {
  AUTHORITIES,
  savePersonalPreferences,
  type Authority,
  type PersonalWorkspace,
} from "@/lib/api/personal";
import { cn } from "@/lib/utils";

/**
 * D211 personal settings: the workspace's display name and the authorities the user usually advertises under
 * (pre-selected on a new check; never a rule activation). Nothing organisational lives here.
 */
export function PersonalSettingsCard({ workspace }: { workspace: PersonalWorkspace }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(workspace.display_name ?? "");
  const [usual, setUsual] = useState<Authority[]>(workspace.default_authorities ?? []);
  useEffect(() => {
    setName(workspace.display_name ?? "");
    setUsual(workspace.default_authorities ?? []);
  }, [workspace]);
  const save = useMutation({
    mutationFn: () => savePersonalPreferences(name, usual),
    onSuccess: () => {
      toast.success(t("settings.saved"));
      void qc.invalidateQueries({ queryKey: ["personal-workspace"] });
    },
    onError: () => toast.error(t("errors.generic")),
  });
  const toggle = (a: Authority) =>
    setUsual((u) => (u.includes(a) ? u.filter((x) => x !== a) : [...u, a]));

  return (
    <Card className="flex flex-col gap-5" data-testid="personal-settings">
      <div>
        <CardTitle>{t("personalSettings.title")}</CardTitle>
        <p className="mt-1 text-sm text-fg-muted">{t("personalSettings.body")}</p>
      </div>
      <Field label={t("welcome.personal.name")} hint={t("welcome.personal.nameHint")}>
        <Input value={name} dir="auto" maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("personalSettings.usual")}</legend>
        <p className="text-xs text-fg-muted">{t("personalSettings.usualHint")}</p>
        <div className="flex flex-wrap gap-2">
          {AUTHORITIES.map((a) => {
            const on = usual.includes(a);
            return (
              <button
                key={a}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(a)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  on
                    ? "border-green bg-green-bg text-green"
                    : "border-border hover:border-border-strong",
                )}
              >
                {on && <Check aria-hidden="true" className="size-3.5" />}
                {t(`authority.name.${a}` as TKey)}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button
          loading={save.isPending}
          onClick={() => save.mutate()}
          data-testid="personal-settings-save"
        >
          {t("settings.save")}
        </Button>
      </div>
    </Card>
  );
}
