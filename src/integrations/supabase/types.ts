export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_settings: {
        Row: {
          asr_model: string
          frames_to_llm: number
          id: number
          llm_model: string
          prompt_version: string
          updated_at: string
        }
        Insert: {
          asr_model?: string
          frames_to_llm?: number
          id?: number
          llm_model?: string
          prompt_version?: string
          updated_at?: string
        }
        Update: {
          asr_model?: string
          frames_to_llm?: number
          id?: number
          llm_model?: string
          prompt_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      analysis_runs: {
        Row: {
          asr_model: string | null
          finished_at: string | null
          id: string
          llm_model: string | null
          prompt_version: string | null
          raw_llm_output: Json | null
          rulebook_version: string | null
          rulebook_version_id: string | null
          started_at: string
          step_outputs: Json
          submission_id: string
          token_usage: Json | null
        }
        Insert: {
          asr_model?: string | null
          finished_at?: string | null
          id?: string
          llm_model?: string | null
          prompt_version?: string | null
          raw_llm_output?: Json | null
          rulebook_version?: string | null
          rulebook_version_id?: string | null
          started_at?: string
          step_outputs?: Json
          submission_id: string
          token_usage?: Json | null
        }
        Update: {
          asr_model?: string | null
          finished_at?: string | null
          id?: string
          llm_model?: string | null
          prompt_version?: string | null
          raw_llm_output?: Json | null
          rulebook_version?: string | null
          rulebook_version_id?: string | null
          started_at?: string
          step_outputs?: Json
          submission_id?: string
          token_usage?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_rulebook_version_id_fkey"
            columns: ["rulebook_version_id"]
            isOneToOne: false
            referencedRelation: "rulebook_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_runs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_logs: {
        Row: {
          content_hash: string
          generated_at: string
          submission_id: string
        }
        Insert: {
          content_hash: string
          generated_at?: string
          submission_id: string
        }
        Update: {
          content_hash?: string
          generated_at?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_cases: {
        Row: {
          created_at: string
          created_by: string
          expected: Json
          id: string
          name: string
          submission_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expected?: Json
          id?: string
          name: string
          submission_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expected?: Json
          id?: string
          name?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eval_cases_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          confidence: number
          evidence_frame_id: string | null
          evidence_text: string | null
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          explanation_ar: string | null
          explanation_en: string | null
          fix_ar: string | null
          fix_en: string | null
          id: string
          rule_code: string
          run_id: string
          severity: Database["public"]["Enums"]["severity"]
          source: Database["public"]["Enums"]["finding_source"]
          submission_id: string
          t_end: number | null
          t_start: number | null
        }
        Insert: {
          confidence?: number
          evidence_frame_id?: string | null
          evidence_text?: string | null
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          explanation_ar?: string | null
          explanation_en?: string | null
          fix_ar?: string | null
          fix_en?: string | null
          id?: string
          rule_code: string
          run_id: string
          severity: Database["public"]["Enums"]["severity"]
          source: Database["public"]["Enums"]["finding_source"]
          submission_id: string
          t_end?: number | null
          t_start?: number | null
        }
        Update: {
          confidence?: number
          evidence_frame_id?: string | null
          evidence_text?: string | null
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          explanation_ar?: string | null
          explanation_en?: string | null
          fix_ar?: string | null
          fix_en?: string | null
          id?: string
          rule_code?: string
          run_id?: string
          severity?: Database["public"]["Enums"]["severity"]
          source?: Database["public"]["Enums"]["finding_source"]
          submission_id?: string
          t_end?: number | null
          t_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_evidence_frame_id_fkey"
            columns: ["evidence_frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      frames: {
        Row: {
          id: string
          image_path: string | null
          ocr_text: string | null
          submission_id: string
          t_seconds: number
        }
        Insert: {
          id?: string
          image_path?: string | null
          ocr_text?: string | null
          submission_id: string
          t_seconds: number
        }
        Update: {
          id?: string
          image_path?: string | null
          ocr_text?: string | null
          submission_id?: string
          t_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "frames_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          mawthooq_license_no: string | null
          platforms: Database["public"]["Enums"]["platform"][]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          mawthooq_license_no?: string | null
          platforms?: Database["public"]["Enums"]["platform"][]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          mawthooq_license_no?: string | null
          platforms?: Database["public"]["Enums"]["platform"][]
        }
        Relationships: []
      }
      rulebook_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          version_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          version_label: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          version_label?: string
        }
        Relationships: []
      }
      rules: {
        Row: {
          applies_to_categories: Database["public"]["Enums"]["product_category"][]
          category: Database["public"]["Enums"]["rule_category"]
          check_type: Database["public"]["Enums"]["check_type"]
          code: string
          default_severity: Database["public"]["Enums"]["severity"]
          description_ar: string
          description_en: string
          id: string
          is_active: boolean
          llm_instructions: string
          rulebook_version_id: string
          source_date: string | null
          source_name: string
          source_url: string
          title_ar: string
          title_en: string
        }
        Insert: {
          applies_to_categories?: Database["public"]["Enums"]["product_category"][]
          category: Database["public"]["Enums"]["rule_category"]
          check_type: Database["public"]["Enums"]["check_type"]
          code: string
          default_severity: Database["public"]["Enums"]["severity"]
          description_ar: string
          description_en: string
          id?: string
          is_active?: boolean
          llm_instructions: string
          rulebook_version_id: string
          source_date?: string | null
          source_name: string
          source_url: string
          title_ar: string
          title_en: string
        }
        Update: {
          applies_to_categories?: Database["public"]["Enums"]["product_category"][]
          category?: Database["public"]["Enums"]["rule_category"]
          check_type?: Database["public"]["Enums"]["check_type"]
          code?: string
          default_severity?: Database["public"]["Enums"]["severity"]
          description_ar?: string
          description_en?: string
          id?: string
          is_active?: boolean
          llm_instructions?: string
          rulebook_version_id?: string
          source_date?: string | null
          source_name?: string
          source_url?: string
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_rulebook_version_id_fkey"
            columns: ["rulebook_version_id"]
            isOneToOne: false
            referencedRelation: "rulebook_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          ai_used: boolean
          analyzed_at: string | null
          audio_path: string | null
          caption: string
          created_at: string
          current_step: Database["public"]["Enums"]["pipeline_step"]
          duration_seconds: number | null
          error_message: string | null
          file_path: string | null
          has_written_contract: boolean
          id: string
          is_demo: boolean
          is_paid_ad: boolean
          kind: Database["public"]["Enums"]["submission_kind"]
          mawthooq_license_no: string | null
          media_deleted_at: string | null
          overall_status: Database["public"]["Enums"]["overall_status"] | null
          parent_id: string | null
          platform: Database["public"]["Enums"]["platform"]
          product_category: Database["public"]["Enums"]["product_category"]
          progress: number
          sha256: string | null
          status: Database["public"]["Enums"]["submission_status"]
          text_content: string | null
          thumbnail_path: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          ai_used?: boolean
          analyzed_at?: string | null
          audio_path?: string | null
          caption?: string
          created_at?: string
          current_step?: Database["public"]["Enums"]["pipeline_step"]
          duration_seconds?: number | null
          error_message?: string | null
          file_path?: string | null
          has_written_contract?: boolean
          id?: string
          is_demo?: boolean
          is_paid_ad?: boolean
          kind: Database["public"]["Enums"]["submission_kind"]
          mawthooq_license_no?: string | null
          media_deleted_at?: string | null
          overall_status?: Database["public"]["Enums"]["overall_status"] | null
          parent_id?: string | null
          platform: Database["public"]["Enums"]["platform"]
          product_category: Database["public"]["Enums"]["product_category"]
          progress?: number
          sha256?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          text_content?: string | null
          thumbnail_path?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          ai_used?: boolean
          analyzed_at?: string | null
          audio_path?: string | null
          caption?: string
          created_at?: string
          current_step?: Database["public"]["Enums"]["pipeline_step"]
          duration_seconds?: number | null
          error_message?: string | null
          file_path?: string | null
          has_written_contract?: boolean
          id?: string
          is_demo?: boolean
          is_paid_ad?: boolean
          kind?: Database["public"]["Enums"]["submission_kind"]
          mawthooq_license_no?: string | null
          media_deleted_at?: string | null
          overall_status?: Database["public"]["Enums"]["overall_status"] | null
          parent_id?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          product_category?: Database["public"]["Enums"]["product_category"]
          progress?: number
          sha256?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          text_content?: string | null
          thumbnail_path?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          full_text: string
          language: string | null
          provider: string | null
          segments: Json
          submission_id: string
        }
        Insert: {
          full_text?: string
          language?: string | null
          provider?: string | null
          segments?: Json
          submission_id: string
        }
        Update: {
          full_text?: string
          language?: string | null
          provider?: string | null
          segments?: Json
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_submission: { Args: { _sid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_submission: { Args: { _sid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      check_type: "audio" | "visual" | "text" | "metadata" | "hybrid"
      evidence_type: "transcript" | "frame" | "caption" | "metadata"
      finding_source: "deterministic" | "llm"
      overall_status: "ready" | "needs_fixes" | "review"
      pipeline_step: "transcribe" | "deterministic" | "llm" | "merge" | "done"
      platform: "snapchat" | "tiktok" | "instagram" | "x" | "youtube"
      product_category:
        | "food"
        | "health"
        | "beauty"
        | "finance"
        | "real_estate"
        | "other"
      rule_category: "mawthooq" | "content" | "ai" | "commerce"
      severity: "violation" | "warning"
      submission_kind: "video" | "image" | "text"
      submission_status:
        | "queued"
        | "extracting"
        | "transcribing"
        | "analyzing"
        | "done"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      check_type: ["audio", "visual", "text", "metadata", "hybrid"],
      evidence_type: ["transcript", "frame", "caption", "metadata"],
      finding_source: ["deterministic", "llm"],
      overall_status: ["ready", "needs_fixes", "review"],
      pipeline_step: ["transcribe", "deterministic", "llm", "merge", "done"],
      platform: ["snapchat", "tiktok", "instagram", "x", "youtube"],
      product_category: [
        "food",
        "health",
        "beauty",
        "finance",
        "real_estate",
        "other",
      ],
      rule_category: ["mawthooq", "content", "ai", "commerce"],
      severity: ["violation", "warning"],
      submission_kind: ["video", "image", "text"],
      submission_status: [
        "queued",
        "extracting",
        "transcribing",
        "analyzing",
        "done",
        "failed",
      ],
    },
  },
} as const
