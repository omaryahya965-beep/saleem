import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

/** ProgressBar — determinate progress (0–100) with an accessible label. Fills from the start side. */
export function ProgressBar({
  value,
  label,
  tone = "green",
  className,
}: {
  value: number;
  label: string;
  tone?: "green" | "red";
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-line/70", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-250 ease-out",
          tone === "green" ? "bg-green" : "bg-red",
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export type StepState = "done" | "current" | "upcoming" | "failed";

/** Stepper — vertical list of pipeline stages with done/current/failed states. */
export function Stepper({
  steps,
  className,
}: {
  steps: { key: string; label: ReactNode; detail?: ReactNode; state: StepState }[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((s, i) => (
        <li
          key={s.key}
          aria-current={s.state === "current" ? "step" : undefined}
          className="relative flex gap-3 pb-5 last:pb-0"
        >
          {i < steps.length - 1 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute start-[13px] top-8 bottom-1 w-0.5 rounded-full",
                s.state === "done" ? "bg-green" : "bg-line",
              )}
            />
          )}
          <span
            className={cn(
              "relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold [&_svg]:size-4",
              s.state === "done" && "bg-green text-white",
              s.state === "current" && "border-2 border-green bg-surface text-green",
              s.state === "upcoming" && "border border-border-strong bg-surface text-fg-muted",
              s.state === "failed" && "bg-red text-white",
            )}
          >
            {s.state === "done" ? (
              <Check aria-hidden="true" strokeWidth={3} />
            ) : s.state === "failed" ? (
              <X aria-hidden="true" strokeWidth={3} />
            ) : s.state === "current" ? (
              <Spinner className="size-3.5" />
            ) : (
              <span className="tabular">{i + 1}</span>
            )}
          </span>
          <span className="min-w-0 pt-0.5">
            <span
              className={cn(
                "block font-medium",
                s.state === "upcoming" ? "text-fg-muted" : "text-fg",
                s.state === "failed" && "text-red",
              )}
            >
              {s.label}
            </span>
            {s.detail && <span className="block text-sm text-fg-muted">{s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
