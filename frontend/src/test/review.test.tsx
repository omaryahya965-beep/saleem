import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import ar from "@/i18n/ar.json";
import { businessDaysBetween, isOverdue, preflightKey, toCsv } from "@/lib/api/review";
import { filterQueue } from "@/features/review/model";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => {
  const from = () => {
    const q: Record<string, unknown> = {};
    for (const k of ["select", "eq", "or", "is", "order", "in", "limit", "not"]) q[k] = () => q;
    q["then"] = (r: (v: unknown) => void) => r({ data: [], error: null });
    return q;
  };
  return {
    supabase: {
      rpc: (...a: unknown[]) => rpc(...a),
      from,
      functions: { invoke: () => Promise.resolve({}) },
    },
  };
});
const { ReviewActions } = await import("@/features/review/ReviewActions");

const promo = (over: Partial<Promotion> = {}) =>
  ({
    id: "p1",
    org_id: "o1",
    is_demo: false,
    owner_id: "cr",
    review_status: "draft",
    assigned_reviewer_id: null,
    escalated_to: null,
    ...over,
  }) as Promotion;
const v1 = { id: "s1", version_no: 1, status: "done", user_id: "cr" } as VersionSummary;

function view(p: Promotion, me: { userId: string; orgRole: string; isOwner: boolean }) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider initialLang="ar">
        <ReviewActions promotion={p} current={v1} me={me} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("review helpers", () => {
  it("maps preflight reasons with counts", () => {
    expect(preflightKey("missing_uploader_responses:3")).toEqual({
      key: "missing_uploader_responses",
      n: 3,
    });
    expect(preflightKey(new Error("code:separation_of_duties"))).toEqual({
      key: "separation_of_duties",
      n: undefined,
    });
  });
  it("counts business days Sun–Thu and flags overdue by SLA or deadline", () => {
    // 2026-11-19 is a Thursday; Fri/Sat are the weekend.
    expect(businessDaysBetween(new Date("2026-11-19"), new Date("2026-11-22"))).toBe(1);
    const submitted = { submitted_at: "2026-11-15T09:00:00Z", deadline_at: null };
    expect(isOverdue(submitted, 3, new Date("2026-11-18T09:00:00Z"))).toBe(false);
    expect(isOverdue(submitted, 3, new Date("2026-11-22T09:00:00Z"))).toBe(true);
    expect(
      isOverdue(
        { submitted_at: null, deadline_at: "2026-11-01T00:00:00Z" },
        3,
        new Date("2026-11-02"),
      ),
    ).toBe(true);
  });
  it("CSV has a BOM, quotes values and neutralises formulas", () => {
    const csv = toCsv([{ a: "=1+1", b: 'x"y', c: { k: 1 } }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(`"'=1+1"`);
    expect(csv).toContain(`"x""y"`);
  });
  it("queue tabs", () => {
    const items = [
      promo({ id: "a", review_status: "in_review", assigned_reviewer_id: "rv" }),
      promo({ id: "b", review_status: "pending_review" }),
      promo({ id: "c", review_status: "escalated", escalated_to: "lg" }),
    ];
    expect(filterQueue(items, "mine", "rv").map((p) => p.id)).toEqual(["a"]);
    expect(filterQueue(items, "unassigned", "rv").map((p) => p.id)).toEqual(["b"]);
    expect(filterQueue(items, "escalation", "rv").map((p) => p.id)).toEqual(["c"]);
    expect(filterQueue(items, "mine", "lg").map((p) => p.id)).toEqual(["c"]);
  });
});

describe("review actions (case 14 in the UI)", () => {
  it("uploader sees «إرسال للمراجعة» and the preflight reasons from the server", async () => {
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === "can_submit"
          ? { data: { ok: false, reasons: ["missing_uploader_responses:2"] }, error: null }
          : { data: null, error: null },
      ),
    );
    view(promo(), { userId: "cr", orgRole: "creator", isOwner: true });
    fireEvent.click(screen.getByRole("button", { name: ar.review.submit }));
    await waitFor(() =>
      expect(screen.getByTestId("preflight")).toHaveTextContent("2 ملاحظات بلا رد منك."),
    );
  });
  it("a creator never sees reviewer actions; the uploader cannot review their own version", () => {
    view(promo({ review_status: "pending_review" }), {
      userId: "cr",
      orgRole: "creator",
      isOwner: true,
    });
    expect(screen.queryByRole("button", { name: ar.review.openReview })).toBeNull();
    expect(screen.queryByRole("button", { name: ar.review.decide })).toBeNull();
  });
  it("reviewer's «القرار» stays disabled until the server preflight passes", async () => {
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === "can_decide"
          ? { data: { ok: false, reasons: ["missing_reviewer_responses:1"] }, error: null }
          : { data: null, error: null },
      ),
    );
    // D169: the reviewer acts only on a case assigned to them.
    view(promo({ review_status: "in_review", assigned_reviewer_id: "rv" }), {
      userId: "rv",
      orgRole: "reviewer",
      isOwner: false,
    });
    await waitFor(() =>
      expect(screen.getByTestId("preflight")).toHaveTextContent("1 ملاحظات بلا رد من المراجع."),
    );
    expect(screen.getByRole("button", { name: ar.review.decide })).toBeDisabled();
  });
  it("decision dialog requires a condition for conditional approval", async () => {
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === "can_decide"
          ? { data: { ok: true, reasons: [] }, error: null }
          : { data: null, error: null },
      ),
    );
    // D169: the reviewer acts only on a case assigned to them.
    view(promo({ review_status: "in_review", assigned_reviewer_id: "rv" }), {
      userId: "rv",
      orgRole: "reviewer",
      isOwner: false,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: ar.review.decide })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: ar.review.decide }));
    const dialog = await screen.findByTestId("decision-dialog");
    fireEvent.change(dialog.querySelector("select")!, { target: { value: "conditional_approve" } });
    expect(screen.getByRole("button", { name: ar.review.confirmDecision })).toBeDisabled();
  });
  it("an unassigned reviewer gets no open, decide or assign control (D169)", () => {
    for (const review_status of ["pending_review", "in_review"] as const) {
      const { unmount } = view(promo({ review_status, assigned_reviewer_id: null }), {
        userId: "rv",
        orgRole: "reviewer",
        isOwner: false,
      });
      expect(screen.queryByRole("button", { name: ar.review.openReview })).toBeNull();
      expect(screen.queryByRole("button", { name: ar.review.decide })).toBeNull();
      expect(screen.queryByRole("button", { name: ar.review.assignToMe })).toBeNull();
      expect(screen.queryByLabelText(ar.review.assignee)).toBeNull();
      expect(screen.getByTestId("awaiting-assignment")).toBeInTheDocument();
      unmount();
    }
  });
});
