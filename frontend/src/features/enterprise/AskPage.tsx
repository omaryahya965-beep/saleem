import { useMutation } from "@tanstack/react-query";
import { MessageCircleQuestion, Send } from "lucide-react";
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
import { useI18n } from "@/i18n";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { flagOn } from "@/lib/api/flows";
import { useOrgSettings } from "@/lib/api/promotions";
import { supabase } from "@/lib/supabase";

interface AskResult {
  answer: string;
  model: boolean;
  sources: { kind: string; id: string; title: string; detail: string; link: string }[];
}

/** /ask — read-only assistant over what the caller can open (Phase 7.4). It cannot change anything. */
export function AskPage() {
  const { t, lang } = useI18n();
  const picker = useOrgPicker();
  const settings = useOrgSettings(picker.orgId || null);
  const [q, setQ] = useState("");
  const ask = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ask", {
        body: { org_id: picker.orgId, question: q, lang },
      });
      if (error) throw error;
      return data as AskResult;
    },
    onError: () => toast.error(t("ask.failed")),
  });
  const on = flagOn(settings.data?.features, "ask_saleem");
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("ask.title")} description={t("ask.subtitle")} />
      <OrgSelect picker={picker} />
      {!on ? (
        <EmptyState
          icon={<MessageCircleQuestion />}
          title={t("ask.offTitle")}
          body={t("ask.offBody")}
        />
      ) : (
        <>
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
              onClick={() => ask.mutate()}
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
              <p className="text-xs text-fg-muted">
                {ask.data.model ? t("ask.modelNote") : t("ask.noModelNote")}
              </p>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
