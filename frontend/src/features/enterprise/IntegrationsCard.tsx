import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus, Webhook } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Select,
  toast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { usePreflightText } from "@/features/review/model";
import { flagOn } from "@/lib/api/flows";
import {
  createApiKey,
  EVENTS,
  intk,
  READ_SCOPES,
  revokeApiKey,
  saveWebhook,
  setWebhookActive,
  useApiKeys,
  useWebhooks,
  webhookSecret,
} from "@/lib/api/integrations";
import { useOrgSettings } from "@/lib/api/promotions";

const copy = (text: string, done: () => void) =>
  void navigator.clipboard.writeText(text).then(done);

/** API keys (read-only API v1) and webhook / Slack / Teams endpoints (Phase 7.2/7.3). */
export function IntegrationsCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const api = flagOn(settings.data?.features, "api");
  const chat = flagOn(settings.data?.features, "notifications_chat");
  const keys = useApiKeys(orgId);
  const hooks = useWebhooks(orgId);
  const errText = usePreflightText();
  const [keyName, setKeyName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["findings:read"]);
  const [days, setDays] = useState("90");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [kind, setKind] = useState(api ? "webhook" : "slack");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["review.decided"]);
  const onError = (e: unknown) => toast.error(errText(e));
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: intk.keys(orgId) });
    void qc.invalidateQueries({ queryKey: intk.hooks(orgId) });
  };
  const addKey = useMutation({
    mutationFn: () => createApiKey(orgId, keyName, scopes, Number(days)),
    onSuccess: (k) => {
      setShownKey(k);
      setKeyName("");
      refresh();
    },
    onError,
  });
  const revoke = useMutation({ mutationFn: revokeApiKey, onSuccess: refresh, onError });
  const addHook = useMutation({
    mutationFn: () => saveWebhook(orgId, kind, url, events),
    onSuccess: () => {
      setUrl("");
      refresh();
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (i: { id: string; on: boolean }) => setWebhookActive(i.id, i.on),
    onSuccess: refresh,
    onError,
  });
  const secret = useMutation({
    mutationFn: webhookSecret,
    onSuccess: (s) => copy(s, () => toast.success(t("integrations.secretCopied"))),
    onError,
  });
  if (!api && !chat) return null;
  const flip = (a: string[], v: string, on: boolean) => (on ? [...a, v] : a.filter((x) => x !== v));
  const kinds = [...(api ? ["webhook"] : []), ...(chat ? ["slack", "teams"] : [])];
  return (
    <Card className="flex flex-col gap-4" data-testid="integrations">
      <CardTitle>{t("integrations.title")}</CardTitle>
      {api && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <KeyRound className="size-4" aria-hidden="true" />
            {t("integrations.keys")}
          </h3>
          <p className="text-xs text-fg-muted">{t("integrations.keysHint")}</p>
          {shownKey && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-md border border-green/30 bg-green-bg p-2 text-sm"
            >
              <span>{t("partner.linkOnce")}</span>
              <code dir="ltr" className="break-all">
                {shownKey}
              </code>
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy />}
                onClick={() => copy(shownKey, () => toast.success(t("partner.copied")))}
              >
                {t("partner.copy")}
              </Button>
            </div>
          )}
          <ul className="flex flex-col gap-1 text-sm">
            {(keys.data ?? []).map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-2">
                <strong dir="auto">{k.name}</strong>
                <Badge mono>{k.key_prefix}…</Badge>
                <span className="text-fg-muted">
                  {k.scopes.join(", ")} · {t("integrations.expires")}{" "}
                  <bdi>{k.expires_at.slice(0, 10)}</bdi>
                </span>
                {k.revoked_at ? (
                  <Badge>{t("integrations.revoked")}</Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => revoke.mutate(k.id)}>
                    {t("integrations.revoke")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <Field label={t("integrations.keyName")}>
              <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} dir="auto" />
            </Field>
            <Field label={t("integrations.days")}>
              <Input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </Field>
            <Button
              size="sm"
              icon={<Plus />}
              disabled={!keyName.trim() || !scopes.length}
              loading={addKey.isPending}
              onClick={() => addKey.mutate()}
            >
              {t("integrations.createKey")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4">
            {READ_SCOPES.map((s) => (
              <Checkbox
                key={s}
                label={s}
                checked={scopes.includes(s)}
                onChange={(e) => setScopes(flip(scopes, s, e.target.checked))}
              />
            ))}
          </div>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Webhook className="size-4" aria-hidden="true" />
          {t("integrations.hooks")}
        </h3>
        <ul className="flex flex-col gap-2 text-sm">
          {(hooks.data ?? []).map((h) => (
            <li key={h.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{t(`integrations.kind.${h.kind}` as never)}</Badge>
                <code dir="ltr" className="break-all text-xs">
                  {h.url}
                </code>
                <Badge variant={h.active ? "green" : "neutral"}>
                  {h.active ? t("partner.active") : t("partner.inactive")}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggle.mutate({ id: h.id, on: !h.active })}
                >
                  {h.active ? t("partner.deactivate") : t("partner.activate")}
                </Button>
                {h.kind === "webhook" && (
                  <Button size="sm" variant="ghost" onClick={() => secret.mutate(h.id)}>
                    {t("integrations.copySecret")}
                  </Button>
                )}
              </div>
              {h.webhook_deliveries.length > 0 && (
                <p className="text-xs text-fg-muted">
                  {h.webhook_deliveries
                    .map(
                      (d) =>
                        `${d.event}: ${t(`integrations.delivery.${d.status}` as never)}${d.last_status_code ? ` (${d.last_status_code})` : ""}`,
                    )
                    .join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
        <div className="grid items-end gap-2 sm:grid-cols-[8rem_1fr_auto]">
          <Field label={t("integrations.kindLabel")}>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {t(`integrations.kind.${k}` as never)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("integrations.url")}>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://"
            />
          </Field>
          <Button
            size="sm"
            icon={<Plus />}
            disabled={!/^https:\/\/\S+$/.test(url) || !events.length}
            loading={addHook.isPending}
            onClick={() => addHook.mutate()}
          >
            {t("integrations.addHook")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-4">
          {EVENTS.map((ev) => (
            <Checkbox
              key={ev}
              label={t(`integrations.event.${ev.replace(".", "_")}` as never)}
              checked={events.includes(ev)}
              onChange={(e) => setEvents(flip(events, ev, e.target.checked))}
            />
          ))}
        </div>
      </section>
    </Card>
  );
}
