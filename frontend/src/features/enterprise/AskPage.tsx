import { useMutation } from "@tanstack/react-query";
import { Info, MessageCircleQuestion, Send } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Page,
  PageHeader,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { flagOn } from "@/lib/api/flows";
import { useOrgSettings } from "@/lib/api/promotions";
import { supabase } from "@/lib/supabase";

interface AskResult {
  answer: string;
  model: boolean;
  limited?: "quota_exceeded" | "demo_quota" | null;
  sources: { kind: string; id: string; title: string; detail: string; link: string }[];
}

const PERSONAL_EXAMPLES = ["disclose", "mawthooq", "cosmetic", "rewrite", "sponsored"] as const;

/**
 * /ask — read-only assistant over what the caller can open (Phase 7.4). It cannot change anything.
 * Organisation mode needs the organisation's ask_saleem feature. Personal mode (D211) answers from verified active
 * rules and the user's own advertisements only — never drafts or any organisation's internal policies.
 */
export function AskPage() {
  const { t, lang } = useI18n();
  const picker = useOrgPicker();
  const personal = picker.mode === "personal";
  const settings = useOrgSettings(picker.orgId || null);
  const [q, setQ] = useState("");
  const ask = useMutation({
    mutationFn: async (question: string) => {
      const { data, error } = await supabase.functions.invoke("ask", {
        body: { org_id: personal ? null : picker.orgId, question, lang },
      });
      if (error) throw error;
      return data as AskResult;
    },
    onError: () => toast.error(t("ask.failed")),
  });
  const on = personal
    ? Boolean(picker.personal.data)
    : flagOn(settings.data?.features, "ask_saleem");
  const send = (question = q) => {
    setQ(question);
    ask.mutate(question);
  };
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("ask.title")}
        description={personal ? t("personalAsk.subtitle") : t("ask.subtitle")}
      />
      {!personal && <OrgSelect picker={picker} />}
      {!on ? (
        <EmptyState
          icon={<MessageCircleQuestion />}
          title={t("ask.offTitle")}
          body={t("ask.offBody")}
        />
      ) : (
        <>
          {personal && (
            <div className="flex flex-wrap gap-2" data-testid="ask-examples">
              {PERSONAL_EXAMPLES.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => send(t(`personalAsk.example.${k}` as TKey))}
                  className="rounded-full border border-border bg-card px-3.5 py-2 text-sm hover:border-green hover:text-green"
                >
                  {t(`personalAsk.example.${k}` as TKey)}
                </button>
              ))}
            </div>
          )}
          <Card className="flex flex-col gap-3">
            <Field label={t("ask.question")}>
              <Textarea
                rows={2}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                dir="auto"
                maxLength={500}
              />
            </Field>
            <Button
              className="self-start"
              icon={<Send />}
              disabled={q.trim().length < 3}
              loading={ask.isPending}
              onClick={() => send()}
              data-testid="ask-send"
            >
              {t("ask.send")}
            </Button>
          </Card>
          {ask.data && (
            <Card className="flex flex-col gap-3" data-testid="ask-answer" aria-live="polite">
              <p className="whitespace-pre-line" dir="auto">
                {ask.data.answer}
              </p>
              {ask.data.sources.length > 0 && (
                <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm">
                  {ask.data.sources.map((s) => (
                    <li key={`${s.kind}-${s.id}`}>
                      <a href={s.link} className="underline-offset-2 hover:underline" dir="auto">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
              {ask.data.limited && (
                <p className="text-sm text-amber-text">
                  {t(`personalAsk.limited.${ask.data.limited}` as TKey)}
                </p>
              )}
              <p className="text-xs text-fg-muted">
                {ask.data.model ? t("ask.modelNote") : t("ask.noModelNote")}
              </p>
            </Card>
          )}
          {personal && (
            <p
              className="flex items-start gap-2 text-xs leading-relaxed text-fg-muted"
              data-testid="ask-personal-scope"
            >
              <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {t("personalAsk.scope")}
            </p>
          )}
        </>
      )}
    </Page>
  );
}
