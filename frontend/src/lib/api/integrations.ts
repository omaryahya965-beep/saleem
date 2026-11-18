// v2 Phase 7.2/7.3: org API keys (read-only API v1) and webhook / Slack / Teams endpoints.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ApiError } from "./data";

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw ApiError.from(res.error);
  return res.data as NonNullable<T>;
}

export const READ_SCOPES = ["promotions:read", "findings:read", "decisions:read"] as const;
export const EVENTS = ["analysis.completed", "review.submitted", "review.decided"] as const;
export const intk = {
  keys: (o: string) => ["api-keys", o] as const,
  hooks: (o: string) => ["webhooks", o] as const,
};

export const useApiKeys = (org: string) =>
  useQuery({
    queryKey: intk.keys(org),
    queryFn: async () =>
      check(
        await supabase
          .from("api_keys")
          .select("id, name, key_prefix, scopes, expires_at, revoked_at, last_used_at")
          .eq("org_id", org)
          .order("created_at", { ascending: false }),
      ),
  });
export const createApiKey = async (org: string, name: string, scopes: string[], days: number) =>
  check(
    await supabase.rpc("create_api_key", { _org: org, _name: name, _scopes: scopes, _days: days }),
  );
export const revokeApiKey = async (id: string) => {
  check(await supabase.rpc("revoke_api_key", { _id: id }));
};

export const useWebhooks = (org: string) =>
  useQuery({
    queryKey: intk.hooks(org),
    queryFn: async () =>
      check(
        await supabase
          .from("webhook_endpoints")
          .select(
            "id, kind, url, events, active, created_at, webhook_deliveries(id, event, status, attempts, last_status_code, created_at)",
          )
          .eq("org_id", org)
          .order("created_at", { ascending: false })
          .order("created_at", { referencedTable: "webhook_deliveries", ascending: false })
          .limit(5, { referencedTable: "webhook_deliveries" }),
      ) as unknown as {
        id: string;
        kind: string;
        url: string;
        events: string[];
        active: boolean;
        created_at: string;
        webhook_deliveries: {
          id: number;
          event: string;
          status: string;
          attempts: number;
          last_status_code: number | null;
          created_at: string;
        }[];
      }[],
  });
export const saveWebhook = async (org: string, kind: string, url: string, events: string[]) =>
  check(
    await supabase.rpc("save_webhook_endpoint", {
      _org: org,
      _kind: kind,
      _url: url,
      _events: events,
    }),
  );
export const webhookSecret = async (id: string) =>
  check(await supabase.rpc("webhook_secret", { _id: id }));
export const setWebhookActive = async (id: string, active: boolean) => {
  check(await supabase.rpc("set_webhook_active", { _id: id, _active: active }));
};
