import { useQuery } from "@tanstack/react-query";
import { FileSearch, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  KeyValueList,
  Page,
  Skeleton,
  StatusChip,
} from "@/components/ui";
import { verificationId } from "@/features/reports/model";
import { useI18n } from "@/i18n";
import { sha256Hex, verifyLog } from "@/lib/api/features";
import { cn } from "@/lib/utils";

/** Public /verify/$id — is this compliance log authentic and unchanged? Optional local file match. */
export function VerifyPage({ id }: { id: string }) {
  const { t, tn, formatDate } = useI18n();
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const q = useQuery({ queryKey: ["verify", id], queryFn: () => verifyLog(id), enabled: valid });
  const [match, setMatch] = useState<null | "hashing" | boolean>(null);

  if (!valid)
    return (
      <Page narrow>
        <EmptyState
          icon={<ShieldX />}
          title={t("verify.notFoundTitle")}
          body={t("verify.notFoundBody")}
        />
      </Page>
    );
  if (q.isPending)
    return (
      <Page narrow>
        <Skeleton className="h-64 w-full rounded-lg" />
      </Page>
    );
  if (q.isError)
    return (
      <Page narrow>
        <ErrorState
          title={t("verify.error")}
          retryLabel={t("common.retry")}
          onRetry={() => void q.refetch()}
        />
      </Page>
    );
  const v = q.data;
  if (!v.found)
    return (
      <Page narrow>
        <EmptyState
          icon={<ShieldX />}
          title={t("verify.notFoundTitle")}
          body={t("verify.notFoundBody")}
        />
      </Page>
    );

  const ok = v.unchanged === true;
  const Icon = ok ? ShieldCheck : ShieldAlert;
  const st = v.overall_status ?? "needs_fixes";

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setMatch("hashing");
    setMatch((await sha256Hex(f)) === v.content_hash);
  };

  return (
    <Page narrow className="flex flex-col gap-5">
      <Card
        className={cn(
          "flex flex-col gap-3",
          ok ? "border-green/25 bg-green-bg" : "border-red/25 bg-red-bg",
        )}
      >
        <span className="flex items-center gap-3">
          <Icon aria-hidden="true" className={cn("size-8", ok ? "text-green" : "text-red")} />
          <h1 className="text-2xl font-bold">{ok ? t("verify.authentic") : t("verify.altered")}</h1>
        </span>
        <p className="text-fg">{ok ? t("verify.authenticBody") : t("verify.alteredBody")}</p>
        {v.is_demo && (
          <Badge variant="outline" className="self-start">
            {t("common.demo")}
          </Badge>
        )}
      </Card>
      <Card>
        <KeyValueList
          items={[
            { key: t("log.verificationId"), value: verificationId(id), ltr: true },
            {
              key: t("log.result"),
              value: (
                <StatusChip
                  size="sm"
                  tone={st === "ready" ? "ready" : st === "review" ? "warning" : "violation"}
                >
                  {t(`status.${st}` as never)}
                </StatusChip>
              ),
            },
            {
              key: t("log.findings"),
              value: `${tn("count.violations", v.violations ?? 0)} · ${tn("count.warnings", v.warnings ?? 0)}`,
            },
            { key: t("log.checkedAt"), value: formatDate(v.analyzed_at, true) },
            { key: t("log.platform"), value: t(`platforms.${v.platform}` as never) },
            { key: t("log.rulebook"), value: v.rulebook_version ?? "—", ltr: true },
            {
              key: t("log.fileHash"),
              value: <span className="font-mono text-xs break-all">{v.content_hash}</span>,
              ltr: true,
            },
            {
              key: t("verify.reportHash"),
              value: <span className="font-mono text-xs break-all">{v.report_hash ?? "—"}</span>,
              ltr: true,
            },
            { key: t("verify.sealedAt"), value: formatDate(v.sealed_at, true) },
          ]}
        />
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <FileSearch aria-hidden="true" className="size-5 text-green" />
          {t("verify.fileTitle")}
        </h2>
        <p className="text-sm text-fg-muted">{t("verify.fileBody")}</p>
        <label className="inline-flex h-11 cursor-pointer items-center self-start rounded-full border border-border-strong bg-surface px-5 text-sm font-medium hover:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
          <input
            type="file"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {t("dropzone.choose")}
        </label>
        {match === "hashing" && <p className="text-sm text-fg-muted">{t("common.loading")}</p>}
        {match === true && (
          <StatusChip tone="ready" className="self-start">
            {t("verify.fileMatch")}
          </StatusChip>
        )}
        {match === false && (
          <StatusChip tone="violation" className="self-start">
            {t("verify.fileNoMatch")}
          </StatusChip>
        )}
      </Card>
      <p className="text-sm text-fg-muted">
        {t("verify.privacy")} {t("brand.disclaimer")}
      </p>
    </Page>
  );
}
