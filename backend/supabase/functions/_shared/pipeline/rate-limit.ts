// Per-user analysis rate limit. What is counted: analysis runs started (analysis_runs rows) for the
// user's submissions in the last hour. Blocking happens before a new run is created, so with a limit of
// 30 the 30th start is allowed (29 earlier runs) and the 31st is blocked (30 earlier runs).

export const DEFAULT_RATE_LIMIT_PER_HOUR = 30;
export const RATE_WINDOW_MS = 3600_000;

/** Parses ANALYZE_RATE_LIMIT_PER_HOUR; invalid or non-positive values fall back to the default. */
export function rateLimitFromEnv(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_RATE_LIMIT_PER_HOUR;
}

/** `startedInWindow` = runs already started in the window, not counting the one being requested. */
export function isRateLimited(startedInWindow: number, limit: number): boolean {
  return startedInWindow >= limit;
}
