import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  TERMINAL,
  fetchReport,
  fetchProfile,
  fetchRulebook,
  fetchSubmission,
  fetchSubmissions,
  type SubmissionListParams,
} from "./data";

export const qk = {
  rulebook: ["rulebook"] as const,
  submissions: (p: SubmissionListParams) => ["submissions", p] as const,
  submission: (id: string) => ["submission", id] as const,
  report: (id: string) => ["report", id] as const,
};

export function useRulebook() {
  return useQuery({ queryKey: qk.rulebook, queryFn: fetchRulebook, staleTime: 10 * 60_000 });
}

export function useSubmissions(p: SubmissionListParams, enabled = true) {
  return useQuery({
    queryKey: qk.submissions(p),
    queryFn: () => fetchSubmissions(p),
    enabled,
    placeholderData: keepPreviousData,
    // Keep processing rows fresh without manual reloads.
    refetchInterval: (q) =>
      q.state.data?.items.some((s) => !TERMINAL.has(s.status)) ? 4000 : false,
  });
}

/** Polls the submission while the pipeline runs (real progress from the backend). */
export function useSubmissionStatus(id: string) {
  return useQuery({
    queryKey: qk.submission(id),
    queryFn: () => fetchSubmission(id),
    refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.status) ? false : 1500),
  });
}

export function useReport(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.report(id),
    queryFn: () => fetchReport(id),
    enabled,
    staleTime: 60_000,
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: Boolean(userId),
  });
}

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
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

export function useEvalRuns() {
  return useQuery({
    queryKey: ["eval-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eval_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}
