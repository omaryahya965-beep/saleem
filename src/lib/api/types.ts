// src/lib/api/types.ts
// Typed contracts for SALEEM frontend API layer

import type { Database } from "@/integrations/supabase/types";

export type DbSubmission = Database["public"]["Tables"]["submissions"]["Row"];
export type DbRule = Database["public"]["Tables"]["rules"]["Row"];
export type DbFinding = Database["public"]["Tables"]["findings"]["Row"];
export type DbTranscript = Database["public"]["Tables"]["transcripts"]["Row"];
export type DbComplianceLog = Database["public"]["Tables"]["compliance_logs"]["Row"];

export type IssueItem = {
  id: string;
  time: number | null;
  type: "v" | "w" | "ok";
  title: string;
  rule: string;
  source: string;
  evidence: string;
  fix: string;
};

export type ReportData = {
  submission: DbSubmission;
  findings: DbFinding[];
  issues: IssueItem[];
  transcript?: DbTranscript | null;
  mediaUrl?: string | null;
  previousSubmission?: DbSubmission | null;
};
