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
          audio_mode: string | null;
          context_snapshot: Json | null;
          cost_usd: number | null;
          coverage: Json | null;
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
          rulebook_version_id: string | null;
          rulebook_version: string | null;
          started_at: string;
          status: string;
          step_outputs: Json;
          submission_id: string;
          token_usage: Json | null;
        };
        Insert: {
          asr_model?: string | null;
          asr_provider?: string | null;
          audio_mode?: string | null;
          context_snapshot?: Json | null;
          cost_usd?: number | null;
          coverage?: Json | null;
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
          rulebook_version_id?: string | null;
          rulebook_version?: string | null;
          started_at?: string;
          status?: string;
          step_outputs?: Json;
          submission_id: string;
          token_usage?: Json | null;
        };
        Update: {
          asr_model?: string | null;
          asr_provider?: string | null;
          audio_mode?: string | null;
          context_snapshot?: Json | null;
          cost_usd?: number | null;
          coverage?: Json | null;
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
          rulebook_version_id?: string | null;
          rulebook_version?: string | null;
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
      api_keys: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          name: string;
          org_id: string;
          revoked_at: string | null;
          scopes: string[];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          name: string;
          org_id: string;
          revoked_at?: string | null;
          scopes: string[];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          name?: string;
          org_id?: string;
          revoked_at?: string | null;
          scopes?: string[];
        };
        Relationships: [];
      };
      approval_preset_steps: {
        Row: {
          id: string;
          label_ar: string;
          position: number;
          preset_id: string;
          role: Database["public"]["Enums"]["org_role"] | null;
          user_ids: string[];
        };
        Insert: {
          id?: string;
          label_ar: string;
          position: number;
          preset_id: string;
          role?: Database["public"]["Enums"]["org_role"] | null;
          user_ids?: string[];
        };
        Update: {
          id?: string;
          label_ar?: string;
          position?: number;
          preset_id?: string;
          role?: Database["public"]["Enums"]["org_role"] | null;
          user_ids?: string[];
        };
        Relationships: [];
      };
      approval_presets: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          is_default: boolean;
          mode: string;
          name: string;
          org_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_default?: boolean;
          mode: string;
          name: string;
          org_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_default?: boolean;
          mode?: string;
          name?: string;
          org_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
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
      brand_guidelines: {
        Row: {
          created_at: string;
          created_by: string | null;
          file_path: string | null;
          id: string;
          org_id: string;
          text_ar: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          file_path?: string | null;
          id?: string;
          org_id: string;
          text_ar: string;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          file_path?: string | null;
          id?: string;
          org_id?: string;
          text_ar?: string;
          title?: string;
        };
        Relationships: [];
      };
      calibration_notes: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          note: string;
          rule_code: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          id?: string;
          note: string;
          rule_code: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          note?: string;
          rule_code?: string;
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
      claims: {
        Row: {
          channels: string[];
          claim_key: string;
          communication_types: string[];
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          name: string;
          next_review_at: string | null;
          normalized_text: string;
          numbers: Json;
          org_id: string;
          product_ids: string[];
          review_comment: string | null;
          review_reason_ids: string[];
          reviewed_at: string | null;
          reviewed_by: string | null;
          source_finding_id: string | null;
          status: string;
          substantiation: Json;
          supersedes_id: string | null;
          text_ar: string;
          text_en: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          channels?: string[];
          claim_key?: string;
          communication_types?: string[];
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          name: string;
          next_review_at?: string | null;
          normalized_text?: string;
          numbers?: Json;
          org_id: string;
          product_ids?: string[];
          review_comment?: string | null;
          review_reason_ids?: string[];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_finding_id?: string | null;
          status?: string;
          substantiation?: Json;
          supersedes_id?: string | null;
          text_ar: string;
          text_en?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          channels?: string[];
          claim_key?: string;
          communication_types?: string[];
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          name?: string;
          next_review_at?: string | null;
          normalized_text?: string;
          numbers?: Json;
          org_id?: string;
          product_ids?: string[];
          review_comment?: string | null;
          review_reason_ids?: string[];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_finding_id?: string | null;
          status?: string;
          substantiation?: Json;
          supersedes_id?: string | null;
          text_ar?: string;
          text_en?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          anchor: Json | null;
          author_id: string;
          body: string;
          carried_from_comment_id: string | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          kind: string;
          mentions: string[];
          parent_id: string | null;
          promotion_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          submission_id: string;
          visibility: string;
        };
        Insert: {
          anchor?: Json | null;
          author_id?: string;
          body: string;
          carried_from_comment_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          kind?: string;
          mentions?: string[];
          parent_id?: string | null;
          promotion_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          submission_id: string;
          visibility?: string;
        };
        Update: {
          anchor?: Json | null;
          author_id?: string;
          body?: string;
          carried_from_comment_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          kind?: string;
          mentions?: string[];
          parent_id?: string | null;
          promotion_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          submission_id?: string;
          visibility?: string;
        };
        Relationships: [];
      };
      compliance_logs: {
        Row: {
          content_hash: string;
          generated_at: string;
          hash_version: number;
          report_hash: string | null;
          submission_id: string;
        };
        Insert: {
          content_hash: string;
          generated_at?: string;
          hash_version?: number;
          report_hash?: string | null;
          submission_id: string;
        };
        Update: {
          content_hash?: string;
          generated_at?: string;
          hash_version?: number;
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
      disclaimers: {
        Row: {
          channels: string[];
          check_prominence: boolean;
          communication_types: string[];
          created_at: string;
          created_by: string | null;
          disclaimer_key: string;
          id: string;
          is_template: boolean;
          name: string;
          normalized_text: string;
          org_id: string | null;
          product_types: string[];
          required_by_rule_codes: string[];
          status: string;
          supersedes_id: string | null;
          text_ar: string;
          text_en: string | null;
          version: number;
        };
        Insert: {
          channels?: string[];
          check_prominence?: boolean;
          communication_types?: string[];
          created_at?: string;
          created_by?: string | null;
          disclaimer_key?: string;
          id?: string;
          is_template?: boolean;
          name?: string;
          normalized_text?: string;
          org_id?: string | null;
          product_types?: string[];
          required_by_rule_codes?: string[];
          status?: string;
          supersedes_id?: string | null;
          text_ar: string;
          text_en?: string | null;
          version?: number;
        };
        Update: {
          channels?: string[];
          check_prominence?: boolean;
          communication_types?: string[];
          created_at?: string;
          created_by?: string | null;
          disclaimer_key?: string;
          id?: string;
          is_template?: boolean;
          name?: string;
          normalized_text?: string;
          org_id?: string | null;
          product_types?: string[];
          required_by_rule_codes?: string[];
          status?: string;
          supersedes_id?: string | null;
          text_ar?: string;
          text_en?: string | null;
          version?: number;
        };
        Relationships: [];
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
      finding_feedback: {
        Row: {
          created_at: string;
          finding_id: string;
          id: string;
          reason: string | null;
          submission_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          finding_id: string;
          id?: string;
          reason?: string | null;
          submission_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          finding_id?: string;
          id?: string;
          reason?: string | null;
          submission_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finding_feedback_finding_id_fkey";
            columns: ["finding_id"];
            isOneToOne: false;
            referencedRelation: "findings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finding_feedback_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      finding_responses: {
        Row: {
          action: string;
          actor_id: string;
          actor_role: string;
          comment: string | null;
          created_at: string;
          finding_id: string;
          id: string;
          submission_id: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          actor_role: string;
          comment?: string | null;
          created_at?: string;
          finding_id: string;
          id?: string;
          submission_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          actor_role?: string;
          comment?: string | null;
          created_at?: string;
          finding_id?: string;
          id?: string;
          submission_id?: string;
        };
        Relationships: [];
      };
      findings: {
        Row: {
          carried_from_finding_id: string | null;
          citation: Json | null;
          confidence: number;
          evidence_frame_id: string | null;
          evidence_text: string | null;
          evidence_type: Database["public"]["Enums"]["evidence_type"];
          explanation_ar: string | null;
          explanation_en: string | null;
          finding_type: string | null;
          fix_ar: string | null;
          fix_en: string | null;
          id: string;
          location: Json | null;
          missing_information_ar: string | null;
          resolved_in_submission_id: string | null;
          rule_code: string;
          rule_draft: boolean;
          rule_id: string | null;
          run_id: string;
          severity: Database["public"]["Enums"]["severity"];
          source: Database["public"]["Enums"]["finding_source"];
          status: string;
          submission_id: string;
          t_end: number | null;
          t_start: number | null;
        };
        Insert: {
          carried_from_finding_id?: string | null;
          citation?: Json | null;
          confidence?: number;
          evidence_frame_id?: string | null;
          evidence_text?: string | null;
          evidence_type: Database["public"]["Enums"]["evidence_type"];
          explanation_ar?: string | null;
          explanation_en?: string | null;
          finding_type?: string | null;
          fix_ar?: string | null;
          fix_en?: string | null;
          id?: string;
          location?: Json | null;
          missing_information_ar?: string | null;
          resolved_in_submission_id?: string | null;
          rule_code: string;
          rule_draft?: boolean;
          rule_id?: string | null;
          run_id: string;
          severity: Database["public"]["Enums"]["severity"];
          source: Database["public"]["Enums"]["finding_source"];
          status?: string;
          submission_id: string;
          t_end?: number | null;
          t_start?: number | null;
        };
        Update: {
          carried_from_finding_id?: string | null;
          citation?: Json | null;
          confidence?: number;
          evidence_frame_id?: string | null;
          evidence_text?: string | null;
          evidence_type?: Database["public"]["Enums"]["evidence_type"];
          explanation_ar?: string | null;
          explanation_en?: string | null;
          finding_type?: string | null;
          fix_ar?: string | null;
          fix_en?: string | null;
          id?: string;
          location?: Json | null;
          missing_information_ar?: string | null;
          resolved_in_submission_id?: string | null;
          rule_code?: string;
          rule_draft?: boolean;
          rule_id?: string | null;
          run_id?: string;
          severity?: Database["public"]["Enums"]["severity"];
          source?: Database["public"]["Enums"]["finding_source"];
          status?: string;
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
          asset_id: string | null;
          blurred: boolean;
          id: string;
          image_path: string | null;
          ocr_text: string | null;
          page_no: number | null;
          submission_id: string;
          t_seconds: number;
          text_source: string | null;
        };
        Insert: {
          asset_id?: string | null;
          blurred?: boolean;
          id?: string;
          image_path?: string | null;
          ocr_text?: string | null;
          page_no?: number | null;
          submission_id: string;
          t_seconds: number;
          text_source?: string | null;
        };
        Update: {
          asset_id?: string | null;
          blurred?: boolean;
          id?: string;
          image_path?: string | null;
          ocr_text?: string | null;
          page_no?: number | null;
          submission_id?: string;
          t_seconds?: number;
          text_source?: string | null;
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
      internal_rules: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          code: string;
          created_at: string;
          edited_at: string | null;
          edited_by: string | null;
          guideline_id: string | null;
          id: string;
          instruction_ar: string;
          org_id: string;
          severity: string;
          source: string;
          status: string;
          title_ar: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          code: string;
          created_at?: string;
          edited_at?: string | null;
          edited_by?: string | null;
          guideline_id?: string | null;
          id?: string;
          instruction_ar: string;
          org_id: string;
          severity?: string;
          source: string;
          status?: string;
          title_ar: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          code?: string;
          created_at?: string;
          edited_at?: string | null;
          edited_by?: string | null;
          guideline_id?: string | null;
          id?: string;
          instruction_ar?: string;
          org_id?: string;
          severity?: string;
          source?: string;
          status?: string;
          title_ar?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          emailed_at: string | null;
          id: string;
          kind: string;
          payload: Json;
          read_at: string | null;
          submission_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emailed_at?: string | null;
          id?: string;
          kind: string;
          payload?: Json;
          read_at?: string | null;
          submission_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emailed_at?: string | null;
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
          access_status: string;
          can_accept_risk: boolean;
          created_at: string;
          display_name: string | null;
          email: string | null;
          org_id: string;
          partner_link_id: string | null;
          role: Database["public"]["Enums"]["org_role"];
          terms_accepted_at: string | null;
          user_id: string;
        };
        Insert: {
          access_status?: string;
          can_accept_risk?: boolean;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          org_id: string;
          partner_link_id?: string | null;
          role: Database["public"]["Enums"]["org_role"];
          terms_accepted_at?: string | null;
          user_id: string;
        };
        Update: {
          access_status?: string;
          can_accept_risk?: boolean;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          org_id?: string;
          partner_link_id?: string | null;
          role?: Database["public"]["Enums"]["org_role"];
          terms_accepted_at?: string | null;
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
      org_rule_overrides: {
        Row: {
          applicability_patch: Json;
          archived_at: string | null;
          created_at: string;
          created_by: string;
          id: string;
          org_id: string;
          reason: string;
          rule_code: string;
        };
        Insert: {
          applicability_patch: Json;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          org_id: string;
          reason: string;
          rule_code: string;
        };
        Update: {
          applicability_patch?: Json;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          org_id?: string;
          reason?: string;
          rule_code?: string;
        };
        Relationships: [];
      };
      org_rule_packs: {
        Row: {
          enabled: boolean;
          include_draft_rules: boolean;
          org_id: string;
          pack_code: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          enabled?: boolean;
          include_draft_rules?: boolean;
          org_id: string;
          pack_code: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          enabled?: boolean;
          include_draft_rules?: boolean;
          org_id?: string;
          pack_code?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      org_settings: {
        Row: {
          brand_aliases: string[];
          business_holidays: string[];
          features: Json;
          hide_comments_from_external: boolean;
          media_retention: Json;
          org_id: string;
          require_reviewer_responses: boolean;
          require_uploader_responses: boolean;
          review_sla_business_days: number;
          sector: string | null;
          self_approval_blocked_packs: string[];
          updated_at: string;
          updated_by: string | null;
          weekend_days: number[];
        };
        Insert: {
          brand_aliases?: string[];
          business_holidays?: string[];
          features?: Json;
          hide_comments_from_external?: boolean;
          media_retention?: Json;
          org_id: string;
          require_reviewer_responses?: boolean;
          require_uploader_responses?: boolean;
          review_sla_business_days?: number;
          sector?: string | null;
          self_approval_blocked_packs?: string[];
          updated_at?: string;
          updated_by?: string | null;
          weekend_days?: number[];
        };
        Update: {
          brand_aliases?: string[];
          business_holidays?: string[];
          features?: Json;
          hide_comments_from_external?: boolean;
          media_retention?: Json;
          org_id?: string;
          require_reviewer_responses?: boolean;
          require_uploader_responses?: boolean;
          review_sla_business_days?: number;
          sector?: string | null;
          self_approval_blocked_packs?: string[];
          updated_at?: string;
          updated_by?: string | null;
          weekend_days?: number[];
        };
        Relationships: [];
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
      partner_links: {
        Row: {
          active: boolean;
          allowed_channels: string[];
          allowed_product_ids: string[];
          created_at: string;
          created_by: string | null;
          id: string;
          intro_ar: string | null;
          label: string;
          org_id: string;
          terms_ar: string;
          token_hash: string;
        };
        Insert: {
          active?: boolean;
          allowed_channels?: string[];
          allowed_product_ids?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          intro_ar?: string | null;
          label: string;
          org_id: string;
          terms_ar: string;
          token_hash: string;
        };
        Update: {
          active?: boolean;
          allowed_channels?: string[];
          allowed_product_ids?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          intro_ar?: string | null;
          label?: string;
          org_id?: string;
          terms_ar?: string;
          token_hash?: string;
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
      preset_auto_apply: {
        Row: {
          id: string;
          market: string;
          org_id: string;
          preset_id: string;
          product_type: string | null;
        };
        Insert: {
          id?: string;
          market: string;
          org_id: string;
          preset_id: string;
          product_type?: string | null;
        };
        Update: {
          id?: string;
          market?: string;
          org_id?: string;
          preset_id?: string;
          product_type?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          aliases: string[];
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          key_facts: Json;
          name_ar: string;
          name_en: string | null;
          org_id: string;
          product_type: string;
          regulator: string;
          sector: string;
          status: string;
          supersedes_id: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          aliases?: string[];
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          key_facts?: Json;
          name_ar: string;
          name_en?: string | null;
          org_id: string;
          product_type: string;
          regulator: string;
          sector: string;
          status?: string;
          supersedes_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          aliases?: string[];
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          key_facts?: Json;
          name_ar?: string;
          name_en?: string | null;
          org_id?: string;
          product_type?: string;
          regulator?: string;
          sector?: string;
          status?: string;
          supersedes_id?: string | null;
          updated_at?: string;
          version?: number;
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
      promotion_claims: {
        Row: {
          claim_id: string;
          link_source: string;
          linked_at: string;
          linked_by: string | null;
          promotion_id: string;
        };
        Insert: {
          claim_id: string;
          link_source: string;
          linked_at?: string;
          linked_by?: string | null;
          promotion_id: string;
        };
        Update: {
          claim_id?: string;
          link_source?: string;
          linked_at?: string;
          linked_by?: string | null;
          promotion_id?: string;
        };
        Relationships: [];
      };
      promotion_review_steps: {
        Row: {
          assignee_ids: string[];
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_id: string | null;
          flow_no: number;
          fresh_required: boolean;
          id: string;
          label_ar: string;
          mode: string;
          preset_id: string | null;
          preset_version: number;
          promotion_id: string;
          role: Database["public"]["Enums"]["org_role"] | null;
          status: string;
          step_no: number;
          submission_id: string;
        };
        Insert: {
          assignee_ids?: string[];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_id?: string | null;
          flow_no: number;
          fresh_required?: boolean;
          id?: string;
          label_ar: string;
          mode: string;
          preset_id?: string | null;
          preset_version: number;
          promotion_id: string;
          role?: Database["public"]["Enums"]["org_role"] | null;
          status: string;
          step_no: number;
          submission_id: string;
        };
        Update: {
          assignee_ids?: string[];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_id?: string | null;
          flow_no?: number;
          fresh_required?: boolean;
          id?: string;
          label_ar?: string;
          mode?: string;
          preset_id?: string | null;
          preset_version?: number;
          promotion_id?: string;
          role?: Database["public"]["Enums"]["org_role"] | null;
          status?: string;
          step_no?: number;
          submission_id?: string;
        };
        Relationships: [];
      };
      promotions: {
        Row: {
          approved_at: string | null;
          approved_version_id: string | null;
          assigned_reviewer_id: string | null;
          audience: string[];
          campaign_id: string | null;
          caption: string | null;
          channels: string[];
          communication_type: Database["public"]["Enums"]["communication_type"];
          created_at: string;
          creator_license_no: string | null;
          current_version_id: string | null;
          deadline_at: string | null;
          distribution: string | null;
          escalated_to: string | null;
          evergreen: boolean;
          first_decision_at: string | null;
          id: string;
          is_demo: boolean;
          is_paid: boolean | null;
          market: string;
          next_review_at: string | null;
          org_id: string | null;
          owner_id: string | null;
          product_id: string | null;
          published_at: string | null;
          regulator_notice_at: string | null;
          review_status: Database["public"]["Enums"]["promotion_review_status"];
          reviewer_notes: string | null;
          risk_acceptor_id: string | null;
          risk_from_status: Database["public"]["Enums"]["promotion_review_status"] | null;
          sector: string | null;
          submitted_at: string | null;
          tags: string[];
          taken_down_at: string | null;
          title: string;
          updated_at: string;
          upload_type: string;
          variation_group_id: string | null;
          withdrawal_due_at: string | null;
          withdrawal_reason: string | null;
          withdrawn_at: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_version_id?: string | null;
          assigned_reviewer_id?: string | null;
          audience?: string[];
          campaign_id?: string | null;
          caption?: string | null;
          channels?: string[];
          communication_type?: Database["public"]["Enums"]["communication_type"];
          created_at?: string;
          creator_license_no?: string | null;
          current_version_id?: string | null;
          deadline_at?: string | null;
          distribution?: string | null;
          escalated_to?: string | null;
          evergreen?: boolean;
          first_decision_at?: string | null;
          id?: string;
          is_demo?: boolean;
          is_paid?: boolean | null;
          market?: string;
          next_review_at?: string | null;
          org_id?: string | null;
          owner_id?: string | null;
          product_id?: string | null;
          published_at?: string | null;
          regulator_notice_at?: string | null;
          review_status?: Database["public"]["Enums"]["promotion_review_status"];
          reviewer_notes?: string | null;
          risk_acceptor_id?: string | null;
          risk_from_status?: Database["public"]["Enums"]["promotion_review_status"] | null;
          sector?: string | null;
          submitted_at?: string | null;
          tags?: string[];
          taken_down_at?: string | null;
          title: string;
          updated_at?: string;
          upload_type?: string;
          variation_group_id?: string | null;
          withdrawal_due_at?: string | null;
          withdrawal_reason?: string | null;
          withdrawn_at?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_version_id?: string | null;
          assigned_reviewer_id?: string | null;
          audience?: string[];
          campaign_id?: string | null;
          caption?: string | null;
          channels?: string[];
          communication_type?: Database["public"]["Enums"]["communication_type"];
          created_at?: string;
          creator_license_no?: string | null;
          current_version_id?: string | null;
          deadline_at?: string | null;
          distribution?: string | null;
          escalated_to?: string | null;
          evergreen?: boolean;
          first_decision_at?: string | null;
          id?: string;
          is_demo?: boolean;
          is_paid?: boolean | null;
          market?: string;
          next_review_at?: string | null;
          org_id?: string | null;
          owner_id?: string | null;
          product_id?: string | null;
          published_at?: string | null;
          regulator_notice_at?: string | null;
          review_status?: Database["public"]["Enums"]["promotion_review_status"];
          reviewer_notes?: string | null;
          risk_acceptor_id?: string | null;
          risk_from_status?: Database["public"]["Enums"]["promotion_review_status"] | null;
          sector?: string | null;
          submitted_at?: string | null;
          tags?: string[];
          taken_down_at?: string | null;
          title?: string;
          updated_at?: string;
          upload_type?: string;
          variation_group_id?: string | null;
          withdrawal_due_at?: string | null;
          withdrawal_reason?: string | null;
          withdrawn_at?: string | null;
        };
        Relationships: [];
      };
      regulatory_sources: {
        Row: {
          authority: string;
          id: string;
          identifiers: string | null;
          notes: string | null;
          status: string;
          title_ar: string;
          title_en: string | null;
          url: string;
          verification: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          authority: string;
          id: string;
          identifiers?: string | null;
          notes?: string | null;
          status: string;
          title_ar: string;
          title_en?: string | null;
          url: string;
          verification: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          authority?: string;
          id?: string;
          identifiers?: string | null;
          notes?: string | null;
          status?: string;
          title_ar?: string;
          title_en?: string | null;
          url?: string;
          verification?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [];
      };
      rejection_reasons: {
        Row: {
          archived: boolean;
          id: string;
          is_default: boolean;
          is_other: boolean;
          kind: string;
          label_ar: string;
          label_en: string;
          org_id: string | null;
          sort_order: number;
        };
        Insert: {
          archived?: boolean;
          id?: string;
          is_default?: boolean;
          is_other?: boolean;
          kind: string;
          label_ar: string;
          label_en: string;
          org_id?: string | null;
          sort_order?: number;
        };
        Update: {
          archived?: boolean;
          id?: string;
          is_default?: boolean;
          is_other?: boolean;
          kind?: string;
          label_ar?: string;
          label_en?: string;
          org_id?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      review_decisions: {
        Row: {
          actor_id: string;
          actor_role: string;
          asset_sha256: string;
          comment: string | null;
          condition_ar: string | null;
          created_at: string;
          decision: string;
          findings_snapshot: Json;
          from_status: Database["public"]["Enums"]["promotion_review_status"];
          hash: string;
          id: string;
          prev_hash: string | null;
          promotion_id: string;
          reason_ids: string[];
          reason_other: string | null;
          rulebook_version_id: string | null;
          step_id: string | null;
          submission_id: string;
          to_status: Database["public"]["Enums"]["promotion_review_status"];
        };
        Insert: {
          actor_id: string;
          actor_role: string;
          asset_sha256: string;
          comment?: string | null;
          condition_ar?: string | null;
          created_at?: string;
          decision: string;
          findings_snapshot: Json;
          from_status: Database["public"]["Enums"]["promotion_review_status"];
          hash: string;
          id?: string;
          prev_hash?: string | null;
          promotion_id: string;
          reason_ids?: string[];
          reason_other?: string | null;
          rulebook_version_id?: string | null;
          step_id?: string | null;
          submission_id: string;
          to_status: Database["public"]["Enums"]["promotion_review_status"];
        };
        Update: {
          actor_id?: string;
          actor_role?: string;
          asset_sha256?: string;
          comment?: string | null;
          condition_ar?: string | null;
          created_at?: string;
          decision?: string;
          findings_snapshot?: Json;
          from_status?: Database["public"]["Enums"]["promotion_review_status"];
          hash?: string;
          id?: string;
          prev_hash?: string | null;
          promotion_id?: string;
          reason_ids?: string[];
          reason_other?: string | null;
          rulebook_version_id?: string | null;
          step_id?: string | null;
          submission_id?: string;
          to_status?: Database["public"]["Enums"]["promotion_review_status"];
        };
        Relationships: [];
      };
      review_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          event_type: string;
          from_status: string | null;
          id: number;
          org_id: string | null;
          payload: Json;
          promotion_id: string;
          submission_id: string | null;
          to_status: string | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          event_type: string;
          from_status?: string | null;
          id?: number;
          org_id?: string | null;
          payload?: Json;
          promotion_id: string;
          submission_id?: string | null;
          to_status?: string | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          event_type?: string;
          from_status?: string | null;
          id?: number;
          org_id?: string | null;
          payload?: Json;
          promotion_id?: string;
          submission_id?: string | null;
          to_status?: string | null;
        };
        Relationships: [];
      };
      rule_checks: {
        Row: {
          created_at: string;
          finding_ids: string[];
          id: number;
          outcome: string;
          reason_code: string | null;
          rule_id: string;
          run_id: string;
          submission_id: string;
        };
        Insert: {
          created_at?: string;
          finding_ids?: string[];
          id?: number;
          outcome: string;
          reason_code?: string | null;
          rule_id: string;
          run_id: string;
          submission_id: string;
        };
        Update: {
          created_at?: string;
          finding_ids?: string[];
          id?: number;
          outcome?: string;
          reason_code?: string | null;
          rule_id?: string;
          run_id?: string;
          submission_id?: string;
        };
        Relationships: [];
      };
      rule_packs: {
        Row: {
          always_enabled: boolean;
          authority: string;
          code: string;
          default_sectors: string[];
          description_ar: string | null;
          enabled_by_default: boolean;
          name_ar: string;
          name_en: string;
        };
        Insert: {
          always_enabled?: boolean;
          authority: string;
          code: string;
          default_sectors?: string[];
          description_ar?: string | null;
          enabled_by_default?: boolean;
          name_ar: string;
          name_en: string;
        };
        Update: {
          always_enabled?: boolean;
          authority?: string;
          code?: string;
          default_sectors?: string[];
          description_ar?: string | null;
          enabled_by_default?: boolean;
          name_ar?: string;
          name_en?: string;
        };
        Relationships: [];
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
          additional_citations: Json;
          applicability: Json;
          applies_to_categories: Database["public"]["Enums"]["product_category"][];
          article_ref: string | null;
          category: Database["public"]["Enums"]["rule_category"];
          change_reason: string | null;
          check_kind: string | null;
          check_type: Database["public"]["Enums"]["check_type"];
          code: string;
          content_triggers: string[];
          default_severity: Database["public"]["Enums"]["severity"];
          description_ar: string;
          description_en: string;
          deterministic_check: string | null;
          finding_type_on_fail: string | null;
          id: string;
          is_active: boolean;
          legal_reviewed_at: string | null;
          legal_reviewed_by: string | null;
          legal_status: string;
          llm_instructions: string;
          official_text_ar: string | null;
          pack: string | null;
          regulatory_source_id: string | null;
          review_state: string;
          rulebook_version_id: string;
          source_date: string | null;
          source_name_en: string | null;
          source_name: string;
          source_url: string;
          source_verified: boolean;
          summary_ar: string | null;
          summary_en: string | null;
          supersedes_rule_id: string | null;
          title_ar: string;
          title_en: string;
        };
        Insert: {
          additional_citations?: Json;
          applicability?: Json;
          applies_to_categories?: Database["public"]["Enums"]["product_category"][];
          article_ref?: string | null;
          category: Database["public"]["Enums"]["rule_category"];
          change_reason?: string | null;
          check_kind?: string | null;
          check_type: Database["public"]["Enums"]["check_type"];
          code: string;
          content_triggers?: string[];
          default_severity: Database["public"]["Enums"]["severity"];
          description_ar: string;
          description_en: string;
          deterministic_check?: string | null;
          finding_type_on_fail?: string | null;
          id?: string;
          is_active?: boolean;
          legal_reviewed_at?: string | null;
          legal_reviewed_by?: string | null;
          legal_status?: string;
          llm_instructions: string;
          official_text_ar?: string | null;
          pack?: string | null;
          regulatory_source_id?: string | null;
          review_state?: string;
          rulebook_version_id: string;
          source_date?: string | null;
          source_name_en?: string | null;
          source_name: string;
          source_url: string;
          source_verified?: boolean;
          summary_ar?: string | null;
          summary_en?: string | null;
          supersedes_rule_id?: string | null;
          title_ar: string;
          title_en: string;
        };
        Update: {
          additional_citations?: Json;
          applicability?: Json;
          applies_to_categories?: Database["public"]["Enums"]["product_category"][];
          article_ref?: string | null;
          category?: Database["public"]["Enums"]["rule_category"];
          change_reason?: string | null;
          check_kind?: string | null;
          check_type?: Database["public"]["Enums"]["check_type"];
          code?: string;
          content_triggers?: string[];
          default_severity?: Database["public"]["Enums"]["severity"];
          description_ar?: string;
          description_en?: string;
          deterministic_check?: string | null;
          finding_type_on_fail?: string | null;
          id?: string;
          is_active?: boolean;
          legal_reviewed_at?: string | null;
          legal_reviewed_by?: string | null;
          legal_status?: string;
          llm_instructions?: string;
          official_text_ar?: string | null;
          pack?: string | null;
          regulatory_source_id?: string | null;
          review_state?: string;
          rulebook_version_id?: string;
          source_date?: string | null;
          source_name_en?: string | null;
          source_name?: string;
          source_url?: string;
          source_verified?: boolean;
          summary_ar?: string | null;
          summary_en?: string | null;
          supersedes_rule_id?: string | null;
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
      saved_views: {
        Row: {
          created_at: string;
          filters: Json;
          id: string;
          name: string;
          org_id: string | null;
          owner_id: string;
          scope: string;
          shared: boolean;
        };
        Insert: {
          created_at?: string;
          filters: Json;
          id?: string;
          name: string;
          org_id?: string | null;
          owner_id?: string;
          scope: string;
          shared?: boolean;
        };
        Update: {
          created_at?: string;
          filters?: Json;
          id?: string;
          name?: string;
          org_id?: string | null;
          owner_id?: string;
          scope?: string;
          shared?: boolean;
        };
        Relationships: [];
      };
      self_approval_rules: {
        Row: {
          active: boolean;
          ai_requirement: string;
          channels: string[];
          created_at: string;
          created_by: string | null;
          id: string;
          markets: string[];
          name: string;
          org_id: string;
          product_types: string[];
          roles: Database["public"]["Enums"]["org_role"][];
          user_ids: string[];
        };
        Insert: {
          active?: boolean;
          ai_requirement?: string;
          channels?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          markets?: string[];
          name: string;
          org_id: string;
          product_types?: string[];
          roles?: Database["public"]["Enums"]["org_role"][];
          user_ids?: string[];
        };
        Update: {
          active?: boolean;
          ai_requirement?: string;
          channels?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          markets?: string[];
          name?: string;
          org_id?: string;
          product_types?: string[];
          roles?: Database["public"]["Enums"]["org_role"][];
          user_ids?: string[];
        };
        Relationships: [];
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
      submission_assets: {
        Row: {
          duration_s: number | null;
          file_path: string;
          height: number | null;
          id: string;
          kind: string;
          page_count: number | null;
          position: number;
          sha256: string;
          submission_id: string;
          width: number | null;
        };
        Insert: {
          duration_s?: number | null;
          file_path: string;
          height?: number | null;
          id?: string;
          kind: string;
          page_count?: number | null;
          position: number;
          sha256: string;
          submission_id: string;
          width?: number | null;
        };
        Update: {
          duration_s?: number | null;
          file_path?: string;
          height?: number | null;
          id?: string;
          kind?: string;
          page_count?: number | null;
          position?: number;
          sha256?: string;
          submission_id?: string;
          width?: number | null;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          ai_used: boolean;
          analyzed_at: string | null;
          attempts: number;
          audio_path: string | null;
          audio_probe: Json | null;
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
          image_count: number;
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
          promotion_id: string | null;
          sha256: string | null;
          status: Database["public"]["Enums"]["submission_status"];
          text_content: string | null;
          thumbnail_path: string | null;
          title: string | null;
          user_id: string | null;
          version_no: number | null;
        };
        Insert: {
          ai_used?: boolean;
          analyzed_at?: string | null;
          attempts?: number;
          audio_path?: string | null;
          audio_probe?: Json | null;
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
          image_count?: number;
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
          promotion_id?: string | null;
          sha256?: string | null;
          status?: Database["public"]["Enums"]["submission_status"];
          text_content?: string | null;
          thumbnail_path?: string | null;
          title?: string | null;
          user_id?: string | null;
          version_no?: number | null;
        };
        Update: {
          ai_used?: boolean;
          analyzed_at?: string | null;
          attempts?: number;
          audio_path?: string | null;
          audio_probe?: Json | null;
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
          image_count?: number;
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
          promotion_id?: string | null;
          sha256?: string | null;
          status?: Database["public"]["Enums"]["submission_status"];
          text_content?: string | null;
          thumbnail_path?: string | null;
          title?: string | null;
          user_id?: string | null;
          version_no?: number | null;
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
      webhook_deliveries: {
        Row: {
          attempts: number;
          created_at: string;
          delivered_at: string | null;
          endpoint_id: string;
          event: string;
          id: number;
          last_error: string | null;
          last_status_code: number | null;
          next_attempt_at: string;
          payload: Json;
          status: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          delivered_at?: string | null;
          endpoint_id: string;
          event: string;
          id?: number;
          last_error?: string | null;
          last_status_code?: number | null;
          next_attempt_at?: string;
          payload: Json;
          status?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          delivered_at?: string | null;
          endpoint_id?: string;
          event?: string;
          id?: number;
          last_error?: string | null;
          last_status_code?: number | null;
          next_attempt_at?: string;
          payload?: Json;
          status?: string;
        };
        Relationships: [];
      };
      webhook_endpoints: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          events: string[];
          id: string;
          kind: string;
          org_id: string;
          secret: string;
          url: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          events: string[];
          id?: string;
          kind: string;
          org_id: string;
          secret: string;
          url: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          events?: string[];
          id?: string;
          kind?: string;
          org_id?: string;
          secret?: string;
          url?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_calibration_note: { Args: { _rule_code: string; _note: string }; Returns: string };
      calibration_report: { Args: { _from: string; _to: string }; Returns: Json };
      set_webhook_active: { Args: { _id: string; _active: boolean }; Returns: undefined };
      webhook_secret: { Args: { _id: string }; Returns: string };
      save_webhook_endpoint: {
        Args: { _org: string; _kind: string; _url: string; _events: string[] };
        Returns: string;
      };
      revoke_api_key: { Args: { _id: string }; Returns: undefined };
      create_api_key: {
        Args: { _org: string; _name: string; _scopes: string[]; _days?: number };
        Returns: string;
      };
      self_approve: { Args: { _pid: string; _comment?: string | null }; Returns: string };
      can_self_approve: { Args: { _pid: string }; Returns: Json };
      save_self_approval_rule: {
        Args: {
          _org: string;
          _id: string | null;
          _name: string;
          _channels: string[];
          _product_types: string[];
          _markets: string[];
          _roles: Database["public"]["Enums"]["org_role"][];
          _users: string[];
          _ai: string;
          _active: boolean;
        };
        Returns: string;
      };
      archive_internal_rule: { Args: { _id: string }; Returns: undefined };
      approve_internal_rule: { Args: { _id: string }; Returns: undefined };
      save_internal_rule: {
        Args: {
          _org: string;
          _id: string | null;
          _code: string;
          _title: string;
          _instruction: string;
          _severity: string;
        };
        Returns: string;
      };
      save_brand_guideline: {
        Args: { _org: string; _title: string; _text: string; _file?: string | null };
        Returns: string;
      };
      can_manage_internal_rules: { Args: { _org: string }; Returns: boolean };
      business_days_between: {
        Args: { _from: string; _to: string; _weekend?: number[] };
        Returns: number;
      };
      org_metrics: {
        Args: { _org: string; _from: string; _to: string; _filters?: Json };
        Returns: Json;
      };
      complete_rereview: {
        Args: {
          _pid: string;
          _still_valid: boolean;
          _next_review: string | null;
          _comment: string | null;
        };
        Returns: string;
      };
      mark_withdrawn: { Args: { _pid: string; _reason: string }; Returns: undefined };
      request_withdrawal: {
        Args: { _pid: string; _notice_at: string; _reason: string };
        Returns: string;
      };
      record_lifecycle: {
        Args: { _pid: string; _event: string; _at: string | null };
        Returns: undefined;
      };
      set_evergreen: {
        Args: { _pid: string; _evergreen: boolean; _next_review: string | null };
        Returns: undefined;
      };
      saudi_business_day_after: { Args: { _at: string; _holidays?: string[] }; Returns: string };
      submit_variations: { Args: { _group: string; _note?: string | null }; Returns: Json };
      create_variation: { Args: { _pid: string; _title: string }; Returns: string };
      decide_partner_access: {
        Args: { _org: string; _user: string; _approve: boolean };
        Returns: undefined;
      };
      partner_create_promotion: {
        Args: {
          _token: string;
          _title: string;
          _product: string | null;
          _channels: string[];
          _communication_type: Database["public"]["Enums"]["communication_type"];
        };
        Returns: string;
      };
      partner_join: { Args: { _token: string; _accept_terms: boolean }; Returns: string };
      partner_link_info: { Args: { _token: string }; Returns: Json };
      set_partner_link_active: { Args: { _id: string; _active: boolean }; Returns: undefined };
      create_partner_link: {
        Args: {
          _org: string;
          _label: string;
          _products: string[];
          _channels: string[];
          _intro: string | null;
          _terms: string;
        };
        Returns: string;
      };
      is_external_member: { Args: { _org: string }; Returns: boolean };
      decide_risk: { Args: { _pid: string; _accept: boolean; _reason: string }; Returns: string };
      request_risk_acceptance: {
        Args: { _pid: string; _acceptor: string; _reason: string };
        Returns: undefined;
      };
      set_risk_acceptor: {
        Args: { _org: string; _user: string; _on: boolean };
        Returns: undefined;
      };
      preset_preview: { Args: { _pid: string }; Returns: Json };
      set_preset_auto_apply: {
        Args: {
          _org: string;
          _market: string;
          _product_type: string | null;
          _preset: string | null;
        };
        Returns: undefined;
      };
      archive_approval_preset: { Args: { _id: string }; Returns: undefined };
      save_approval_preset: {
        Args: {
          _org: string;
          _id: string | null;
          _name: string;
          _mode: string;
          _is_default: boolean;
          _steps: Json;
        };
        Returns: string;
      };
      replace_review_flow: { Args: { _pid: string; _preset: string }; Returns: number };
      decide_promotion_step: {
        Args: {
          _pid: string;
          _step: string;
          _decision: string;
          _reason_ids?: string[];
          _reason_other?: string | null;
          _comment?: string | null;
          _fresh_review?: boolean;
        };
        Returns: string;
      };
      can_act_on_step: { Args: { _step: string }; Returns: Json };
      submit_promotion_carry: {
        Args: { _pid: string; _note?: string | null; _ack_failed?: boolean; _carry?: number[] };
        Returns: undefined;
      };
      flow_is_live: { Args: { _pid: string }; Returns: boolean };
      current_flow_no: { Args: { _pid: string }; Returns: number };
      org_feature: { Args: { _org: string; _key: string }; Returns: boolean };
      archive_rule_override: { Args: { _id: string }; Returns: undefined };
      set_rule_override: {
        Args: { _org: string; _rule_code: string; _patch: Json; _reason: string };
        Returns: string;
      };
      save_disclaimer: {
        Args: {
          _id: string | null;
          _org: string;
          _name: string;
          _text_ar: string;
          _text_en: string | null;
          _product_types: string[];
          _channels: string[];
          _communication_types: string[];
          _required_by: string[];
          _prominence: boolean;
          _status: string;
        };
        Returns: string;
      };
      claim_extend_scope: { Args: { _claim: string; _pid: string }; Returns: string };
      claim_add_from_finding: {
        Args: {
          _finding: string;
          _name: string;
          _text_ar: string;
          _substantiation: Json;
          _approve?: boolean;
        };
        Returns: string;
      };
      link_claim: { Args: { _pid: string; _claim: string; _link?: boolean }; Returns: undefined };
      archive_claim: { Args: { _id: string }; Returns: undefined };
      new_claim_version: { Args: { _id: string }; Returns: string };
      review_claim: {
        Args: { _id: string; _decision: string; _reason_ids?: string[]; _comment?: string | null };
        Returns: undefined;
      };
      submit_claim: { Args: { _id: string }; Returns: undefined };
      save_claim: {
        Args: {
          _id: string | null;
          _org: string;
          _name: string;
          _text_ar: string;
          _text_en: string | null;
          _product_ids: string[];
          _channels: string[];
          _communication_types: string[];
          _substantiation: Json;
          _next_review: string | null;
          _expires: string | null;
        };
        Returns: string;
      };
      delete_comment: { Args: { _id: string }; Returns: undefined };
      resolve_comment: { Args: { _id: string; _resolved: boolean }; Returns: undefined };
      edit_comment: { Args: { _id: string; _body: string }; Returns: undefined };
      add_comment: {
        Args: {
          _pid: string;
          _sid: string;
          _body: string;
          _anchor?: Json | null;
          _parent?: string | null;
          _kind?: string;
          _mentions?: string[];
        };
        Returns: string;
      };
      respond_finding: {
        Args: { _finding: string; _action: string; _comment?: string | null };
        Returns: string;
      };
      verify_decision_chain: { Args: { _pid: string }; Returns: Json };
      archive_promotion: { Args: { _pid: string; _reason: string }; Returns: undefined };
      respond_escalation: { Args: { _pid: string; _response: string }; Returns: string };
      escalate_promotion: {
        Args: { _pid: string; _legal_user: string; _question: string };
        Returns: string;
      };
      decide_promotion: {
        Args: {
          _pid: string;
          _decision: string;
          _reason_ids?: string[];
          _reason_other?: string | null;
          _condition?: string | null;
          _comment?: string | null;
        };
        Returns: string;
      };
      assign_reviewer: { Args: { _pid: string; _user: string }; Returns: undefined };
      open_review: { Args: { _pid: string }; Returns: undefined };
      submit_promotion: {
        Args: { _pid: string; _note?: string | null; _ack_failed?: boolean };
        Returns: undefined;
      };
      can_decide: { Args: { _pid: string }; Returns: Json };
      can_submit: {
        Args: { _pid: string; _note?: string | null; _ack_failed?: boolean };
        Returns: Json;
      };
      set_rule_review_state: {
        Args: {
          _rule: string;
          _state: string;
          _reason: string;
          _official_text_ar?: string | null;
          _reviewer?: string | null;
        };
        Returns: undefined;
      };
      set_org_rule_pack: {
        Args: { _org: string; _pack: string; _enabled: boolean; _include_drafts: boolean };
        Returns: undefined;
      };
      can_read_promotion: { Args: { _pid: string }; Returns: boolean };
      archive_product: { Args: { _id: string }; Returns: undefined };
      approve_product: { Args: { _id: string }; Returns: undefined };
      accept_org_invite: { Args: { _token: string }; Returns: string };
      admin_dedupe_stats: { Args: { _days?: number }; Returns: Json };
      admin_finding_feedback: { Args: { _limit?: number }; Returns: Json };
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
      log_duplicate_reuse: { Args: { _previous: string }; Returns: undefined };
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
      communication_type:
        "financial_promotion" | "general_commercial" | "creator_sponsored" | "internal";
      promotion_review_status:
        | "draft"
        | "pending_review"
        | "in_review"
        | "changes_requested"
        | "conditionally_approved"
        | "approved"
        | "rejected"
        | "escalated"
        | "withdrawn"
        | "archived"
        | "reviewing_risk"
        | "risk_accepted"
        | "due_for_rereview";
      app_role: "admin" | "user";
      check_type: "audio" | "visual" | "text" | "metadata" | "hybrid";
      evidence_type: "transcript" | "frame" | "caption" | "metadata";
      finding_source: "deterministic" | "llm";
      org_role:
        | "owner"
        | "admin"
        | "reviewer"
        | "creator"
        | "legal"
        | "external_uploader"
        | "external_reviewer";
      overall_status: "ready" | "needs_fixes" | "review";
      pipeline_step: "transcribe" | "deterministic" | "llm" | "merge" | "done";
      platform: "snapchat" | "tiktok" | "instagram" | "x" | "youtube";
      product_category: "food" | "health" | "beauty" | "finance" | "real_estate" | "other";
      rule_category: "mawthooq" | "content" | "ai" | "commerce";
      severity: "violation" | "warning";
      submission_kind: "video" | "image" | "text" | "pdf";
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
      communication_type: [
        "financial_promotion",
        "general_commercial",
        "creator_sponsored",
        "internal",
      ],
      promotion_review_status: [
        "draft",
        "pending_review",
        "in_review",
        "changes_requested",
        "conditionally_approved",
        "approved",
        "rejected",
        "escalated",
        "withdrawn",
        "archived",
        "reviewing_risk",
        "risk_accepted",
        "due_for_rereview",
      ],
      app_role: ["admin", "user"],
      check_type: ["audio", "visual", "text", "metadata", "hybrid"],
      evidence_type: ["transcript", "frame", "caption", "metadata"],
      finding_source: ["deterministic", "llm"],
      org_role: [
        "owner",
        "admin",
        "reviewer",
        "creator",
        "legal",
        "external_uploader",
        "external_reviewer",
      ],
      overall_status: ["ready", "needs_fixes", "review"],
      pipeline_step: ["transcribe", "deterministic", "llm", "merge", "done"],
      platform: ["snapchat", "tiktok", "instagram", "x", "youtube"],
      product_category: ["food", "health", "beauty", "finance", "real_estate", "other"],
      rule_category: ["mawthooq", "content", "ai", "commerce"],
      severity: ["violation", "warning"],
      submission_kind: ["video", "image", "text", "pdf"],
      submission_status: ["queued", "extracting", "transcribing", "analyzing", "done", "failed"],
    },
  },
} as const;
