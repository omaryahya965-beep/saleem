// Shared presentation pieces of the public website (D206): call-to-action styles, section heading, phone frame and
// availability tags. Marketing-only; the signed-in app keeps its own component library.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, inverse }: { children: ReactNode; inverse?: boolean }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium",
        inverse ? "text-gold" : "text-gold-deep",
      )}
    >
      <span aria-hidden="true" className={cn("h-px w-6", inverse ? "bg-gold" : "bg-gold-deep")} />
      {children}
    </p>
  );
}

/** Section heading: eyebrow, editorial display title (Naskh in Arabic), optional lead. */
export function SectionHeading({
  eyebrow,
  title,
  body,
  inverse,
  id,
  className,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  inverse?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-3xl flex-col gap-4", className)}>
      <Eyebrow inverse={inverse}>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className={cn(
          "font-display text-[32px] leading-[1.25] font-bold text-balance sm:text-[42px] ltr:font-sans ltr:tracking-tight",
          inverse ? "text-cream" : "text-forest",
        )}
      >
        {title}
      </h2>
      {body && <p className={cn("text-lg", inverse ? "text-cream/75" : "text-muted")}>{body}</p>}
    </div>
  );
}

/** A phone-shaped frame around a 9:16 image or video. */
export function PhoneFrame({
  children,
  className,
  tone = "dark",
}: {
  children: ReactNode;
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] p-2 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.55)]",
        tone === "dark" ? "bg-[#0b1a15] ring-1 ring-white/10" : "bg-white ring-1 ring-forest/10",
        className,
      )}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.6rem] bg-black">
        {children}
      </div>
    </div>
  );
}

export type Availability = "available" | "soon" | "provider";

export function AvailabilityTag({
  kind,
  label,
  inverse,
}: {
  kind: Availability;
  label: string;
  inverse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        kind === "available" && (inverse ? "bg-mint/15 text-mint" : "bg-green-bg text-green"),
        kind === "soon" &&
          (inverse
            ? "text-cream/70 ring-1 ring-cream/25 ring-inset"
            : "text-muted ring-1 ring-forest/20 ring-inset ring-dashed"),
        kind === "provider" && (inverse ? "bg-gold/15 text-gold" : "bg-amber-bg text-amber-text"),
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          kind === "available" && (inverse ? "bg-mint" : "bg-green"),
          kind === "soon" && "bg-current opacity-60",
          kind === "provider" && "bg-current",
        )}
      />
      {label}
    </span>
  );
}

/** Wide content container for public sections. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1240px] px-4 sm:px-8", className)}>{children}</div>
  );
}
