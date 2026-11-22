import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, Card, CardTitle, Field, Input, toast } from "@/components/ui";
import { useI18n } from "@/i18n";
import { savePersonalPreferences, type PersonalWorkspace } from "@/lib/api/personal";

/**
 * D211 personal settings: the workspace's display name. Nothing organisational lives here, and no regulatory
 * authority is ever chosen by the user (D213: all are considered automatically).
 */
export function PersonalSettingsCard({ workspace }: { workspace: PersonalWorkspace }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(workspace.display_name ?? "");
  useEffect(() => {
    setName(workspace.display_name ?? "");
  }, [workspace]);
  const save = useMutation({
    // D213: authorities are always considered automatically; only the display name is a preference.
    mutationFn: () => savePersonalPreferences(name, []),
    onSuccess: () => {
      toast.success(t("settings.saved"));
      void qc.invalidateQueries({ queryKey: ["personal-workspace"] });
    },
    onError: () => toast.error(t("errors.generic")),
  });

  return (
    <Card className="flex flex-col gap-5" data-testid="personal-settings">
      <div>
        <CardTitle>{t("personalSettings.title")}</CardTitle>
        <p className="mt-1 text-sm text-fg-muted">{t("personalSettings.body")}</p>
      </div>
      <Field label={t("welcome.personal.name")} hint={t("welcome.personal.nameHint")}>
        <Input value={name} dir="auto" maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>
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
