import { useQuery } from "@tanstack/react-query";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { shortHash } from "@/features/reports/model";
import { bothCalendars } from "./model";

interface CertificateData {
  title: string;
  versionNo: number | null;
  sha256: string | null;
  decision: string;
  condition: string | null;
  reviewer: string;
  role: string;
  at: string;
  hash: string;
}

/** The latest human approval of this exact version, or null (not approved / no access). */
async function fetchCertificate(submissionId: string): Promise<CertificateData | null> {
  const { data: sub } = await supabase
    .from("submissions")
    .select("promotion_id, version_no, sha256")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub?.promotion_id) return null;
  const { data: p } = await supabase
    .from("promotions")
    .select("title, org_id, review_status, approved_version_id")
    .eq("id", sub.promotion_id)
    .maybeSingle();
  if (
    !p ||
    p.approved_version_id !== submissionId ||
    !["approved", "conditionally_approved"].includes(p.review_status)
  )
    return null;
  const { data: d } = await supabase
    .from("review_decisions")
    .select("*")
    .eq("submission_id", submissionId)
    .in("decision", ["approve", "conditional_approve"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!d) return null;
  const { data: m } = p.org_id
    ? await supabase
        .from("org_members")
        .select("display_name, email")
        .eq("org_id", p.org_id)
        .eq("user_id", d.actor_id)
        .maybeSingle()
    : { data: null };
  return {
    title: p.title,
    versionNo: sub.version_no,
    sha256: sub.sha256,
    decision: d.decision,
    condition: d.condition_ar,
    reviewer: m?.display_name || m?.email || "—",
    role: d.actor_role,
    at: d.created_at,
    hash: d.hash,
  };
}

/** Internal approval certificate (SAMA Art. 15) printed with the compliance log. Never a regulator approval. */
export function ApprovalCertificate({ submissionId }: { submissionId: string }) {
  const { t, lang } = useI18n();
  const cert = useQuery({
    queryKey: ["certificate", submissionId],
    queryFn: () => fetchCertificate(submissionId),
  });
  if (!cert.data) return null;
  const c = cert.data;
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-1 py-1.5 sm:grid-cols-[180px_1fr]">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
  return (
    <section
      data-testid="approval-certificate"
      className="rounded-lg border-2 border-ink p-5 print:break-inside-avoid"
    >
      <h2 className="text-xl font-bold">{t("review.certificate.title")}</h2>
      <dl className="mt-3 text-sm">
        {row(t("promo.fieldTitle"), <span dir="auto">{c.title}</span>)}
        {row(
          t("review.certificate.approvedVersion"),
          <>
            <bdi>{t("promo.versionShort", { n: c.versionNo ?? 0 })}</bdi> ·{" "}
            <bdi className="font-mono">{shortHash(c.sha256)}</bdi>
          </>,
        )}
        {row(t("review.certificate.decision"), t(`review.decision.${c.decision}` as TKey))}
        {c.condition &&
          row(t("review.certificate.condition"), <span dir="auto">{c.condition}</span>)}
        {row(
          t("review.certificate.reviewer"),
          `${c.reviewer} · ${t(`org.roles.${c.role}` as TKey)}`,
        )}
        {row(t("review.certificate.at"), bothCalendars(c.at, lang))}
        {row(t("review.certificate.hash"), <bdi className="font-mono text-xs">{c.hash}</bdi>)}
      </dl>
      <p className="mt-3 text-sm font-medium text-fg">{t("review.certificate.article15")}</p>
      <p className="mt-1 text-sm text-fg-muted">{t("promo.advisory")}</p>
    </section>
  );
}
