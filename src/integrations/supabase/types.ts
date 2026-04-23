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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_sources: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          model_version: string | null
          name: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          model_version?: string | null
          name: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          model_version?: string | null
          name?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      batch_job_items: {
        Row: {
          analysis_id: string | null
          batch_id: string
          created_at: string
          error: string | null
          id: string
          note_text: string
          patient_label: string | null
          position: number
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          batch_id: string
          created_at?: string
          error?: string | null
          id?: string
          note_text: string
          patient_label?: string | null
          position: number
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          batch_id?: string
          created_at?: string
          error?: string | null
          id?: string
          note_text?: string
          patient_label?: string | null
          position?: number
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_job_items_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "note_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_job_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_jobs: {
        Row: {
          aggregate_summary: Json | null
          ai_source_id: string | null
          completed_at: string | null
          created_at: string
          error: string | null
          failed_items: number
          id: string
          label: string | null
          processed_items: number
          status: Database["public"]["Enums"]["batch_status"]
          total_items: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aggregate_summary?: Json | null
          ai_source_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          failed_items?: number
          id?: string
          label?: string | null
          processed_items?: number
          status?: Database["public"]["Enums"]["batch_status"]
          total_items?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aggregate_summary?: Json | null
          ai_source_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          failed_items?: number
          id?: string
          label?: string | null
          processed_items?: number
          status?: Database["public"]["Enums"]["batch_status"]
          total_items?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_jobs_ai_source_id_fkey"
            columns: ["ai_source_id"]
            isOneToOne: false
            referencedRelation: "ai_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_guidelines: {
        Row: {
          active: boolean
          citation: string | null
          condition_keywords: string[]
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization: string
          recommendations: string
          red_flags: string | null
          specialty: string
          summary: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          citation?: string | null
          condition_keywords?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization: string
          recommendations: string
          red_flags?: string | null
          specialty: string
          summary: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          citation?: string | null
          condition_keywords?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization?: string
          recommendations?: string
          red_flags?: string | null
          specialty?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinical_notes: {
        Row: {
          ai_source_id: string | null
          chief_complaint: string | null
          created_at: string
          id: string
          note_text: string
          patient_label: string | null
          source_metadata: Json | null
          specialty: string | null
          user_id: string
        }
        Insert: {
          ai_source_id?: string | null
          chief_complaint?: string | null
          created_at?: string
          id?: string
          note_text: string
          patient_label?: string | null
          source_metadata?: Json | null
          specialty?: string | null
          user_id: string
        }
        Update: {
          ai_source_id?: string | null
          chief_complaint?: string | null
          created_at?: string
          id?: string
          note_text?: string
          patient_label?: string | null
          source_metadata?: Json | null
          specialty?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_ai_source_id_fkey"
            columns: ["ai_source_id"]
            isOneToOne: false
            referencedRelation: "ai_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      note_analyses: {
        Row: {
          accuracy_score: number | null
          ai_source_id: string | null
          clinical_reasoning: Json | null
          cognitive_biases: Json | null
          completeness_score: number | null
          created_at: string
          gold_standard: Json | null
          guideline_references: Json | null
          id: string
          issues: Json | null
          model_used: string | null
          note_id: string
          overall_trust_score: number | null
          pattern_matches: Json | null
          raw_response: Json | null
          reasoning_rating: string | null
          reasoning_score: number | null
          recognized_pattern: string | null
          red_flags: Json | null
          risk_impact: Json | null
          safety_score: number | null
          top_clinical_risk: string | null
          user_id: string
        }
        Insert: {
          accuracy_score?: number | null
          ai_source_id?: string | null
          clinical_reasoning?: Json | null
          cognitive_biases?: Json | null
          completeness_score?: number | null
          created_at?: string
          gold_standard?: Json | null
          guideline_references?: Json | null
          id?: string
          issues?: Json | null
          model_used?: string | null
          note_id: string
          overall_trust_score?: number | null
          pattern_matches?: Json | null
          raw_response?: Json | null
          reasoning_rating?: string | null
          reasoning_score?: number | null
          recognized_pattern?: string | null
          red_flags?: Json | null
          risk_impact?: Json | null
          safety_score?: number | null
          top_clinical_risk?: string | null
          user_id: string
        }
        Update: {
          accuracy_score?: number | null
          ai_source_id?: string | null
          clinical_reasoning?: Json | null
          cognitive_biases?: Json | null
          completeness_score?: number | null
          created_at?: string
          gold_standard?: Json | null
          guideline_references?: Json | null
          id?: string
          issues?: Json | null
          model_used?: string | null
          note_id?: string
          overall_trust_score?: number | null
          pattern_matches?: Json | null
          raw_response?: Json | null
          reasoning_rating?: string | null
          reasoning_score?: number | null
          recognized_pattern?: string | null
          red_flags?: Json | null
          risk_impact?: Json | null
          safety_score?: number | null
          top_clinical_risk?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_analyses_ai_source_id_fkey"
            columns: ["ai_source_id"]
            isOneToOne: false
            referencedRelation: "ai_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_analyses_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          organization: string | null
          role_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          organization?: string | null
          role_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          organization?: string | null
          role_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "reviewer" | "viewer"
      batch_status: "pending" | "processing" | "completed" | "failed"
      item_status: "queued" | "processing" | "done" | "error"
      severity_level: "critical" | "important" | "minor" | "info"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "reviewer", "viewer"],
      batch_status: ["pending", "processing", "completed", "failed"],
      item_status: ["queued", "processing", "done", "error"],
      severity_level: ["critical", "important", "minor", "info"],
    },
  },
} as const
