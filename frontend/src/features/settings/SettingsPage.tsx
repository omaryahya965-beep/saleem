import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download, KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  CardTitle,
  Dialog,
  ErrorState,
  Field,
  Input,
  Page,
  PageHeader,
  SegmentedControl,
  Skeleton,
  Switch,
  toast,
} from "@/components/ui";
import { useI18n, type Lang } from "@/i18n";
import { signOut, updatePassword, useAuth } from "@/lib/api/auth";
import { PLATFORMS, updateProfile, type Platform } from "@/lib/api/data";
import {
  deleteAccount,
  downloadFile,
  errorCode,
  exportMyData,
  updateNotifyPrefs,
} from "@/lib/api/features";
import { useProfile } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { UsageMeter, useUsage } from "./UsageMeter";

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = useProfile(user?.id);
  const usage = useUsage();
  const [name, setName] = useState("");
  const [license, setLicense] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState<string>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.display_name ?? "");
    setLicense(profile.data.mawthooq_license_no ?? "");
    setPlatforms(profile.data.platforms);
  }, [profile.data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["profile", user?.id] });

  const save = useMutation({
    mutationFn: () =>
      updateProfile(user!.id, {
        display_name: name.trim() || null,
        mawthooq_license_no: license.trim() || null,
        platforms,
      }),
    onSuccess: () => {
      toast.success(t("settings.saved"));
      void invalidate();
    },
    onError: () => toast.error(t("errors.generic")),
  });

  const notify = useMutation({
    mutationFn: (v: boolean) => updateNotifyPrefs(user!.id, { notify_email: v }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(t("errors.generic")),
  });

  const changePw = useMutation({
    mutationFn: () => updatePassword(password),
    onSuccess: () => {
      setPassword("");
      toast.success(t("auth.passwordUpdated"));
    },
    onError: () => toast.error(t("auth.errors.weakPassword")),
  });

  const exporter = useMutation({
    mutationFn: async () => {
      const data = await exportMyData(user!.id);
      downloadFile(
        `saleem-export-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(data, null, 2),
        "application/json",
      );
    },
    onSuccess: () => toast.success(t("settings.exportDone")),
    onError: () => toast.error(t("errors.generic")),
  });

  const remover = useMutation({
    mutationFn: () => deleteAccount(confirmEmail),
    onSuccess: async () => {
      await signOut();
      qc.clear();
      toast.success(t("settings.deleteDone"));
      void navigate({ to: "/" });
    },
    onError: (e) => {
      const code = errorCode(e);
      toast.error(
        code === "transfer_ownership_first"
          ? t("settings.deleteTransferFirst")
          : code === "confirmation_mismatch"
            ? t("settings.deleteMismatch")
            : t("errors.generic"),
      );
    },
  });

  const onSave = (e: FormEvent) => {
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
        <>
          <Card className="flex flex-col gap-3">
            <CardTitle>{t("plans.title")}</CardTitle>
            {usage.data ? <UsageMeter usage={usage.data} /> : <Skeleton className="h-12 w-full" />}
          </Card>

          <form onSubmit={onSave}>
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
              <div>
                <Button type="submit" loading={save.isPending}>
                  {t("settings.save")}
                </Button>
              </div>
            </Card>
          </form>

          <Card className="flex flex-col gap-3">
            <CardTitle>{t("settings.preferences")}</CardTitle>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("settings.language")}</span>
              <SegmentedControl
                label={t("settings.language")}
                className="self-start"
                value={lang}
                onValueChange={(l: Lang) => {
                  setLang(l);
                  if (user) void updateNotifyPrefs(user.id, { preferred_lang: l });
                }}
                options={[
                  { value: "ar", label: "العربية" },
                  { value: "en", label: "English" },
                ]}
              />
            </div>
            <Switch
              checked={profile.data?.notify_email ?? true}
              onCheckedChange={(v) => notify.mutate(v)}
              label={t("settings.notifyEmail")}
              hint={t("settings.notifyEmailHint")}
              className="border-t border-border"
            />
          </Card>

          <Card className="flex flex-col gap-4">
            <CardTitle>{t("settings.security")}</CardTitle>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (password.length < 8) return setPwError(t("auth.errPassword"));
                setPwError(undefined);
                changePw.mutate();
              }}
            >
              <Field
                label={t("auth.newPassword")}
                hint={t("auth.passwordHint")}
                error={pwError}
                className="sm:max-w-md"
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rtl:text-end"
                />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                icon={<KeyRound />}
                className="self-start"
                loading={changePw.isPending}
              >
                {t("auth.updatePassword")}
              </Button>
            </form>
          </Card>

          <Card className="flex flex-col gap-4">
            <CardTitle>{t("settings.data")}</CardTitle>
            <div className="flex flex-col gap-1">
              <p className="text-fg-muted">{t("settings.exportBody")}</p>
              <div>
                <Button
                  variant="secondary"
                  icon={<Download />}
                  loading={exporter.isPending}
                  onClick={() => exporter.mutate()}
                >
                  {t("settings.export")}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1 border-t border-border pt-4">
              <p className="font-medium text-red">{t("settings.deleteTitle")}</p>
              <p className="text-fg-muted">{t("settings.deleteBody")}</p>
              <div>
                <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirmOpen(true)}>
                  {t("settings.delete")}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("settings.deleteConfirmTitle")}
        description={t("settings.deleteConfirmBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={remover.isPending}
              disabled={confirmEmail.trim().toLowerCase() !== (user?.email ?? "").toLowerCase()}
              onClick={() => remover.mutate()}
            >
              {t("settings.deleteConfirm")}
            </Button>
          </>
        }
      >
        <Field label={t("settings.deleteTypeEmail", { email: user?.email ?? "" })}>
          <Input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            dir="ltr"
            autoComplete="off"
            className="rtl:text-end"
          />
        </Field>
      </Dialog>
    </Page>
  );
}
