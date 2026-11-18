import { describe, expect, it } from "vitest";
import { promotionRows, summarize } from "@/features/libraries/model";
import { claimsDue, type Claim } from "@/lib/api/libraries";
import type { Promotion } from "@/lib/api/promotions";

const promo = (o: Partial<Promotion>): Promotion =>
  ({
    id: "p",
    title: "T",
    org_id: "org",
    owner_id: "me",
    review_status: "draft",
    communication_type: "advertisement",
    channels: ["instagram"],
    deadline_at: null,
    submitted_at: null,
    approved_at: null,
    updated_at: "2026-11-01T00:00:00Z",
    assigned_reviewer_id: null,
    escalated_to: null,
    ...o,
  }) as Promotion;

describe("summarize (dashboard work summary)", () => {
  const promotions = [
    promo({ id: "a", review_status: "changes_requested" }),
    promo({ id: "b", review_status: "conditionally_approved" }),
    promo({ id: "c", review_status: "changes_requested", owner_id: "other" }),
    promo({ id: "d", review_status: "changes_requested", org_id: null }),
  ];
  const queue = [
    promo({ id: "q1", review_status: "in_review", assigned_reviewer_id: "me" }),
    promo({ id: "q2", review_status: "pending_review" }),
    promo({ id: "q3", review_status: "escalated", escalated_to: "me" }),
  ];
  const count = (s: ReturnType<typeof summarize>, k: string) => s.find((x) => x.key === k)?.count;

  it("creators see only their own org promotions", () => {
    const s = summarize({
      me: "me",
      promotions,
      queue,
      overdue: 0,
      claimsDue: 0,
      reviewer: false,
      admin: false,
    });
    expect(s.map((x) => x.key)).toEqual(["changes_requested", "conditionally_approved"]);
    expect(count(s, "changes_requested")).toBe(1);
  });

  it("reviewers add queue counts; admins add escalations and claims due", () => {
    const s = summarize({
      me: "me",
      promotions,
      queue,
      overdue: 2,
      claimsDue: 3,
      reviewer: true,
      admin: true,
    });
    expect(count(s, "assigned_to_me")).toBe(2);
    expect(count(s, "unassigned")).toBe(1);
    expect(count(s, "overdue")).toBe(2);
    expect(count(s, "escalated")).toBe(1);
    expect(count(s, "claims_due")).toBe(3);
    expect(s.find((x) => x.key === "claims_due")?.to).toBe("/claims");
  });
});

describe("claimsDue", () => {
  const today = new Date("2026-11-18T00:00:00Z");
  const c = (status: string, next: string | null) =>
    ({ id: status + next, status, next_review_at: next }) as unknown as Claim;
  it("keeps approved claims whose review is within the window or past", () => {
    const due = claimsDue(
      [
        c("approved", "2026-11-20"),
        c("approved", "2026-12-30"),
        c("approved", "2026-11-01"),
        c("draft", "2026-11-19"),
        c("approved", null),
      ],
      7,
      today,
    );
    expect(due.map((x) => x.next_review_at)).toEqual(["2026-11-20", "2026-11-01"]);
  });
});

describe("promotionRows", () => {
  it("flattens channels and the current version for CSV", () => {
    const [r] = promotionRows([
      {
        ...promo({ channels: ["instagram", "x"] }),
        current: { version_no: 2, overall_status: "needs_fixes" },
      },
    ]);
    expect(r).toMatchObject({
      channels: "instagram x",
      version: 2,
      automated_result: "needs_fixes",
    });
  });
});
