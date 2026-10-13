import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  CardTitle,
  ErrorState,
  Field,
  Input,
  Page,
  PageHeader,
  SegmentedControl,
  Skeleton,
  toast,
} from "@/components/ui";
import { useI18n, type Lang } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { PLATFORMS, updateProfile, type Platform } from "@/lib/api/data";
import { useProfile } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const profile = useProfile(user?.id);
  const [name, setName] = useState("");
  const [license, setLicense] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.display_name ?? "");
    setLicense(profile.data.mawthooq_license_no ?? "");
    setPlatforms(profile.data.platforms);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      updateProfile(user!.id, {
        display_name: name.trim() || null,
        mawthooq_license_no: license.trim() || null,
        platforms,
      }),
    onSuccess: () => {
      toast.success(t("settings.saved"));
      void qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: () => toast.error(t("errors.generic")),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Page narrow className="flex flex-col gap-6">
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      {profile.isError ? (
        <ErrorState
          title={t("settings.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void profile.refetch()}
        />
      ) : profile.isPending ? (
        <Card className="flex flex-col gap-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </Card>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5">
            <CardTitle>{t("settings.profile")}</CardTitle>
            <Field label={t("settings.displayName")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
            </Field>
            <Field label={t("settings.email")}>
              <Input
                value={user?.email ?? ""}
                readOnly
                disabled
                dir="ltr"
                className="rtl:text-end"
              />
            </Field>
            <Field
              label={t("settings.license")}
              hint={t("settings.licenseHint")}
              optional
              optionalLabel={t("common.optional")}
            >
              <Input
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                dir="ltr"
                placeholder="MW-0000-00000"
                className="rtl:text-end"
              />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t("settings.platforms")}</legend>
              <p className="text-xs text-fg-muted">{t("settings.platformsHint")}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const on = platforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setPlatforms((xs) => (on ? xs.filter((x) => x !== p) : [...xs, p]))
                      }
                      className={cn(
                        "inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-150",
                        on
                          ? "border-green bg-green-bg text-ready"
                          : "border-border-strong bg-surface text-fg hover:bg-sunken",
                      )}
                    >
                      {t(`platforms.${p}`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Card>
          <Card className="flex flex-col gap-3">
            <CardTitle>{t("settings.language")}</CardTitle>
            <SegmentedControl
              label={t("settings.language")}
              value={lang}
              onValueChange={(l: Lang) => setLang(l)}
              options={[
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
              ]}
            />
          </Card>
          <div>
            <Button type="submit" loading={save.isPending}>
              {t("settings.save")}
            </Button>
          </div>
        </form>
      )}
    </Page>
  );
}
