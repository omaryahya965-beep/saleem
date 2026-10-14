import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { MailCheck, PlayCircle } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Brand, Button, Card, Field, Input, Spinner, toast } from "@/components/ui";
import { useI18n } from "@/i18n";
import {
  authErrorKey,
  sendPasswordReset,
  signIn,
  TEST_ACCOUNTS,
  SHOW_TEST_ACCOUNTS,
  signUp,
  updatePassword,
  type AuthErrorKey,
} from "@/lib/api/auth";
import { cn } from "@/lib/utils";

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
          <Brand />
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/_app/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const done = () => void navigate({ to: redirect ?? "/dashboard" });

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

  const onTestAccount = async (acc: (typeof TEST_ACCOUNTS)[number]) => {
    setBusy(acc.email);
    setError(null);
    setEmail(acc.email);
    setPassword(acc.password);
    try {
      await signIn(acc.email, acc.password);
      done();
    } catch {
      setError("demoUnavailable");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthLayout
      title={t("auth.signInTitle")}
      body={t("auth.signInBody")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link to="/signup" className={linkCls}>
            {t("auth.signUpLink")}
          </Link>
        </>
      }
    >
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
      <div className="flex items-center gap-3 text-sm text-fg-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      {SHOW_TEST_ACCOUNTS && (
        <section aria-labelledby="test-accounts" className="flex flex-col gap-2">
          <h2 id="test-accounts" className="text-sm font-bold">
            {t("auth.testAccounts")}
          </h2>
          <p className="text-xs text-fg-muted">{t("auth.testAccountsHint")}</p>
          <ul className="flex flex-col gap-2">
            {TEST_ACCOUNTS.map((acc) => (
              <li key={acc.email}>
                <button
                  type="button"
                  onClick={() => void onTestAccount(acc)}
                  disabled={busy !== null}
                  className="flex min-h-14 w-full items-center gap-3 rounded-md border border-border bg-sunken px-3 py-2 text-start transition-colors hover:border-green disabled:opacity-60"
                >
                  {busy === acc.email ? (
                    <Spinner className="text-green" />
                  ) : (
                    <PlayCircle aria-hidden="true" className="size-5 shrink-0 text-green" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{t(acc.label)}</span>
                    <span
                      dir="ltr"
                      className="block truncate font-mono text-xs text-fg-muted rtl:text-end"
                    >
                      {acc.email} · {acc.password}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AuthLayout>
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
      const { needsConfirmation } = await signUp(email.trim(), password, name.trim());
      if (needsConfirmation) setSentTo(email.trim());
      else void navigate({ to: "/dashboard" });
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
