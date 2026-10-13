import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium",
    "transition-colors duration-150 ease-out select-none",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    "[&_svg]:size-[1.15em] [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-green text-white hover:bg-green-hover",
        secondary: "border border-border-strong bg-surface text-fg hover:bg-sunken",
        ghost: "text-green hover:bg-green-bg",
        danger: "bg-red text-white hover:bg-red-hover",
        inverse: "bg-mint text-ink hover:bg-white",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-13 px-7 text-lg",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a router `<Link>`) with button styles. */
  asChild?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  /** Icon rendered before the label (start side, mirrors with direction). */
  icon?: ReactNode;
}

/**
 * Button — one primary action per screen; secondary/ghost for the rest; danger for destructive.
 * Heights: sm 36px (desktop dense UI), md 44px (default, touch-safe), lg 52px (hero).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, icon, children, disabled, type, ...rest },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size, block }), className);
  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...rest}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — required because the button has no visible text. */
  label: string;
  variant?: "ghost" | "secondary" | "primary";
  size?: "sm" | "md";
}

/** IconButton — square/round icon-only button with a required accessible label. 44px by default. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5",
        size === "md" ? "size-11" : "size-9",
        variant === "ghost" && "text-fg hover:bg-line/60",
        variant === "secondary" && "border border-border-strong bg-surface text-fg hover:bg-sunken",
        variant === "primary" && "bg-green text-white hover:bg-green-hover",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
