import { useQuery } from "@tanstack/react-query";
import { BookOpenText } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { flagOn } from "@/lib/api/flows";
import { useOrgSettings, type Promotion } from "@/lib/api/promotions";
import { supabase } from "@/lib/supabase";
import { readabilityHints } from "./readability";

/** Advisory Arabic readability hints for the current version's text (Phase 7.7). Never a compliance finding. */
export function ReadabilityPanel({ promotion: p }: { promotion: Promotion }) {
  const { t } = useI18n();
  const settings = useOrgSettings(p.org_id);
  const on = flagOn(settings.data?.features, "readability_hint");
  const text = useQuery({
    queryKey: ["readability-text", p.current_version_id],
    enabled: on && Boolean(p.current_version_id),
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select("caption, text_content")
        .eq("id", p.current_version_id!)
        .maybeSingle();
      return [data?.caption, data?.text_content].filter(Boolean).join("\n");
    },
  });
  if (!on || !text.data) return null;
  const hints = readabilityHints(text.data);
  return (
    <Card className="flex flex-col gap-2" data-testid="readability">
      <CardTitle className="flex items-center gap-2">
        <BookOpenText className="size-4" aria-hidden="true" />
        {t("readability.title")}
      </CardTitle>
      <p className="text-xs text-fg-muted">{t("readability.note")}</p>
      {!hints.length ? (
        <p className="text-sm">{t("readability.none")}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {hints.map((h, i) => (
            <li key={i}>
              <strong>
                {t(h.kind === "long_sentence" ? "readability.long" : "readability.dense", {
                  n: h.words,
                })}
              </strong>{" "}
              <span className="text-fg-muted" dir="auto">
                «{h.excerpt}»
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
