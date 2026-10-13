import { AlertCircle, RotateCcw } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

/** Card — the default content container: card surface, hairline border, 20px radius, no shadow. */
export function Card({
  className,
  padded = true,
  as: Tag = "section",
  ...rest
}: HTMLAttributes<HTMLElement> & { padded?: boolean; as?: "section" | "div" | "article" }) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-border bg-surface",
        padded && "p-5 sm:p-6",
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-bold text-fg", className)} {...rest} />;
}

/** Skeleton — placeholder block with a soft pulse; keeps layout stable while loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block rounded-sm bg-line/70 animate-[skeleton-pulse_1.4s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}

/** EmptyState — explains why a list is empty and offers the next step. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong/60 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <span className="mb-1 grid size-14 place-items-center rounded-full bg-green-bg text-green [&_svg]:size-7">
          {icon}
        </span>
      )}
      <h2 className="text-lg font-bold text-fg">{title}</h2>
      {body && <p className="prose-measure text-fg-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** ErrorState — a failed async view: what happened, and a retry. */
export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-red/25 bg-red-bg/60 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertCircle aria-hidden="true" className="size-8 text-red" />
      <h2 className="text-lg font-bold text-fg">{title}</h2>
      {body && <p className="prose-measure text-fg-muted">{body}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} icon={<RotateCcw />} className="mt-1">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/** KeyValueList — labelled facts (definition list). Two columns on wide screens, stacked on narrow. */
export function KeyValueList({
  items,
  className,
  columns = 1,
}: {
  items: { key: ReactNode; value: ReactNode; ltr?: boolean }[];
  className?: string;
  columns?: 1 | 2;
}) {
  return (
    <dl className={cn("grid gap-x-8", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((it, i) => (
        <div
          key={i}
          className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4"
        >
          <dt className="shrink-0 text-sm text-fg-muted sm:w-40">{it.key}</dt>
          <dd
            dir={it.ltr ? "ltr" : undefined}
            className={cn(
              "m-0 min-w-0 font-medium break-words text-fg",
              it.ltr && "text-start rtl:text-end",
            )}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
