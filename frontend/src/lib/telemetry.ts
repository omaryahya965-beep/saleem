// Provider-agnostic error reporting. Default: structured console output.
// To use a hosted tracker (recommended: Sentry — see docs/OPERATIONS.md), implement `ErrorReporter`
// and call `setErrorReporter()` in main.tsx. Never include tokens, emails or media in reports.

export interface ErrorReport {
  error: unknown;
  context?: Record<string, string | number | boolean | null | undefined>;
}

export interface ErrorReporter {
  capture(report: ErrorReport): void;
}

const consoleReporter: ErrorReporter = {
  capture({ error, context }) {
    const e =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack?.split("\n").slice(0, 6).join("\n"),
          }
        : { message: String(error) };
    console.error(
      JSON.stringify({ event: "client_error", path: location.pathname, ...context, ...e }),
    );
  },
};

let reporter: ErrorReporter = consoleReporter;

export function setErrorReporter(r: ErrorReporter) {
  reporter = r;
}

export function reportError(error: unknown, context?: ErrorReport["context"]) {
  try {
    reporter.capture({ error, context });
  } catch {
    // never let reporting break the app
  }
}

/** Captures uncaught errors and unhandled promise rejections. Call once at startup. */
export function installGlobalErrorHandlers() {
  window.addEventListener("error", (e) =>
    reportError(e.error ?? e.message, { source: "window.error" }),
  );
  window.addEventListener("unhandledrejection", (e) =>
    reportError(e.reason, { source: "unhandledrejection" }),
  );
}
