import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer actions; the primary action goes last (end side). */
  footer?: ReactNode;
  className?: string;
}

/** Dialog — modal with focus trap, Esc to close, labelled by title. Bottom sheet on mobile. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const { t } = useI18n();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/45 animate-[fade-in_200ms_ease-out]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex max-h-[90dvh] w-full flex-col overflow-hidden bg-surface shadow-overlay",
            "inset-x-0 bottom-0 rounded-t-lg sm:inset-x-auto sm:bottom-auto sm:start-1/2 sm:top-1/2 sm:max-w-lg sm:rounded-lg",
            "sm:-translate-y-1/2 sm:translate-x-[-50%] sm:rtl:translate-x-[50%]",
            "animate-[rise-in_220ms_var(--ease-out)]",
            className,
          )}
        >
          <div className="flex items-start gap-4 p-5 pb-3 sm:p-6 sm:pb-3">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-xl font-bold text-fg">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-fg-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label={t("common.close")}
              className="-me-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-line/60 hover:text-fg"
            >
              <X className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          {children && <div className="overflow-y-auto px-5 pb-2 sm:px-6">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 p-5 pt-4 sm:flex-row sm:justify-end sm:p-6 sm:pt-4">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Toaster — mount once at the root. Use `toast.success/error/message` from "sonner". */
export function Toaster() {
  const { dir } = useI18n();
  return (
    <SonnerToaster
      dir={dir}
      position={dir === "rtl" ? "bottom-left" : "bottom-right"}
      offset={{ bottom: 88 }}
      mobileOffset={{ bottom: 88 }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border !border-border !bg-surface !text-fg !shadow-overlay !font-sans !text-sm",
          description: "!text-fg-muted",
          success: "[&_[data-icon]]:!text-green",
          error: "[&_[data-icon]]:!text-red",
        },
      }}
    />
  );
}
export { toast };

/** Tooltip — supplementary hint on hover/focus. Never put essential info only in a tooltip. */
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-64 rounded-sm bg-ink px-2.5 py-1.5 text-xs text-paper animate-[fade-in_150ms_ease-out]"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-ink" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
