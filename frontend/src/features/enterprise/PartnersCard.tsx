import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { usePreflightText } from "@/features/review/model";
import { flagOn } from "@/lib/api/flows";
import {
  createPartnerLink,
  decidePartnerAccess,
  partnerUrl,
  prk,
  setLinkActive,
  usePartnerLinks,
  usePartnerMembers,
} from "@/lib/api/partners";
import { CHANNELS, useOrgSettings, useProducts } from "@/lib/api/promotions";

/** Owners/admins create partner links (the URL is shown once) and approve partner access (Phase 6.3). */
export function PartnersCard({ orgId }: { orgId: string }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const links = usePartnerLinks(orgId);
  const members = usePartnerMembers(orgId);
  const products = useProducts(orgId);
  const errText = usePreflightText();
  const [form, setForm] = useState<{
    label: string;
    products: string[];
    channels: string[];
    intro: string;
    terms: string;
  } | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => createPartnerLink(orgId, form!),
    onSuccess: (token) => {
      setCreated(partnerUrl(token));
      setForm(null);
      void qc.invalidateQueries({ queryKey: prk.links(orgId) });
    },
    onError: (e) => toast.error(errText(e)),
  });
  const toggle = useMutation({
    mutationFn: (i: { id: string; on: boolean }) => setLinkActive(i.id, i.on),
    onSuccess: () => void qc.invalidateQueries({ queryKey: prk.links(orgId) }),
    onError: (e) => toast.error(errText(e)),
  });
  const access = useMutation({
    mutationFn: (i: { user: string; ok: boolean }) => decidePartnerAccess(orgId, i.user, i.ok),
    onSuccess: () => void qc.invalidateQueries({ queryKey: prk.pending(orgId) }),
    onError: (e) => toast.error(errText(e)),
  });
  if (!flagOn(settings.data?.features, "partners")) return null;
  const list = (a: string[], v: string, on: boolean) => (on ? [...a, v] : a.filter((x) => x !== v));
  return (
    <Card className="flex flex-col gap-4" data-testid="partners-card">
      <CardTitle>{t("partner.adminTitle")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("partner.adminSubtitle")}</p>
      {created && (
        <div
          className="flex flex-col gap-2 rounded-md border border-green/30 bg-green-bg p-3 text-sm"
          role="status"
        >
          <p className="font-medium">{t("partner.linkOnce")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all" dir="ltr">
              {created}
            </code>
            <Button
              size="sm"
              variant="secondary"
              icon={<Copy />}
              onClick={() =>
                void navigator.clipboard
                  .writeText(created)
                  .then(() => toast.success(t("partner.copied")))
              }
            >
              {t("partner.copy")}
            </Button>
          </div>
        </div>
      )}
      <ul className="flex flex-col gap-2 text-sm">
        {(links.data ?? []).map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2">
            <strong dir="auto">{l.label}</strong>
            <Badge variant={l.active ? "green" : "neutral"}>
              {l.active ? t("partner.active") : t("partner.inactive")}
            </Badge>
            <span className="text-fg-muted">
              {l.allowed_channels.length
                ? l.allowed_channels.map((c) => t(`promo.channel.${c}` as TKey)).join("، ")
                : t("partner.allChannels")}
            </span>
            <Button
              size="sm"
              variant="ghost"
              loading={toggle.isPending}
              onClick={() => toggle.mutate({ id: l.id, on: !l.active })}
            >
              {l.active ? t("partner.deactivate") : t("partner.activate")}
            </Button>
          </li>
        ))}
      </ul>
      {!form ? (
        <Button
          className="self-start"
          icon={<Plus />}
          onClick={() => {
            setCreated(null);
            setForm({ label: "", products: [], channels: [], intro: "", terms: "" });
          }}
        >
          {t("partner.newLink")}
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <Field label={t("partner.linkLabel")}>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              dir="auto"
            />
          </Field>
          <fieldset className="flex flex-wrap gap-x-4">
            <legend className="mb-1 text-sm font-medium">{t("partner.allowedProducts")}</legend>
            {(products.data ?? []).map((p) => (
              <Checkbox
                key={p.id}
                label={(lang === "en" && p.name_en) || p.name_ar}
                checked={form.products.includes(p.id)}
                onChange={(e) =>
                  setForm({ ...form, products: list(form.products, p.id, e.target.checked) })
                }
              />
            ))}
          </fieldset>
          <fieldset className="flex flex-wrap gap-x-4">
            <legend className="mb-1 text-sm font-medium">{t("partner.allowedChannels")}</legend>
            {CHANNELS.map((c) => (
              <Checkbox
                key={c}
                label={t(`promo.channel.${c}` as TKey)}
                checked={form.channels.includes(c)}
                onChange={(e) =>
                  setForm({ ...form, channels: list(form.channels, c, e.target.checked) })
                }
              />
            ))}
          </fieldset>
          <Field label={t("partner.intro")} optional optionalLabel={t("common.optional")}>
            <Textarea
              rows={2}
              value={form.intro}
              onChange={(e) => setForm({ ...form, intro: e.target.value })}
              dir="auto"
            />
          </Field>
          <Field label={t("partner.terms")}>
            <Textarea
              rows={4}
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              dir="auto"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setForm(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!form.label.trim() || !form.terms.trim()}
              loading={create.isPending}
              onClick={() => create.mutate()}
            >
              {t("partner.createLink")}
            </Button>
          </div>
        </div>
      )}
      <h3 className="text-sm font-bold">{t("partner.members")}</h3>
      {!members.data?.length ? (
        <p className="text-sm text-fg-muted">{t("partner.noMembers")}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {members.data.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-2">
              <span dir="ltr">{m.email}</span>
              <Badge>{t(`org.roles.${m.role}` as TKey)}</Badge>
              <Badge variant={m.access_status === "active" ? "green" : "neutral"}>
                {t(`partner.access.${m.access_status}` as TKey)}
              </Badge>
              {m.access_status === "pending" && (
                <Button
                  size="sm"
                  loading={access.isPending}
                  onClick={() => access.mutate({ user: m.user_id, ok: true })}
                >
                  {t("partner.approve")}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                loading={access.isPending}
                onClick={() => access.mutate({ user: m.user_id, ok: false })}
              >
                {t("partner.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
