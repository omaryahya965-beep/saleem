// D192: the timeline keeps every audit row; identical repeats collapse visually, responses aggregate per day.
import { describe, expect, it } from "vitest";
import { buildTimeline, categoryOf } from "@/features/review/HistoryPanel";

const ev = (id: number, type: string, at: string, payload = {}) =>
  ({
    id,
    event_type: type,
    created_at: at,
    actor_id: "u1",
    submission_id: "s1",
    from_status: null,
    to_status: null,
    payload,
    promotion_id: "p",
    org_id: null,
  }) as never;

describe("history timeline", () => {
  it("collapses identical neighbours within a minute, keeps different ones", () => {
    const t = buildTimeline(
      [
        ev(1, "assigned", "2026-11-21T10:00:00Z", { assignee: "r" }),
        ev(2, "assigned", "2026-11-21T10:00:20Z", { assignee: "r" }),
        ev(3, "assigned", "2026-11-21T10:05:00Z", { assignee: "x" }),
      ],
      [],
      [],
    );
    expect(t.map((i) => i.count)).toEqual([2, 1]);
  });
  it("aggregates finding responses per version, actor and day", () => {
    const r = (at: string) => ({
      submission_id: "s1",
      actor_id: "u2",
      actor_role: "reviewer",
      created_at: at,
    });
    const t = buildTimeline(
      [],
      [],
      [r("2026-11-21T09:00:00Z"), r("2026-11-21T09:05:00Z"), r("2026-11-22T09:00:00Z")],
    );
    expect(t.filter((i) => i.type === "responses").map((i) => i.count)).toEqual([2, 1]);
  });
  it("categorises events", () => {
    expect(categoryOf("condition_verified")).toBe("conditions");
    expect(categoryOf("decided")).toBe("decisions");
    expect(categoryOf("lifecycle_published")).toBe("lifecycle");
    expect(categoryOf("correction_accepted")).toBe("versions");
  });
});
