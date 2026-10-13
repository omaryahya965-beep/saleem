import { cn } from "@/lib/utils";

/** Spinner — inline loading indicator; decorative (pair with aria-busy or visible text). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-[1.1em] shrink-0 rounded-full border-2 border-current border-e-transparent",
        "animate-[spin_700ms_linear_infinite]",
        className,
      )}
    />
  );
}
