import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Button, Card, CardTitle, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabase";

interface DiagnosticsData {
  provider: string;
  model: string;
  transcription_provider: string;
  transcription_model: string;
  key_configured: boolean;
  status: string;
  usage?: {
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost_usd: number;
  };
  connection_test?: {
    status: number;
    error_type: string | null;
    error_code: string | null;
  };
}

export function AIProviderCard() {
  const { t, formatNumber } = useI18n();
  const [testing, setTesting] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<DiagnosticsData>({
    queryKey: ["ai-diagnostics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("diagnostics");
      if (error) throw error;
      return data as DiagnosticsData;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      await refetch();
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {t("aiProvider.title")}
            </h3>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {error instanceof Error ? error.message : t("errors.generic")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 ms-1" />
            {t("aiProvider.testConnection")}
          </Button>
        </div>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return {
          label: t("aiProvider.statusVerified"),
          color: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
          icon: <CheckCircle2 className="h-4 w-4" />,
        };
      case "configured":
        return {
          label: t("aiProvider.statusConfigured"),
          color: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
          icon: <ShieldCheck className="h-4 w-4" />,
        };
      case "missing_key":
        return {
          label: t("aiProvider.statusMissingKey"),
          color: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
          icon: <AlertTriangle className="h-4 w-4" />,
        };
      case "invalid_key":
        return {
          label: t("aiProvider.statusInvalidKey"),
          color: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
          icon: <XCircle className="h-4 w-4" />,
        };
      case "model_not_found":
        return {
          label: t("aiProvider.statusModelNotFound"),
          color: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
          icon: <XCircle className="h-4 w-4" />,
        };
      case "provider_down":
        return {
          label: t("aiProvider.statusProviderDown"),
          color: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
          icon: <XCircle className="h-4 w-4" />,
        };
      default:
        return {
          label: status,
          color: "border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
          icon: <AlertTriangle className="h-4 w-4" />,
        };
    }
  };

  const badge = getStatusBadge(data.status);
  const isGemini = data.provider === "gemini";

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <CardTitle>{t("aiProvider.title")}</CardTitle>
          </div>
          <p className="mt-1 text-xs text-fg-muted">{t("aiProvider.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${badge.color}`}
          >
            {badge.icon}
            {badge.label}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            loading={testing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ms-1 ${testing ? "animate-spin" : ""}`} />
            {t("aiProvider.testConnection")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <span className="block text-xs text-fg-muted">{t("aiProvider.primaryProvider")}</span>
          <div className="mt-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-sm">
              {isGemini ? t("aiProvider.gemini") : data.provider}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <span className="block text-xs text-fg-muted">{t("aiProvider.configuredModel")}</span>
          <span dir="ltr" className="mt-1 block font-mono text-sm font-medium">
            {data.model || "—"}
          </span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <span className="block text-xs text-fg-muted">{t("aiProvider.asrModel")}</span>
          <span dir="ltr" className="mt-1 block font-mono text-sm font-medium">
            {data.transcription_model || "—"}
          </span>
        </div>
      </div>

      {data.usage && (
        <div className="border-t border-border pt-4">
          <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
            {t("aiProvider.usageTitle")}
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-md bg-sunken p-2.5 text-center">
              <span className="block text-xs text-fg-muted">{t("aiProvider.totalRuns")}</span>
              <span className="mt-1 block text-base font-bold tabular">
                {formatNumber(data.usage.total_runs)}
              </span>
            </div>
            <div className="rounded-md bg-sunken p-2.5 text-center">
              <span className="block text-xs text-fg-muted">{t("aiProvider.successfulRuns")}</span>
              <span className="mt-1 block text-base font-bold text-emerald-600 dark:text-emerald-400 tabular">
                {formatNumber(data.usage.successful_runs)}
              </span>
            </div>
            <div className="rounded-md bg-sunken p-2.5 text-center">
              <span className="block text-xs text-fg-muted">{t("aiProvider.failedRuns")}</span>
              <span className="mt-1 block text-base font-bold text-rose-600 dark:text-rose-400 tabular">
                {formatNumber(data.usage.failed_runs)}
              </span>
            </div>
            <div className="rounded-md bg-sunken p-2.5 text-center">
              <span className="block text-xs text-fg-muted">{t("aiProvider.inputTokens")}</span>
              <span className="mt-1 block text-base font-bold tabular">
                {formatNumber(data.usage.total_input_tokens)}
              </span>
            </div>
            <div className="rounded-md bg-sunken p-2.5 text-center">
              <span className="block text-xs text-fg-muted">{t("aiProvider.outputTokens")}</span>
              <span className="mt-1 block text-base font-bold tabular">
                {formatNumber(data.usage.total_output_tokens)}
              </span>
            </div>
            <div className="rounded-md bg-sunken p-2.5 text-center">
              <span className="block text-xs text-fg-muted">{t("aiProvider.estimatedCost")}</span>
              <span dir="ltr" className="mt-1 block text-base font-bold tabular text-fg">
                ${data.usage.total_cost_usd.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md bg-sunken/60 p-3 text-xs text-fg-muted border border-border/50">
        <p>{t("aiProvider.serverSecretsNote")}</p>
        <p className="mt-1 text-[11px] text-fg-subtle">{t("aiProvider.testDisclaimer")}</p>
      </div>
    </Card>
  );
}
