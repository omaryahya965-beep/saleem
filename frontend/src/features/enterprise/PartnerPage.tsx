import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Handshake, LinkIcon } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  CardTitle,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { usePreflightText } from "@/features/review/model";
import { useAuth } from "@/lib/api/auth";
import {
  createPartnerPromotion,
  joinPartner,
  prk,
  sendOtp,
  useMyPartnerPromotions,
  usePartnerInfo,
  verifyOtp,
} from "@/lib/api/partners";
import { CHANNELS, COMMUNICATION_TYPES, type CommunicationType } from "@/lib/api/promotions";

/** /partner/$token — an external agency signs in with an email code, accepts the terms and submits (Phase 6.3). */
export function PartnerPage({ token }: { token: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const info = usePartnerInfo(token);
  if (info.isPending)
    return (
      <Page>
        <Skeleton className="h-40 w-full" />
      </Page>
    );
  if (!info.data?.ok)
    return (
      <Page>
        <EmptyState
          icon={<LinkIcon />}
          title={t("partner.invalidTitle")}
          body={t("partner.invalidBody")}
        />
      </Page>
    );
  const d = info.data;
  const joined = d.membership?.terms_accepted && d.membership.role === "external_uploader";
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={d.org_name ?? ""} description={d.label} />
      {d.intro_ar && (
        <p className="whitespace-pre-line text-fg" dir="auto">
          {d.intro_ar}
        </p>
      )}
      {!user ? (
        <OtpSignIn />
      ) : d.membership &&
        d.membership.role !== "external_uploader" &&
        d.membership.role !== "external_reviewer" ? (
        <Card>
          <p className="text-sm">{t("partner.internalMember")}</p>
        </Card>
      ) : !joined ? (
        <Terms token={token} terms={d.terms_ar ?? ""} />
      ) : (
        <>
          {d.membership?.access_status === "pending" && (
            <p
              role="status"
              className="rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm text-amber-text"
            >
              {t("partner.pending")}
            </p>
          )}
          <MySubmissions orgId={d.org_id!} userId={user.id} />
          <NewSubmission
            token={token}
            products={d.products ?? []}
            channels={d.channels?.length ? d.channels : [...CHANNELS]}
          />
        </>
      )}
    </Page>
  );
}

function OtpSignIn() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: () => sendOtp(email.trim()),
    onSuccess: () => setSent(true),
    onError: () => toast.error(t("partner.otpFailed")),
  });
  const verify = useMutation({
    mutationFn: () => verifyOtp(email.trim(), code.trim()),
    onError: () => toast.error(t("partner.otpInvalid")),
  });
  return (
    <Card className="flex max-w-md flex-col gap-3" data-testid="partner-otp">
      <CardTitle>{t("partner.signInTitle")}</CardTitle>
      <Field label={t("auth.email")}>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
          autoComplete="email"
        />
      </Field>
      {!sent ? (
        <Button
          disabled={!/\S+@\S+\.\S+/.test(email)}
          loading={send.isPending}
          onClick={() => send.mutate()}
        >
          {t("partner.sendCode")}
        </Button>
      ) : (
        <>
          <p className="text-sm text-fg-muted">{t("partner.codeSent")}</p>
          <Field label={t("partner.code")}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              dir="ltr"
              autoComplete="one-time-code"
            />
          </Field>
          <Button
            disabled={code.trim().length < 6}
            loading={verify.isPending}
            onClick={() => verify.mutate()}
          >
            {t("partner.verify")}
          </Button>
        </>
      )}
    </Card>
  );
}

function Terms({ token, terms }: { token: string; terms: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const [ok, setOk] = useState(false);
  const join = useMutation({
    mutationFn: () => joinPartner(token),
    onSuccess: () => void qc.invalidateQueries({ queryKey: prk.info(token) }),
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Card className="flex flex-col gap-3" data-testid="partner-terms">
      <CardTitle>{t("partner.termsTitle")}</CardTitle>
      <p
        className="max-h-64 overflow-y-auto whitespace-pre-line rounded-md bg-sunken p-3 text-sm"
        dir="auto"
      >
        {terms}
      </p>
      <Checkbox
        label={t("partner.acceptTerms")}
        checked={ok}
        onChange={(e) => setOk(e.target.checked)}
      />
      <Button
        className="self-start"
        disabled={!ok}
        loading={join.isPending}
        onClick={() => join.mutate()}
      >
        {t("partner.continue")}
      </Button>
    </Card>
  );
}

function MySubmissions({ orgId, userId }: { orgId: string; userId: string }) {
  const { t } = useI18n();
  const mine = useMyPartnerPromotions(orgId, userId);
  return (
    <Card className="flex flex-col gap-3" data-testid="partner-mine">
      <CardTitle>{t("partner.mine")}</CardTitle>
      {!mine.data?.length ? (
        <p className="text-sm text-fg-muted">{t("partner.noneYet")}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {mine.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <Link
                to="/promotions/$id"
                params={{ id: p.id }}
                className="font-medium text-fg underline-offset-2 hover:underline"
                dir="auto"
              >
                {p.title}
              </Link>
              <span className="text-fg-muted">
                {t(`promo.reviewStatus.${p.review_status}` as TKey)}
              </span>
              {p.deadline_at && (
                <span className="text-fg-muted">
                  · {t("partner.deadline")}: <bdi>{p.deadline_at.slice(0, 10)}</bdi>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NewSubmission({
  token,
  products,
  channels,
}: {
  token: string;
  products: { id: string; name_ar: string; name_en: string | null }[];
  channels: string[];
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const errText = usePreflightText();
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [type, setType] = useState<CommunicationType>(COMMUNICATION_TYPES[0]!);
  const create = useMutation({
    mutationFn: () =>
      createPartnerPromotion(token, {
        title,
        productId: productId || null,
        channels: picked,
        communicationType: type,
      }),
    onSuccess: (id) => void navigate({ to: "/promotions/$id", params: { id } }),
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Card className="flex flex-col gap-3" data-testid="partner-new">
      <CardTitle>{t("partner.newTitle")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("partner.oneAtATime")}</p>
      <Field label={t("promo.fieldTitle")}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" />
      </Field>
      {products.length > 0 && (
        <Field label={t("partner.product")}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {(lang === "en" && p.name_en) || p.name_ar}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t("partner.communicationType")}>
        <Select value={type} onChange={(e) => setType(e.target.value as CommunicationType)}>
          {COMMUNICATION_TYPES.map((c) => (
            <option key={c} value={c}>
              {t(`promo.commType.${c}` as TKey)}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="flex flex-wrap gap-x-4">
        <legend className="mb-1 text-sm font-medium">{t("partner.channels")}</legend>
        {channels.map((c) => (
          <Checkbox
            key={c}
            label={t(`promo.channel.${c}` as TKey)}
            checked={picked.includes(c)}
            onChange={(e) =>
              setPicked((x) => (e.target.checked ? [...x, c] : x.filter((y) => y !== c)))
            }
          />
        ))}
      </fieldset>
      <Button
        className="self-start"
        icon={<Handshake />}
        disabled={!title.trim() || !picked.length || (products.length > 0 && !productId)}
        loading={create.isPending}
        onClick={() => create.mutate()}
      >
        {t("partner.create")}
      </Button>
    </Card>
  );
}
