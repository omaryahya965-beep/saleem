import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { analysisStartStalled } from "@/features/reports/model";
import { I18nProvider } from "@/i18n";
import type { Submission } from "@/lib/api/data";

const invoke = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("@/lib/api/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, session: null, ready: true }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}));

const { ProcessingView } = await import("@/features/reports/ProcessingView");

const base = {
  id: "s1",
  user_id: "u1",
  status: "queued",
  progress: 0,
  current_step: "transcribe",
  error_message: null,
  heartbeat_at: null,
  title: "t",
} as unknown as Submission;

function view(sub: Submission) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider initialLang="ar">
        <ProcessingView submission={sub} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("analysis start failure", () => {
  it("detects a queued check with no heartbeat after 30 s, or a failed start request", () => {
    const created = "2026-11-17T10:00:00Z";
    const t0 = new Date(created).getTime();
    const sub = { status: "queued", heartbeat_at: null, created_at: created };
    expect(analysisStartStalled(sub, t0 + 10_000, false)).toBe(false);
    expect(analysisStartStalled(sub, t0 + 31_000, false)).toBe(true);
    expect(analysisStartStalled(sub, t0 + 1_000, true)).toBe(true);
    expect(analysisStartStalled({ ...sub, heartbeat_at: created }, t0 + 60_000, true)).toBe(false);
    expect(analysisStartStalled({ ...sub, status: "transcribing" }, t0 + 60_000, false)).toBe(
      false,
    );
  });

  it("shows «تعذّر بدء التحليل» with a retry that re-invokes analyze", async () => {
    invoke.mockResolvedValue({ error: null });
    view({ ...base, created_at: new Date(Date.now() - 60_000).toISOString() } as Submission);
    expect(screen.getByTestId("start-failed")).toHaveTextContent("تعذّر بدء التحليل");
    fireEvent.click(screen.getByRole("button", { name: /إعادة المحاولة|أعد المحاولة/ }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("analyze", { body: { submission_id: "s1" } }),
    );
  });

  it("does not show the message while a fresh check is starting", () => {
    view({ ...base, created_at: new Date().toISOString() } as Submission);
    expect(screen.queryByTestId("start-failed")).toBeNull();
  });
});
