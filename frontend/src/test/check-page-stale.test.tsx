// Regression (live Gemini run, 2026-11-19): a report bundle fetched while the pipeline was still running has no
// findings. When the status flips to done, CheckPage must not render it (it read as a clean "no automated
// findings" report) — it shows the skeleton until the refetched bundle arrives.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ reportStatus: "analyzing", refetch: () => Promise.resolve() }));
vi.mock("@/lib/api/hooks", () => ({
  useSubmissionStatus: () => ({ isPending: false, isError: false, data: { status: "done" } }),
  useReport: () => ({
    isPending: false,
    isError: false,
    data: { submission: { status: state.reportStatus } },
    refetch: state.refetch,
  }),
}));
vi.mock("@/features/reports/ReportView", () => ({
  ReportView: () => <div data-testid="report-view" />,
}));
vi.mock("@/features/reports/ProcessingView", () => ({
  ProcessingView: () => <div data-testid="processing" />,
}));

import { CheckPage } from "@/features/reports/CheckPage";
import { I18nProvider } from "@/i18n";

const page = () =>
  render(
    <I18nProvider initialLang="ar">
      <CheckPage id="s1" />
    </I18nProvider>,
  );

describe("CheckPage after the pipeline finishes", () => {
  it("never renders a report bundle loaded before the analysis was done", () => {
    state.reportStatus = "analyzing";
    state.refetch = vi.fn(() => Promise.resolve());
    page();
    expect(screen.queryByTestId("report-view")).toBeNull();
    expect(state.refetch).toHaveBeenCalled();
  });
  it("renders the report once the bundle is from the finished run", () => {
    state.reportStatus = "done";
    page();
    expect(screen.getByTestId("report-view")).toBeInTheDocument();
  });
});
