import { CircleCheck, CircleX, Clock, Loader, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "violation" | "warning" | "ready" | "neutral" | "processing";

const toneClasses: Record<StatusTone, string> = {
  violation: "bg-violation-bg text-violation",
  warning: "bg-warning-bg text-warning",
  ready: "bg-ready-bg text-ready",
  neutral: "bg-line/60 text-fg",
  processing: "bg-line/60 text-fg",
};

const toneIcons: Record<StatusTone, ReactNode> = {
  violation: <CircleX aria-hidden="true" />,
  warning: <TriangleAlert aria-hidden="true" />,
  ready: <CircleCheck aria-hidden="true" />,
  neutral: <Clock aria-hidden="true" />,
  processing: <Loader aria-hidden="true" className="animate-[spin_1.6s_linear_infinite]" />,
};

/**
 * StatusChip — compliance status. Always icon + text (never color alone).
 * Tones: violation (red), warning (amber), ready (green), neutral/processing.
 */
export function StatusChip({
  tone,
  children,
  size = "md",
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
        size === "md" ? "h-7 px-3 text-sm [&_svg]:size-4" : "h-6 px-2.5 text-xs [&_svg]:size-3.5",
        toneClasses[tone],
        className,
      )}
    >
      {toneIcons[tone]}
      {children}
    </span>
  );
}

/** Badge — small neutral label for metadata (rule codes, versions, "Demo"). Not for status. */
export function Badge({
  children,
  variant = "neutral",
  className,
  mono,
}: {
  children: ReactNode;
  variant?: "neutral" | "outline" | "inverse" | "green";
  className?: string;
  /** Monospace, LTR — for codes like MAW-01. */
  mono?: boolean;
}) {
  return (
    <span
      dir={mono ? "ltr" : undefined}
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        variant === "neutral" && "bg-line/60 text-fg",
        variant === "outline" && "border border-border text-fg-muted",
        variant === "inverse" && "bg-ink text-paper",
        variant === "green" && "bg-green-bg text-ready",
        mono && "font-mono tracking-normal",
        className,
      )}
    >
      {children}
    </span>
  );
}
