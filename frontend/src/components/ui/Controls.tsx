import * as RadioGroup from "@radix-ui/react-radio-group";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  /** Helper text explaining the consequence of the switch. */
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Switch — labelled on/off control. The whole row is clickable; thumb mirrors in RTL. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4 py-3", className)}>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block font-medium text-fg">{label}</span>
        {hint && (
          <span id={`${id}-hint`} className="mt-0.5 block text-sm text-fg-muted">
            {hint}
          </span>
        )}
      </label>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent",
          "bg-line-strong transition-colors duration-200 data-[state=checked]:bg-green",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
            "data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5",
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  options: SegmentOption<T>[];
  /** Accessible name for the group. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** SegmentedControl — single choice among 2–5 options; radio semantics, arrow keys follow direction. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      aria-label={label}
      className={cn(
        "inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-sunken p-1",
        className,
      )}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 font-medium text-fg-muted",
            "transition-colors duration-150 hover:text-fg [&_svg]:size-4",
            "data-[state=checked]:bg-surface data-[state=checked]:text-fg data-[state=checked]:shadow-[0_1px_2px_rgb(14_38_32/0.12)]",
            size === "md" ? "h-10 text-sm" : "h-8 text-xs",
          )}
        >
          {o.icon}
          {o.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

/** Tabs — underline tabs for switching views of the same content. Keyboard: arrows, Home/End. */
export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.List
      aria-label={label}
      className={cn("flex gap-1 overflow-x-auto border-b border-border", className)}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  value,
  children,
  count,
}: {
  value: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-fg-muted",
        "transition-colors duration-150 hover:text-fg data-[state=active]:border-green data-[state=active]:text-fg",
      )}
    >
      {children}
      {count !== undefined && (
        <span className="tabular rounded-full bg-line/70 px-2 text-xs text-fg">{count}</span>
      )}
    </TabsPrimitive.Trigger>
  );
}

export const TabsContent = TabsPrimitive.Content;
