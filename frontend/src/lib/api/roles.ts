import { useQuery } from "@tanstack/react-query";

/** True when the user has the admin role. Imports the Supabase client lazily (used by the shell). */
export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin");
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });
}
