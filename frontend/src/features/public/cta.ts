import { cn } from "@/lib/utils";

export type CtaTone = "gold" | "light" | "ghostLight" | "forest" | "outline";

/** Pill call-to-action classes (links styled as buttons). Minimum 44px target. */
export function cta(tone: CtaTone, className?: string) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium",
    "transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:translate-y-px",
    tone === "gold" &&
      "bg-gold text-forest shadow-[0_10px_30px_-12px_rgb(201_168_106/0.8)] hover:bg-[#d6b77c]",
    tone === "light" && "bg-cream text-forest hover:bg-white",
    tone === "ghostLight" && "text-cream ring-1 ring-cream/30 ring-inset hover:bg-cream/10",
    tone === "forest" && "bg-forest text-cream hover:bg-forest-2",
    tone === "outline" && "text-forest ring-1 ring-forest/25 ring-inset hover:bg-forest/5",
    className,
  );
}
