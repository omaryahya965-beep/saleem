/** Error with a stable code for UI handling (kept separate so the app entry doesn't load Supabase). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      "not_found" | "unauthorized" | "network" | "upload" | "unknown" = "unknown",
  ) {
    super(message);
  }
}
