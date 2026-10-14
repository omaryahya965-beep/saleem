import { FileText, Film, ImageOff } from "lucide-react";
import { forwardRef, useEffect, useRef, type ReactNode } from "react";
import { Card, VideoTimeline, type IssueView } from "@/components/ui";
import { formatClock, useI18n } from "@/i18n";
import type { Submission, TranscriptSegment } from "@/lib/api/data";
import { cn } from "@/lib/utils";

interface MediaPanelProps {
  submission: Submission;
  mediaUrl: string | null;
  duration: number;
  time: number;
  issues: IssueView[];
  selectedId: string | null;
  onTime: (t: number) => void;
  onSeek: (t: number) => void;
  onSelectIssue: (id: string) => void;
}

/** Player (video / image / text) + issue timeline. The <video> element is controlled via ref by the parent. */
export const MediaPanel = forwardRef<HTMLVideoElement, MediaPanelProps>(function MediaPanel(
  { submission, mediaUrl, duration, time, issues, selectedId, onTime, onSeek, onSelectIssue },
  videoRef,
) {
  const { t } = useI18n();
  const timed = issues.filter((i) => i.time !== null);

  let media: ReactNode;
  if (submission.kind === "text") {
    media = (
      <div className="flex min-h-48 flex-col gap-3 rounded-md bg-sunken p-5">
        <span className="flex items-center gap-2 text-sm font-medium text-fg-muted">
          <FileText aria-hidden="true" className="size-4" />
          {t("report.textHeading")}
        </span>
        <p dir="auto" className="whitespace-pre-wrap text-fg">
          {submission.text_content || submission.caption}
        </p>
      </div>
    );
  } else if (mediaUrl && submission.kind === "image") {
    media = (
      <img
        src={mediaUrl}
        alt={t("report.imageAlt")}
        className="max-h-[70dvh] w-full rounded-md bg-ink object-contain"
      />
    );
  } else if (mediaUrl) {
    media = (
      <video
        ref={videoRef}
        src={mediaUrl}
        controls
        playsInline
        preload="metadata"
        aria-label={t("report.playerLabel")}
        onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)}
        className="aspect-[9/16] max-h-[62dvh] w-full rounded-md bg-ink object-contain lg:max-h-[56dvh]"
      />
    );
  } else {
    const deleted = Boolean(submission.media_deleted_at);
    media = (
      <div className="flex aspect-[4/3] max-h-[50dvh] w-full flex-col items-center justify-center gap-3 rounded-md bg-ink px-6 text-center text-paper/85">
        {deleted ? (
          <ImageOff aria-hidden="true" className="size-8 text-mint" />
        ) : (
          <Film aria-hidden="true" className="size-8 text-mint" />
        )}
        <span className="tabular font-display text-3xl text-paper">{formatClock(time)}</span>
        <p className="prose-measure text-sm">
          {deleted ? t("report.mediaDeletedNote") : t("report.noMediaDemo")}
        </p>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-3 sm:p-4">
      {media}
      {submission.kind === "video" && duration > 0 && (
        <VideoTimeline
          duration={duration}
          currentTime={time}
          markers={timed.map((i) => ({
            id: i.id,
            t: i.time ?? 0,
            severity: i.severity,
            title: i.title,
          }))}
          selectedId={selectedId}
          onSeek={onSeek}
          onSelectMarker={onSelectIssue}
          className="px-1"
        />
      )}
    </Card>
  );
});

/** Transcript with the active segment highlighted; clicking a line seeks the player. */
export function TranscriptPanel({
  segments,
  time,
  onSeek,
  noSpeech = false,
}: {
  segments: TranscriptSegment[];
  time: number;
  onSeek: (t: number) => void;
  /** Clip has no speech (music only or no audio track). */
  noSpeech?: boolean;
}) {
  const { t } = useI18n();
  const listRef = useRef<HTMLOListElement>(null);
  const active = segments.findIndex((s) => time >= s.start && time < s.end);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[data-active=true]");
    if (el && listRef.current) {
      const box = listRef.current;
      box.scrollTo({
        top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2,
        behavior: "smooth",
      });
    }
  }, [active]);

  return (
    <Card className="p-0 sm:p-0">
      <h2 className="border-b border-border px-5 py-3.5 text-base font-bold">
        {t("report.transcriptHeading")}
      </h2>
      {segments.length === 0 ? (
        <p className="px-5 py-4 text-sm text-fg-muted">
          {noSpeech ? t("report.transcriptNoSpeech") : t("report.transcriptEmpty")}
        </p>
      ) : (
        <ol ref={listRef} className="relative max-h-72 overflow-y-auto p-2">
          {segments.map((s, i) => (
            <li key={i} data-active={i === active}>
              <button
                type="button"
                onClick={() => onSeek(s.start)}
                className={cn(
                  "flex w-full gap-3 rounded-sm px-3 py-2 text-start transition-colors duration-150",
                  i === active ? "bg-green-bg" : "hover:bg-sunken",
                )}
              >
                <span className="tabular shrink-0 pt-0.5 text-xs font-bold text-green">
                  {formatClock(s.start)}
                </span>
                <span dir="auto" className="text-sm leading-relaxed text-fg">
                  {s.text}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
