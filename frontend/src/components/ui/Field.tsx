import { Check, ChevronDown } from "lucide-react";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const controlBase = [
  "w-full rounded-md border border-border-strong bg-surface text-base text-fg",
  "placeholder:text-fg-muted/80 transition-colors duration-150",
  "hover:border-fg-muted focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus",
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-70",
  "aria-[invalid=true]:border-red",
].join(" ");

/** Input — 44px text field. Use inside <Field> for label, hint and error wiring. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(controlBase, "h-11 px-3.5", className)} {...rest} />;
  },
);

/** Textarea — multi-line text, vertical resize only. */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlBase, "min-h-24 resize-y px-3.5 py-2.5 leading-relaxed", className)}
      {...rest}
    />
  );
});

/**
 * Select — native <select> (best keyboard, screen-reader and mobile picker support) with a
 * custom chevron placed on the logical end side.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(controlBase, "h-11 appearance-none ps-3.5 pe-10", className)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-fg-muted"
        />
      </div>
    );
  },
);

/** Checkbox — native checkbox with custom box; label is clickable and 44px tall. */
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; hint?: ReactNode }
>(function Checkbox({ label, hint, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("flex min-h-11 cursor-pointer gap-3 py-1", className)}>
      <span className="relative mt-1 inline-flex size-5 shrink-0">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer size-5 cursor-pointer appearance-none rounded-[6px] border border-border-strong bg-surface checked:border-green checked:bg-green aria-[invalid=true]:border-red"
          {...rest}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute inset-0.5 size-4 text-white opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className="text-sm leading-relaxed">
        <span className="text-fg">{label}</span>
        {hint && <span className="block text-fg-muted">{hint}</span>}
      </span>
    </label>
  );
});

interface FieldProps {
  label: ReactNode;
  /** Helper text under the control. */
  hint?: ReactNode;
  /** Validation message; marks the control aria-invalid and announces politely. */
  error?: ReactNode;
  optional?: boolean;
  optionalLabel?: string;
  className?: string;
  /** A single Input/Textarea/Select element; id and aria attributes are injected. */
  children: ReactElement<Record<string, unknown>>;
}

/** Field — label + control + hint + error with correct id/aria wiring. */
export function Field({
  label,
  hint,
  error,
  optional,
  optionalLabel,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {optional && <span className="ms-1.5 font-normal text-fg-muted">({optionalLabel})</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red">
          {error}
        </p>
      )}
    </div>
  );
}
