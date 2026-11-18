/** Error with a stable code for UI handling (kept separate so the app entry doesn't load Supabase). */
export class ApiError extends Error {
  /** Postgres / PostgREST / HTTP code from the server, when there was one (e.g. 42501, PGRST202, 404). */
  public serverCode: string | null = null;
  public status: number | null = null;
  constructor(
    message: string,
    public readonly code:
      "not_found" | "unauthorized" | "network" | "upload" | "unknown" = "unknown",
  ) {
    super(message);
  }
  /** From a Supabase error ({ message, code?, status? }), keeping the server code for classification. */
  static from(
    e: { message: string; code?: string | null; status?: number | null },
    code?: ApiError["code"],
  ): ApiError {
    const err = new ApiError(e.message, code ?? (e.code === "PGRST116" ? "not_found" : "unknown"));
    err.serverCode = e.code ?? null;
    err.status = e.status ?? null;
    return err;
  }
}

/**
 * What kind of failure an error is, so the UI never says «الخادم غير متاح» for a permission or schema problem.
 * network: no response · unauthorized: session missing/expired · forbidden: RLS/role · not_found · schema: the
 * database is older than the app (missing table, column or RPC) · provider: AI provider not configured/invalid ·
 * invalid: bad input · server: anything else from the server.
 */
export type ErrorKind =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "schema"
  | "provider"
  | "invalid"
  | "server";

export function classifyError(e: unknown): ErrorKind {
  const any = (e ?? {}) as {
    message?: string;
    code?: string;
    serverCode?: string | null;
    sqlCode?: string;
    status?: number | null;
    context?: { status?: number };
  };
  const msg = String(any.message ?? e ?? "");
  const code = String(
    any.serverCode ?? any.sqlCode ?? (any.code && any.code !== "unknown" ? any.code : "") ?? "",
  );
  const status = any.status ?? any.context?.status ?? null;
  if (
    any.code === "network" ||
    /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(msg)
  )
    return "network";
  if (/no_model_key|provider_invalid_key|provider_|model key/i.test(msg)) return "provider";
  if (
    any.code === "unauthorized" ||
    status === 401 ||
    /^PGRST30[123]$/.test(code) ||
    /jwt (expired|malformed)|invalid jwt|not authenticated/i.test(msg)
  )
    return "unauthorized";
  if (
    /^(PGRST20[0245]|42P01|42703|42883|42704)$/.test(code) ||
    /could not find the (function|table)|schema cache|does not exist/i.test(msg)
  )
    return "schema";
  if (
    code === "42501" ||
    status === 403 ||
    /code:forbidden|permission denied|row-level security|read_only_role|separation_of_duties/i.test(
      msg,
    )
  )
    return "forbidden";
  if (
    any.code === "not_found" ||
    code === "PGRST116" ||
    status === 404 ||
    /code:not_found/.test(msg)
  )
    return "not_found";
  if (
    /^(22P02|23514|23502|23505|PGRST100|PGRST102)$/.test(code) ||
    status === 400 ||
    /code:invalid|code:.*_required/.test(msg)
  )
    return "invalid";
  return "server";
}
