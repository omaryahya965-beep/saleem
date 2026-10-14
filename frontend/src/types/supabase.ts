export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_settings: {
        Row: {
          asr_model: string;
          frames_to_llm: number;
          id: number;
          llm_model: string;
          prompt_version: string;
          updated_at: string;
        };
        Insert: {
          asr_model?: string;
          frames_to_llm?: number;
          id?: number;
          llm_model?: string;
          prompt_version?: string;
          updated_at?: string;
        };
        Update: {
          asr_model?: string;
          frames_to_llm?: number;
          id?: number;
          llm_model?: string;
          prompt_version?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      analysis_runs: {
        Row: {
          asr_model: string | null;
          asr_provider: string | null;
          cost_usd: number | null;
          durations_ms: Json;
          error: string | null;
          finished_at: string | null;
          frames_count: number | null;
          id: string;
          llm_model: string | null;
          llm_provider: string | null;
          on_screen_text: Json;
          prompt_version: string | null;
          raw_llm_output: Json | null;
          rulebook_version: string | null;
          rulebook_version_id: string | null;
          started_at: string;
          status: string;
          step_outputs: Json;
          submission_id: string;
          token_usage: Json | null;
        };
        Insert: {
          asr_model?: string | null;
          asr_provider?: string | null;
          cost_usd?: number | null;
          durations_ms?: Json;
          error?: string | null;
          finished_at?: string | null;
          frames_count?: number | null;
          id?: string;
          llm_model?: string | null;
          llm_provider?: string | null;
          on_screen_text?: Json;
          prompt_version?: string | null;
          raw_llm_output?: Json | null;
          rulebook_version?: string | null;
          rulebook_version_id?: string | null;
          started_at?: string;
          status?: string;
          step_outputs?: Json;
          submission_id: string;
          token_usage?: Json | null;
        };
        Update: {
          asr_model?: string | null;
          asr_provider?: string | null;
          cost_usd?: number | null;
          durations_ms?: Json;
          error?: string | null;
          finished_at?: string | null;
          frames_count?: number | null;
          id?: string;
          llm_model?: string | null;
          llm_provider?: string | null;
          on_screen_text?: Json;
          prompt_version?: string | null;
          raw_llm_output?: Json | null;
          rulebook_version?: string | null;
          rulebook_version_id?: string | null;
          started_at?: string;
          status?: string;
          step_outputs?: Json;
          submission_id?: string;
          token_usage?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "analysis_runs_rulebook_version_id_fkey";
            columns: ["rulebook_version_id"];
            isOneToOne: false;
            referencedRelation: "rulebook_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analysis_runs_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor: string | null;
          at: string;
          id: number;
          meta: Json;
          target_id: string | null;
          target_table: string;
        };
        Insert: {
          action: string;
          actor?: string | null;
          at?: string;
          id?: never;
          meta?: Json;
          target_id?: string | null;
          target_table: string;
        };
        Update: {
          action?: string;
          actor?: string | null;
          at?: string;
          id?: never;
          meta?: Json;
          target_id?: string | null;
          target_table?: string;
        };
        Relationships: [];
      };
      batches: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          brand: string | null;
          created_at: string;
          created_by: string;
          ends_on: string | null;
          id: string;
          name: string;
          org_id: string;
          starts_on: string | null;
        };
        Insert: {
          brand?: string | null;
          created_at?: string;
          created_by: string;
          ends_on?: string | null;
          id?: string;
          name: string;
          org_id: string;
          starts_on?: string | null;
        };
        Update: {
          brand?: string | null;
          created_at?: string;
          created_by?: string;
          ends_on?: string | null;
          id?: string;
          name?: string;
          org_id?: string;
          starts_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_logs: {
        Row: {
          content_hash: string;
          generated_at: string;
          report_hash: string | null;
          submission_id: string;
        };
        Insert: {
          content_hash: string;
          generated_at?: string;
          report_hash?: string | null;
          submission_id: string;
        };
        Update: {
          content_hash?: string;
          generated_at?: string;
          report_hash?: string | null;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_logs_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      eval_cases: {
        Row: {
          created_at: string;
          created_by: string;
          expected: Json;
          id: string;
          name: string;
          submission_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expected?: Json;
          id?: string;
          name: string;
          submission_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expected?: Json;
          id?: string;
          name?: string;
          submission_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eval_cases_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      eval_runs: {
        Row: {
          asr_model: string | null;
          cases: Json;
          created_at: string;
          id: string;
          label: string;
          llm_model: string | null;
          mode: string;
          per_rule: Json;
          prompt_version: string | null;
          rulebook_version: string | null;
          summary: Json;
        };
        Insert: {
          asr_model?: string | null;
          cases?: Json;
          created_at?: string;
          id?: string;
          label: string;
          llm_model?: string | null;
          mode?: string;
          per_rule?: Json;
          prompt_version?: string | null;
          rulebook_version?: string | null;
          summary?: Json;
        };
        Update: {
          asr_model?: string | null;
          cases?: Json;
          created_at?: string;
          id?: string;
          label?: string;
          llm_model?: string | null;
          mode?: string;
          per_rule?: Json;
          prompt_version?: string | null;
          rulebook_version?: string | null;
          summary?: Json;
        };
        Relationships: [];
      };
      findings: {
        Row: {
          confidence: number;
          evidence_frame_id: string | null;
          evidence_text: string | null;
          evidence_type: Database["public"]["Enums"]["evidence_type"];
          explanation_ar: string | null;
          explanation_en: string | null;
          fix_ar: string | null;
          fix_en: string | null;
          id: string;
          rule_code: string;
          run_id: string;
          severity: Database["public"]["Enums"]["severity"];
          source: Database["public"]["Enums"]["finding_source"];
          submission_id: string;
          t_end: number | null;
          t_start: number | null;
        };
        Insert: {
          confidence?: number;
          evidence_frame_id?: string | null;
          evidence_text?: string | null;
          evidence_type: Database["public"]["Enums"]["evidence_type"];
          explanation_ar?: string | null;
          explanation_en?: string | null;
          fix_ar?: string | null;
          fix_en?: string | null;
          id?: string;
          rule_code: string;
          run_id: string;
          severity: Database["public"]["Enums"]["severity"];
          source: Database["public"]["Enums"]["finding_source"];
          submission_id: string;
          t_end?: number | null;
          t_start?: number | null;
        };
        Update: {
          confidence?: number;
          evidence_frame_id?: string | null;
          evidence_text?: string | null;
          evidence_type?: Database["public"]["Enums"]["evidence_type"];
          explanation_ar?: string | null;
          explanation_en?: string | null;
          fix_ar?: string | null;
          fix_en?: string | null;
          id?: string;
          rule_code?: string;
          run_id?: string;
          severity?: Database["public"]["Enums"]["severity"];
          source?: Database["public"]["Enums"]["finding_source"];
          submission_id?: string;
          t_end?: number | null;
          t_start?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "findings_evidence_frame_id_fkey";
            columns: ["evidence_frame_id"];
            isOneToOne: false;
            referencedRelation: "frames";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "findings_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "analysis_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "findings_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      frames: {
        Row: {
          id: string;
          image_path: string | null;
          ocr_text: string | null;
          submission_id: string;
          t_seconds: number;
        };
        Insert: {
          id?: string;
          image_path?: string | null;
          ocr_text?: string | null;
          submission_id: string;
          t_seconds: number;
        };
        Update: {
          id?: string;
          image_path?: string | null;
          ocr_text?: string | null;
          submission_id?: string;
          t_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "frames_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          payload: Json;
          read_at: string | null;
          submission_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          payload?: Json;
          read_at?: string | null;
          submission_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          payload?: Json;
          read_at?: string | null;
          submission_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      org_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          org_id: string;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["org_role"];
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          org_id: string;
          revoked_at?: string | null;
          role: Database["public"]["Enums"]["org_role"];
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          org_id?: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["org_role"];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      org_members: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          org_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          max_batch: number;
          max_clip_seconds: number;
          monthly_checks: number;
          name_ar: string;
          name_en: string;
          orgs_allowed: boolean;
          sort: number;
        };
        Insert: {
          id: string;
          max_batch: number;
          max_clip_seconds?: number;
          monthly_checks: number;
          name_ar: string;
          name_en: string;
          orgs_allowed?: boolean;
          sort?: number;
        };
        Update: {
          id?: string;
          max_batch?: number;
          max_clip_seconds?: number;
          monthly_checks?: number;
          name_ar?: string;
          name_en?: string;
          orgs_allowed?: boolean;
          sort?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          mawthooq_license_no: string | null;
          notify_email: boolean;
          plan_id: string;
          platforms: Database["public"]["Enums"]["platform"][];
          preferred_lang: string | null;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          mawthooq_license_no?: string | null;
          notify_email?: boolean;
          plan_id?: string;
          platforms?: Database["public"]["Enums"]["platform"][];
          preferred_lang?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          mawthooq_license_no?: string | null;
          notify_email?: boolean;
          plan_id?: string;
          platforms?: Database["public"]["Enums"]["platform"][];
          preferred_lang?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      rulebook_versions: {
        Row: {
          changelog: string | null;
          created_at: string;
          created_by: string | null;
          effective_from: string | null;
          id: string;
          is_active: boolean;
          notes: string | null;
          published_at: string | null;
          status: string;
          version_label: string;
        };
        Insert: {
          changelog?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string | null;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          published_at?: string | null;
          status?: string;
          version_label: string;
        };
        Update: {
          changelog?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string | null;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          published_at?: string | null;
          status?: string;
          version_label?: string;
        };
        Relationships: [];
      };
      rules: {
        Row: {
          applies_to_categories: Database["public"]["Enums"]["product_category"][];
          category: Database["public"]["Enums"]["rule_category"];
          check_type: Database["public"]["Enums"]["check_type"];
          code: string;
          default_severity: Database["public"]["Enums"]["severity"];
          description_ar: string;
          description_en: string;
          id: string;
          is_active: boolean;
          legal_status: string;
          llm_instructions: string;
          rulebook_version_id: string;
          source_date: string | null;
          source_name: string;
          source_name_en: string | null;
          source_url: string;
          source_verified: boolean;
          title_ar: string;
          title_en: string;
        };
        Insert: {
          applies_to_categories?: Database["public"]["Enums"]["product_category"][];
          category: Database["public"]["Enums"]["rule_category"];
          check_type: Database["public"]["Enums"]["check_type"];
          code: string;
          default_severity: Database["public"]["Enums"]["severity"];
          description_ar: string;
          description_en: string;
          id?: string;
          is_active?: boolean;
          legal_status?: string;
          llm_instructions: string;
          rulebook_version_id: string;
          source_date?: string | null;
          source_name: string;
          source_name_en?: string | null;
          source_url: string;
          source_verified?: boolean;
          title_ar: string;
          title_en: string;
        };
        Update: {
          applies_to_categories?: Database["public"]["Enums"]["product_category"][];
          category?: Database["public"]["Enums"]["rule_category"];
          check_type?: Database["public"]["Enums"]["check_type"];
          code?: string;
          default_severity?: Database["public"]["Enums"]["severity"];
          description_ar?: string;
          description_en?: string;
          id?: string;
          is_active?: boolean;
          legal_status?: string;
          llm_instructions?: string;
          rulebook_version_id?: string;
          source_date?: string | null;
          source_name?: string;
          source_name_en?: string | null;
          source_url?: string;
          source_verified?: boolean;
          title_ar?: string;
          title_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rules_rulebook_version_id_fkey";
            columns: ["rulebook_version_id"];
            isOneToOne: false;
            referencedRelation: "rulebook_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      share_links: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          revoked_at: string | null;
          submission_id: string;
          token: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          revoked_at?: string | null;
          submission_id: string;
          token?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          revoked_at?: string | null;
          submission_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "share_links_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      share_reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          decision: string;
          id: string;
          reviewer_name: string;
          share_link_id: string;
          submission_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          decision: string;
          id?: string;
          reviewer_name: string;
          share_link_id: string;
          submission_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          decision?: string;
          id?: string;
          reviewer_name?: string;
          share_link_id?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "share_reviews_share_link_id_fkey";
            columns: ["share_link_id"];
            isOneToOne: false;
            referencedRelation: "share_links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "share_reviews_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      submissions: {
        Row: {
          ai_used: boolean;
          analyzed_at: string | null;
          attempts: number;
          audio_path: string | null;
          batch_id: string | null;
          campaign_id: string | null;
          caption: string;
          created_at: string;
          current_step: Database["public"]["Enums"]["pipeline_step"];
          duration_seconds: number | null;
          error_message: string | null;
          file_path: string | null;
          has_written_contract: boolean;
          heartbeat_at: string | null;
          id: string;
          is_demo: boolean;
          is_paid_ad: boolean;
          kind: Database["public"]["Enums"]["submission_kind"];
          mawthooq_license_no: string | null;
          media_deleted_at: string | null;
          org_id: string | null;
          overall_status: Database["public"]["Enums"]["overall_status"] | null;
          parent_id: string | null;
          platform: Database["public"]["Enums"]["platform"];
          product_category: Database["public"]["Enums"]["product_category"];
          progress: number;
          sha256: string | null;
          status: Database["public"]["Enums"]["submission_status"];
          text_content: string | null;
          thumbnail_path: string | null;
          title: string | null;
          user_id: string | null;
        };
        Insert: {
          ai_used?: boolean;
          analyzed_at?: string | null;
          attempts?: number;
          audio_path?: string | null;
          batch_id?: string | null;
          campaign_id?: string | null;
          caption?: string;
          created_at?: string;
          current_step?: Database["public"]["Enums"]["pipeline_step"];
          duration_seconds?: number | null;
          error_message?: string | null;
          file_path?: string | null;
          has_written_contract?: boolean;
          heartbeat_at?: string | null;
          id?: string;
          is_demo?: boolean;
          is_paid_ad?: boolean;
          kind: Database["public"]["Enums"]["submission_kind"];
          mawthooq_license_no?: string | null;
          media_deleted_at?: string | null;
          org_id?: string | null;
          overall_status?: Database["public"]["Enums"]["overall_status"] | null;
          parent_id?: string | null;
          platform: Database["public"]["Enums"]["platform"];
          product_category: Database["public"]["Enums"]["product_category"];
          progress?: number;
          sha256?: string | null;
          status?: Database["public"]["Enums"]["submission_status"];
          text_content?: string | null;
          thumbnail_path?: string | null;
          title?: string | null;
          user_id?: string | null;
        };
        Update: {
          ai_used?: boolean;
          analyzed_at?: string | null;
          attempts?: number;
          audio_path?: string | null;
          batch_id?: string | null;
          campaign_id?: string | null;
          caption?: string;
          created_at?: string;
          current_step?: Database["public"]["Enums"]["pipeline_step"];
          duration_seconds?: number | null;
          error_message?: string | null;
          file_path?: string | null;
          has_written_contract?: boolean;
          heartbeat_at?: string | null;
          id?: string;
          is_demo?: boolean;
          is_paid_ad?: boolean;
          kind?: Database["public"]["Enums"]["submission_kind"];
          mawthooq_license_no?: string | null;
          media_deleted_at?: string | null;
          org_id?: string | null;
          overall_status?: Database["public"]["Enums"]["overall_status"] | null;
          parent_id?: string | null;
          platform?: Database["public"]["Enums"]["platform"];
          product_category?: Database["public"]["Enums"]["product_category"];
          progress?: number;
          sha256?: string | null;
          status?: Database["public"]["Enums"]["submission_status"];
          text_content?: string | null;
          thumbnail_path?: string | null;
          title?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "submissions_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      transcripts: {
        Row: {
          full_text: string;
          language: string | null;
          provider: string | null;
          segments: Json;
          submission_id: string;
        };
        Insert: {
          full_text?: string;
          language?: string | null;
          provider?: string | null;
          segments?: Json;
          submission_id: string;
        };
        Update: {
          full_text?: string;
          language?: string | null;
          provider?: string | null;
          segments?: Json;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transcripts_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_org_invite: { Args: { _token: string }; Returns: string };
      admin_metrics: { Args: { _days?: number }; Returns: Json };
      can_read_submission: { Args: { _sid: string }; Returns: boolean };
      cancel_submission: { Args: { _sid: string }; Returns: undefined };
      compute_report_hash: { Args: { _sid: string }; Returns: string };
      create_org_invite: {
        Args: {
          _email: string;
          _org: string;
          _role: Database["public"]["Enums"]["org_role"];
        };
        Returns: string;
      };
      create_organization: { Args: { _name: string }; Returns: string };
      create_rulebook_draft: {
        Args: { _label: string; _notes?: string };
        Returns: string;
      };
      create_share_link: {
        Args: { _days?: number; _sid: string };
        Returns: string;
      };
      delete_submission_media: { Args: { _sid: string }; Returns: undefined };
      fail_stuck_submissions: { Args: never; Returns: number };
      get_shared_report: { Args: { _token: string }; Returns: Json };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_org_member: {
        Args: {
          _org: string;
          _roles?: Database["public"]["Enums"]["org_role"][];
        };
        Returns: boolean;
      };
      my_usage: { Args: never; Returns: Json };
      org_role_of: {
        Args: { _org: string; _uid?: string };
        Returns: Database["public"]["Enums"]["org_role"];
      };
      owns_submission: { Args: { _sid: string }; Returns: boolean };
      remove_org_member: {
        Args: { _org: string; _user: string };
        Returns: undefined;
      };
      rerun_submission: { Args: { _sid: string }; Returns: undefined };
      retry_submission: { Args: { _sid: string }; Returns: undefined };
      revoke_org_invite: { Args: { _invite: string }; Returns: undefined };
      revoke_share_link: { Args: { _id: string }; Returns: undefined };
      seal_compliance_log: { Args: { _sid: string }; Returns: undefined };
      set_org_member_role: {
        Args: {
          _org: string;
          _role: Database["public"]["Enums"]["org_role"];
          _user: string;
        };
        Returns: undefined;
      };
      set_rulebook_status: {
        Args: { _status: string; _version: string };
        Returns: undefined;
      };
      submit_share_review: {
        Args: {
          _comment: string;
          _decision: string;
          _name: string;
          _token: string;
        };
        Returns: undefined;
      };
      verify_compliance_log: { Args: { _sid: string }; Returns: Json };
      verify_cron_secret: { Args: { _secret: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "user";
      check_type: "audio" | "visual" | "text" | "metadata" | "hybrid";
      evidence_type: "transcript" | "frame" | "caption" | "metadata";
      finding_source: "deterministic" | "llm";
      org_role: "owner" | "admin" | "reviewer" | "creator";
      overall_status: "ready" | "needs_fixes" | "review";
      pipeline_step: "transcribe" | "deterministic" | "llm" | "merge" | "done";
      platform: "snapchat" | "tiktok" | "instagram" | "x" | "youtube";
      product_category: "food" | "health" | "beauty" | "finance" | "real_estate" | "other";
      rule_category: "mawthooq" | "content" | "ai" | "commerce";
      severity: "violation" | "warning";
      submission_kind: "video" | "image" | "text";
      submission_status: "queued" | "extracting" | "transcribing" | "analyzing" | "done" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
      check_type: ["audio", "visual", "text", "metadata", "hybrid"],
      evidence_type: ["transcript", "frame", "caption", "metadata"],
      finding_source: ["deterministic", "llm"],
      org_role: ["owner", "admin", "reviewer", "creator"],
      overall_status: ["ready", "needs_fixes", "review"],
      pipeline_step: ["transcribe", "deterministic", "llm", "merge", "done"],
      platform: ["snapchat", "tiktok", "instagram", "x", "youtube"],
      product_category: ["food", "health", "beauty", "finance", "real_estate", "other"],
      rule_category: ["mawthooq", "content", "ai", "commerce"],
      severity: ["violation", "warning"],
      submission_kind: ["video", "image", "text"],
      submission_status: ["queued", "extracting", "transcribing", "analyzing", "done", "failed"],
    },
  },
} as const;
