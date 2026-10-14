import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { formatClock, useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export interface TimelineMarker {
  id: string;
  /** Seconds from the start. */
  t: number;
  severity: "violation" | "warning";
  title: string;
}

interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  markers: TimelineMarker[];
  selectedId?: string | null;
  onSeek: (t: number) => void;
  onSelectMarker: (id: string) => void;
  /** Media is gone (deleted after 24 h): markers still select findings, but nothing seeks. */
  seekDisabled?: boolean;
  className?: string;
}

/**
 * VideoTimeline — scrubber with severity markers at t/duration.
 * Always laid out left→right (media convention, matches the native player).
 * Keyboard: the track is a slider (←/→ 1 s, PageUp/PageDown 5 s, Home/End);
 * each marker is a button in tab order (Enter/Space selects and seeks).
 */
export function VideoTimeline({
  duration,
  currentTime,
  markers,
  selectedId,
  onSeek,
  onSelectMarker,
  seekDisabled = false,
  className,
}: VideoTimelineProps) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const safeDuration = duration > 0 ? duration : 1;
  const pct = (s: number) => `${Math.max(0, Math.min(100, (s / safeDuration) * 100))}%`;

  const seekFromPointer = (e: PointerEvent) => {
    if (seekDisabled) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(safeDuration, ratio * safeDuration)));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (seekDisabled) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      onSeek(Math.max(0, Math.min(safeDuration, currentTime + step)));
    } else if (e.key === "Home") {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSeek(safeDuration);
    }
  };

  return (
    <div dir="ltr" className={cn("select-none", className)}>
      <div className="relative h-11">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={seekDisabled ? -1 : 0}
          aria-disabled={seekDisabled || undefined}
          aria-label={t("timeline.label")}
          aria-valuemin={0}
          aria-valuemax={Math.round(safeDuration)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={formatClock(currentTime)}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            seekFromPointer(e);
          }}
          onPointerMove={(e) => e.buttons === 1 && seekFromPointer(e)}
          className={cn(
            "absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-full",
            seekDisabled ? "cursor-default opacity-60" : "cursor-pointer",
          )}
        >
          <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
          <span
            className="absolute start-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink"
            style={{ width: pct(currentTime) }}
          />
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink shadow"
            style={{ left: pct(currentTime) }}
          />
        </div>
        {markers.map((m) => {
          const selected = m.id === selectedId;
          return (
            <button
              key={m.id}
              type="button"
              aria-label={t("timeline.markerLabel", {
                severity: t(`severity.${m.severity}`),
                time: formatClock(m.t),
                title: m.title,
              })}
              aria-pressed={selected}
              onClick={() => onSelectMarker(m.id)}
              className="group absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
              style={{ left: pct(m.t) }}
            >
              <span
                className={cn(
                  "block rounded-full border-2 border-surface transition-transform duration-150 group-hover:scale-125",
                  m.severity === "violation" ? "bg-red" : "bg-amber",
                  m.severity === "violation" ? "size-3.5" : "size-3 rotate-45 rounded-[2px]",
                  selected && "scale-150 ring-2 ring-ink ring-offset-1 ring-offset-surface",
                )}
              />
            </button>
          );
        })}
      </div>
      <div className="tabular flex justify-between text-xs text-fg-muted">
        <span>{formatClock(currentTime)}</span>
        <span>{formatClock(duration)}</span>
      </div>
    </div>
  );
}
