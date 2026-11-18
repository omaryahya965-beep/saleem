import type { Promotion } from "@/lib/api/promotions";

export interface SummaryItem {
  key: string;
  count: number;
  to: "/promotions" | "/queue" | "/claims";
  search?: Record<string, string>;
}

/** Dashboard counts per role: creators act on their promotions; reviewers on the queue; admins see the totals. */
export function summarize(i: {
  me: string;
  promotions: Promotion[];
  queue: Promotion[];
  overdue: number;
  claimsDue: number;
  reviewer: boolean;
  admin: boolean;
}): SummaryItem[] {
  const mine = i.promotions.filter((p) => p.owner_id === i.me && p.org_id);
  const out: SummaryItem[] = [
    {
      key: "changes_requested",
      count: mine.filter((p) => p.review_status === "changes_requested").length,
      to: "/promotions",
      search: { status: "changes_requested" },
    },
    {
      key: "conditionally_approved",
      count: mine.filter((p) => p.review_status === "conditionally_approved").length,
      to: "/promotions",
      search: { status: "conditionally_approved" },
    },
  ];
  if (i.reviewer) {
    out.push(
      {
        key: "assigned_to_me",
        count: i.queue.filter((p) => p.assigned_reviewer_id === i.me || p.escalated_to === i.me)
          .length,
        to: "/queue",
      },
      {
        key: "unassigned",
        count: i.queue.filter((p) => !p.assigned_reviewer_id && p.review_status !== "escalated")
          .length,
        to: "/queue",
      },
      { key: "overdue", count: i.overdue, to: "/queue" },
    );
  }
  if (i.admin) {
    out.push(
      {
        key: "escalated",
        count: i.queue.filter((p) => p.review_status === "escalated").length,
        to: "/promotions",
        search: { status: "escalated" },
      },
      { key: "claims_due", count: i.claimsDue, to: "/claims" },
    );
  }
  return out;
}

/** CSV rows for the promotions export (columns of the list + status). */
export function promotionRows(
  items: (Promotion & {
    current?: { version_no: number | null; overall_status: string | null } | null;
  })[],
) {
  return items.map((p) => ({
    id: p.id,
    title: p.title,
    review_status: p.review_status,
    communication_type: p.communication_type,
    channels: p.channels.join(" "),
    version: p.current?.version_no ?? "",
    automated_result: p.current?.overall_status ?? "",
    deadline_at: p.deadline_at ?? "",
    submitted_at: p.submitted_at ?? "",
    approved_at: p.approved_at ?? "",
    updated_at: p.updated_at,
  }));
}
