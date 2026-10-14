import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IssueView } from "@/components/ui";
import { MediaPanel, TranscriptPanel } from "@/features/reports/MediaPanel";
import { I18nProvider } from "@/i18n";
import type { Submission } from "@/lib/api/data";

const sub = {
  id: "s1",
  kind: "video",
  is_demo: false,
  file_path: "u/s1.mp4",
  media_deleted_at: "2026-10-13T10:00:00Z",
} as unknown as Submission;

const issues = [
  { id: "f1", time: 6, severity: "violation", title: "COM-01" },
] as unknown as IssueView[];

function panel(onSeek = vi.fn(), onSelectIssue = vi.fn()) {
  render(
    <I18nProvider initialLang="ar">
      <MediaPanel
        submission={sub}
        mediaUrl={null}
        duration={14}
        time={0}
        issues={issues}
        selectedId={null}
        onTime={() => {}}
        onSeek={onSeek}
        onSelectIssue={onSelectIssue}
      />
    </I18nProvider>,
  );
  return { onSeek, onSelectIssue };
}

describe("media deleted after 24 h", () => {
  it("shows the privacy note instead of a broken player", () => {
    panel();
    expect(screen.getByTestId("media-deleted")).toHaveTextContent(
      "حُذف الفيديو بعد 24 ساعة حفاظاً على خصوصيتك. الملاحظات محفوظة.",
    );
    expect(document.querySelector("video")).toBeNull();
  });

  it("markers still select findings but the scrubber does not seek", () => {
    const { onSeek, onSelectIssue } = panel();
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.pointerDown(slider, { clientX: 10 });
    expect(onSeek).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(onSelectIssue).toHaveBeenCalledWith("f1");
  });

  it("keeps the stored transcript readable, without seeking", () => {
    const onSeek = vi.fn();
    render(
      <I18nProvider initialLang="ar">
        <TranscriptPanel
          segments={[{ start: 2, end: 4, text: "هلا والله" }]}
          time={0}
          onSeek={onSeek}
          seekDisabled
        />
      </I18nProvider>,
    );
    const line = screen.getByRole("button", { name: /هلا والله/ });
    expect(line).toBeDisabled();
    fireEvent.click(line);
    expect(onSeek).not.toHaveBeenCalled();
  });
});
