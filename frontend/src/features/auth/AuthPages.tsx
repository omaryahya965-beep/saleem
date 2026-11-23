import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { MailCheck, PlayCircle } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Brand, Button, Card, Field, Input, Spinner, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import {
  authErrorKey,
  sendPasswordReset,
  signIn,
  DEMO_LOGINS,
  signUp,
  updatePassword,
  type AccountIntent,
  type AuthErrorKey,
} from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { DemoRolePicker } from "./DemoRolePicker";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthLayout({
  title,
  body,
  children,
  footer,
}: {
  title: string;
  body?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { lang } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:py-16">
      <Card className="flex flex-col gap-6 sm:p-8">
        <div className="flex flex-col items-start gap-4">
          <Brand size="lg" />
          <div>
            <h1
              className={cn(
                "text-2xl font-bold",
                lang === "ar" ? "font-display" : "tracking-tight",
              )}
            >
              {title}
            </h1>
            {body && <p className="mt-1 text-fg-muted">{body}</p>}
          </div>
        </div>
        {children}
      </Card>
      {footer && <p className="text-center text-sm text-fg-muted">{footer}</p>}
    </div>
  );
}

function FormError({ code }: { code: AuthErrorKey | null }) {
  const { t } = useI18n();
  if (!code) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-red/25 bg-red-bg px-4 py-3 text-sm text-red"
    >
      {t(`auth.errors.${code}`)}
    </p>
  );
}

const linkCls = "font-medium text-green underline-offset-4 hover:underline";

export function LoginPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/_app/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const done = (to?: string) => void navigate({ to: to ?? redirect ?? "/dashboard" });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fe = {
      email: EMAIL_RE.test(email) ? undefined : t("auth.errEmail"),
      password: password ? undefined : t("auth.errPassword"),
    };
    setFieldErr(fe);
    if (fe.email || fe.password) return;
    setBusy("form");
    setError(null);
    try {
      await signIn(email.trim(), password);
      done();
    } catch (err) {
      setError(authErrorKey(err));
    } finally {
      setBusy(null);
    }
  };

  const form = (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError code={error} />
      <Field label={t("auth.email")} error={fieldErr.email}>
        <Input
          type="email"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rtl:text-end"
        />
      </Field>
      <Field label={t("auth.password")} error={fieldErr.password}>
        <Input
          type="password"
          autoComplete="current-password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rtl:text-end"
        />
      </Field>
      <Link to="/forgot-password" className={cn(linkCls, "-mt-1 self-start text-sm")}>
        {t("auth.forgot")}
      </Link>
      <Button type="submit" block loading={busy === "form"}>
        {t("auth.signIn")}
      </Button>
    </form>
  );
  const footer = (
    <p className="text-center text-sm text-fg-muted">
      {t("auth.noAccount")}{" "}
      <Link to="/signup" className={linkCls}>
        {t("auth.signUpLink")}
      </Link>
    </p>
  );

  if (!DEMO_LOGINS)
    return (
      <AuthLayout title={t("auth.signInTitle")} body={t("auth.signInBody")} footer={footer}>
        {form}
      </AuthLayout>
    );

  // D211: sign-in for existing users beside the two demo experiences (companies / individuals).
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-14" data-testid="login-page">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card className="flex flex-col gap-6 sm:p-8">
            <div className="flex flex-col items-start gap-4">
              <Brand size="lg" />
              <div>
                <h1
                  className={cn(
                    "text-2xl font-bold",
                    lang === "ar" ? "font-display" : "tracking-tight",
                  )}
                >
                  {t("auth.signInTitle")}
                </h1>
                <p className="mt-1 text-fg-muted">{t("auth.signInBody")}</p>
              </div>
            </div>
            {form}
          </Card>
          {footer}
        </div>
        <Card className="sm:p-8">
          <DemoRolePicker onSignedIn={done} />
        </Card>
      </div>
    </div>
  );
}

export function SignupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErr, setFieldErr] = useState<{ name?: string; email?: string; password?: string }>(
    {},
  );
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [intent, setIntent] = useState<AccountIntent>("personal");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fe = {
      name: name.trim() ? undefined : t("auth.errName"),
      email: EMAIL_RE.test(email) ? undefined : t("auth.errEmail"),
      password: password.length >= 8 ? undefined : t("auth.errPassword"),
    };
    setFieldErr(fe);
    if (fe.name || fe.email || fe.password) return;
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp(email.trim(), password, name.trim(), intent);
      if (needsConfirmation) setSentTo(email.trim());
      else void navigate({ to: "/welcome" });
    } catch (err) {
      setError(authErrorKey(err));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout title={t("auth.checkEmailTitle")}>
        <p className="flex items-start gap-3 text-fg">
          <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-green" />
          {t("auth.checkEmailBody", { email: sentTo })}
        </p>
        <Button asChild variant="secondary">
          <Link to="/login">{t("auth.backToSignIn")}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.signUpTitle")}
      body={t("auth.signUpBody")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className={linkCls}>
            {t("auth.signInLink")}
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError code={error} />
        <fieldset className="flex flex-col gap-2" data-testid="signup-intent">
          <legend className="mb-2 text-sm font-medium text-fg">{t("auth.intent.label")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["personal", "organization"] as const).map((k) => (
              <label
                key={k}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-[14px] border-2 p-3 text-start transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-green",
                  intent === k
                    ? k === "personal"
                      ? "border-gold-deep bg-cream"
                      : "border-forest bg-green-bg"
                    : "border-border hover:border-border-strong",
                )}
              >
                <input
                  type="radio"
                  name="intent"
                  value={k}
                  checked={intent === k}
                  onChange={() => setIntent(k)}
                  className="sr-only"
                  data-testid={`signup-intent-${k}`}
                />
                <span className="text-sm font-bold text-fg">{t(`auth.intent.${k}` as TKey)}</span>
                <span className="text-xs leading-relaxed text-fg-muted">
                  {t(`auth.intent.${k}Body` as TKey)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={t("auth.displayName")} error={fieldErr.name}>
          <Input
            autoComplete="name"
            dir="auto"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t("auth.email")} error={fieldErr.email}>
          <Input
            type="email"
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rtl:text-end"
          />
        </Field>
        <Field label={t("auth.password")} hint={t("auth.passwordHint")} error={fieldErr.password}>
          <Input
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rtl:text-end"
          />
        </Field>
        <Button type="submit" block loading={busy}>
          {t("auth.signUp")}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return setErr(t("auth.errEmail"));
    setErr(undefined);
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (e2) {
      setError(authErrorKey(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.forgotTitle")}
      body={sent ? undefined : t("auth.forgotBody")}
      footer={
        <Link to="/login" className={linkCls}>
          {t("auth.backToSignIn")}
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="flex items-start gap-3 text-fg">
          <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-green" />
          {t("auth.linkSent")}
        </p>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormError code={error} />
          <Field label={t("auth.email")} error={err}>
            <Input
              type="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rtl:text-end"
            />
          </Field>
          <Button type="submit" block loading={busy}>
            {t("auth.sendLink")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setErr(t("auth.errPassword"));
    setErr(undefined);
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success(t("auth.passwordUpdated"));
      void navigate({ to: "/dashboard" });
    } catch (e2) {
      setError(authErrorKey(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t("auth.resetTitle")}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError code={error} />
        <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")} error={err}>
          <Input
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rtl:text-end"
          />
        </Field>
        <Button type="submit" block loading={busy}>
          {t("auth.updatePassword")}
        </Button>
      </form>
    </AuthLayout>
  );
}
