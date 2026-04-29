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
      adjudications: {
        Row: {
          adjudicated_at: string
          adjudication: string | null
          assignment_id: string
          criterion_result_id: string | null
          id: string
          reviewer_id: string
          reviewer_notes: string | null
        }
        Insert: {
          adjudicated_at?: string
          adjudication?: string | null
          assignment_id: string
          criterion_result_id?: string | null
          id?: string
          reviewer_id: string
          reviewer_notes?: string | null
        }
        Update: {
          adjudicated_at?: string
          adjudication?: string | null
          assignment_id?: string
          criterion_result_id?: string | null
          id?: string
          reviewer_id?: string
          reviewer_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adjudications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "reviewer_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjudications_criterion_result_id_fkey"
            columns: ["criterion_result_id"]
            isOneToOne: false
            referencedRelation: "criterion_results"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          artifact_id: string | null
          encounter_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          occurred_at: string
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          artifact_id?: string | null
          encounter_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          occurred_at?: string
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          artifact_id?: string | null
          encounter_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          occurred_at?: string
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_evidence_links: {
        Row: {
          claim_id: string
          confidence: number | null
          created_at: string
          id: string
          link_type: string | null
          source_span_id: string | null
        }
        Insert: {
          claim_id: string
          confidence?: number | null
          created_at?: string
          id?: string
          link_type?: string | null
          source_span_id?: string | null
        }
        Update: {
          claim_id?: string
          confidence?: number | null
          created_at?: string
          id?: string
          link_type?: string | null
          source_span_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_evidence_links_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "clinical_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_evidence_links_source_span_id_fkey"
            columns: ["source_span_id"]
            isOneToOne: false
            referencedRelation: "source_spans"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_claims: {
        Row: {
          artifact_id: string
          claim_entities: Json | null
          claim_text: string
          claim_type: string
          created_at: string
          id: string
          risk_weight: number | null
          section_id: string | null
          status: string | null
        }
        Insert: {
          artifact_id: string
          claim_entities?: Json | null
          claim_text: string
          claim_type: string
          created_at?: string
          id?: string
          risk_weight?: number | null
          section_id?: string | null
          status?: string | null
        }
        Update: {
          artifact_id?: string
          claim_entities?: Json | null
          claim_text?: string
          claim_type?: string
          created_at?: string
          id?: string
          risk_weight?: number | null
          section_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_claims_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "note_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_claims_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "note_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          action_type: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          organization_id: string | null
          status: string
          triggered_by_event_id: string | null
        }
        Insert: {
          action_type?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          triggered_by_event_id?: string | null
        }
        Update: {
          action_type?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          triggered_by_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_triggered_by_event_id_fkey"
            columns: ["triggered_by_event_id"]
            isOneToOne: false
            referencedRelation: "risk_events"
            referencedColumns: ["id"]
          },
        ]
      }
      criterion_results: {
        Row: {
          applicability: string | null
          confidence: number | null
          created_at: string
          criterion_id: string | null
          evaluation_run_id: string
          evidence: Json | null
          explanation: string | null
          id: string
          requires_human_adjudication: boolean
          result: string | null
          review_action: string | null
          score_delta: number | null
          severity: string | null
        }
        Insert: {
          applicability?: string | null
          confidence?: number | null
          created_at?: string
          criterion_id?: string | null
          evaluation_run_id: string
          evidence?: Json | null
          explanation?: string | null
          id?: string
          requires_human_adjudication?: boolean
          result?: string | null
          review_action?: string | null
          score_delta?: number | null
          severity?: string | null
        }
        Update: {
          applicability?: string | null
          confidence?: number | null
          created_at?: string
          criterion_id?: string | null
          evaluation_run_id?: string
          evidence?: Json | null
          explanation?: string | null
          id?: string
          requires_human_adjudication?: boolean
          result?: string | null
          review_action?: string | null
          score_delta?: number | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criterion_results_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["criterion_id"]
          },
          {
            foreignKeyName: "criterion_results_evaluation_run_id_fkey"
            columns: ["evaluation_run_id"]
            isOneToOne: false
            referencedRelation: "evaluation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      drift_metrics: {
        Row: {
          ai_model_version: string | null
          ai_vendor: string | null
          avg_trust_score: number | null
          created_at: string
          critical_failure_rate: number | null
          hallucination_rate: number | null
          id: string
          metric_date: string
          omission_rate: number | null
          organization_id: string | null
          sample_size: number | null
          site_id: string | null
          specialty: string | null
        }
        Insert: {
          ai_model_version?: string | null
          ai_vendor?: string | null
          avg_trust_score?: number | null
          created_at?: string
          critical_failure_rate?: number | null
          hallucination_rate?: number | null
          id?: string
          metric_date: string
          omission_rate?: number | null
          organization_id?: string | null
          sample_size?: number | null
          site_id?: string | null
          specialty?: string | null
        }
        Update: {
          ai_model_version?: string | null
          ai_vendor?: string | null
          avg_trust_score?: number | null
          created_at?: string
          critical_failure_rate?: number | null
          hallucination_rate?: number | null
          id?: string
          metric_date?: string
          omission_rate?: number | null
          organization_id?: string | null
          sample_size?: number | null
          site_id?: string | null
          specialty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drift_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_sources: {
        Row: {
          content: Json
          created_at: string
          encounter_id: string
          id: string
          metadata: Json | null
          source_type: string
        }
        Insert: {
          content: Json
          created_at?: string
          encounter_id: string
          id?: string
          metadata?: Json | null
          source_type: string
        }
        Update: {
          content?: Json
          created_at?: string
          encounter_id?: string
          id?: string
          metadata?: Json | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_sources_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          ai_model_version: string | null
          ai_vendor: string | null
          care_setting: string
          chief_complaint: string | null
          created_at: string
          encounter_date: string
          id: string
          organization_id: string | null
          patient_age_group: string | null
          patient_id: string | null
          patient_risk_flags: Json | null
          site_id: string | null
          specialty: string
          user_id: string
          visit_type: string | null
          workflow_metadata: Json | null
        }
        Insert: {
          ai_model_version?: string | null
          ai_vendor?: string | null
          care_setting: string
          chief_complaint?: string | null
          created_at?: string
          encounter_date?: string
          id?: string
          organization_id?: string | null
          patient_age_group?: string | null
          patient_id?: string | null
          patient_risk_flags?: Json | null
          site_id?: string | null
          specialty: string
          user_id: string
          visit_type?: string | null
          workflow_metadata?: Json | null
        }
        Update: {
          ai_model_version?: string | null
          ai_vendor?: string | null
          care_setting?: string
          chief_complaint?: string | null
          created_at?: string
          encounter_date?: string
          id?: string
          organization_id?: string | null
          patient_age_group?: string | null
          patient_id?: string | null
          patient_risk_flags?: Json | null
          site_id?: string | null
          specialty?: string
          user_id?: string
          visit_type?: string | null
          workflow_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "encounters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_runs: {
        Row: {
          artifact_id: string | null
          auto_escalated: boolean
          cognitive_biases: Json | null
          completed_at: string
          critical_failures: string[] | null
          differential_integrity_score: number | null
          encounter_id: string
          evaluator_confidence: number | null
          guideline_concordance_score: number | null
          guideline_matches: Json | null
          guideline_versions_used: Json
          id: string
          manifest_id: string | null
          medico_legal_exposure_score: number | null
          omission_hazard_score: number | null
          patient_safety_escalation_score: number | null
          reasoning_gaps: Json | null
          reasoning_quality: string | null
          reasoning_strengths: Json | null
          reasoning_summary: string | null
          red_flag_findings: Json | null
          reviewability_index: number | null
          source_faithfulness_index: number | null
          trust_score: number | null
          uncertainty_calibration_score: number | null
        }
        Insert: {
          artifact_id?: string | null
          auto_escalated?: boolean
          cognitive_biases?: Json | null
          completed_at?: string
          critical_failures?: string[] | null
          differential_integrity_score?: number | null
          encounter_id: string
          evaluator_confidence?: number | null
          guideline_concordance_score?: number | null
          guideline_matches?: Json | null
          guideline_versions_used?: Json
          id?: string
          manifest_id?: string | null
          medico_legal_exposure_score?: number | null
          omission_hazard_score?: number | null
          patient_safety_escalation_score?: number | null
          reasoning_gaps?: Json | null
          reasoning_quality?: string | null
          reasoning_strengths?: Json | null
          reasoning_summary?: string | null
          red_flag_findings?: Json | null
          reviewability_index?: number | null
          source_faithfulness_index?: number | null
          trust_score?: number | null
          uncertainty_calibration_score?: number | null
        }
        Update: {
          artifact_id?: string | null
          auto_escalated?: boolean
          cognitive_biases?: Json | null
          completed_at?: string
          critical_failures?: string[] | null
          differential_integrity_score?: number | null
          encounter_id?: string
          evaluator_confidence?: number | null
          guideline_concordance_score?: number | null
          guideline_matches?: Json | null
          guideline_versions_used?: Json
          id?: string
          manifest_id?: string | null
          medico_legal_exposure_score?: number | null
          omission_hazard_score?: number | null
          patient_safety_escalation_score?: number | null
          reasoning_gaps?: Json | null
          reasoning_quality?: string | null
          reasoning_strengths?: Json | null
          reasoning_summary?: string | null
          red_flag_findings?: Json | null
          reviewability_index?: number | null
          source_faithfulness_index?: number | null
          trust_score?: number | null
          uncertainty_calibration_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_runs_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "note_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_runs_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_runs_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "rubric_load_manifests"
            referencedColumns: ["id"]
          },
        ]
      }
      finding_feedback: {
        Row: {
          created_at: string
          evaluation_run_id: string
          explanation: string | null
          finding_key: string
          finding_type: string
          id: string
          reviewer_id: string
          updated_at: string
          verdict: string
        }
        Insert: {
          created_at?: string
          evaluation_run_id: string
          explanation?: string | null
          finding_key: string
          finding_type: string
          id?: string
          reviewer_id: string
          updated_at?: string
          verdict: string
        }
        Update: {
          created_at?: string
          evaluation_run_id?: string
          explanation?: string | null
          finding_key?: string
          finding_type?: string
          id?: string
          reviewer_id?: string
          updated_at?: string
          verdict?: string
        }
        Relationships: []
      }
      guideline_sources: {
        Row: {
          abbreviation: string | null
          active: boolean
          created_at: string
          id: string
          key_recommendations: Json | null
          name: string
          organization_id: string | null
          red_flag_criteria: Json | null
          source_type: string | null
          source_url: string | null
          specialty: string | null
        }
        Insert: {
          abbreviation?: string | null
          active?: boolean
          created_at?: string
          id?: string
          key_recommendations?: Json | null
          name: string
          organization_id?: string | null
          red_flag_criteria?: Json | null
          source_type?: string | null
          source_url?: string | null
          specialty?: string | null
        }
        Update: {
          abbreviation?: string | null
          active?: boolean
          created_at?: string
          id?: string
          key_recommendations?: Json | null
          name?: string
          organization_id?: string | null
          red_flag_criteria?: Json | null
          source_type?: string | null
          source_url?: string | null
          specialty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guideline_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guideline_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          effective_date: string | null
          id: string
          is_current: boolean
          retired_date: string | null
          source_id: string
          version_string: string
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          is_current?: boolean
          retired_date?: string | null
          source_id: string
          version_string: string
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          is_current?: boolean
          retired_date?: string | null
          source_id?: string
          version_string?: string
        }
        Relationships: [
          {
            foreignKeyName: "guideline_versions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "guideline_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      note_artifacts: {
        Row: {
          artifact_type: string
          content: Json
          created_at: string
          encounter_id: string
          generation_metadata: Json | null
          id: string
          raw_text: string | null
          status: string
        }
        Insert: {
          artifact_type: string
          content: Json
          created_at?: string
          encounter_id: string
          generation_metadata?: Json | null
          id?: string
          raw_text?: string | null
          status?: string
        }
        Update: {
          artifact_type?: string
          content?: Json
          created_at?: string
          encounter_id?: string
          generation_metadata?: Json | null
          id?: string
          raw_text?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_artifacts_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      note_sections: {
        Row: {
          artifact_id: string
          content: string
          created_at: string
          id: string
          section_order: number | null
          section_type: string
        }
        Insert: {
          artifact_id: string
          content: string
          created_at?: string
          id?: string
          section_order?: number | null
          section_type: string
        }
        Update: {
          artifact_id?: string
          content?: string
          created_at?: string
          id?: string
          section_order?: number | null
          section_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_sections_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "note_artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          compliance_settings: Json | null
          created_at: string
          guideline_profile: Json | null
          id: string
          jurisdiction: string | null
          name: string
          slug: string
          state_jurisdiction: string | null
        }
        Insert: {
          compliance_settings?: Json | null
          created_at?: string
          guideline_profile?: Json | null
          id?: string
          jurisdiction?: string | null
          name: string
          slug: string
          state_jurisdiction?: string | null
        }
        Update: {
          compliance_settings?: Json | null
          created_at?: string
          guideline_profile?: Json | null
          id?: string
          jurisdiction?: string | null
          name?: string
          slug?: string
          state_jurisdiction?: string | null
        }
        Relationships: []
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
      reviewer_assignments: {
        Row: {
          artifact_id: string | null
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          encounter_id: string
          id: string
          priority: string | null
          reviewer_id: string
          status: string
        }
        Insert: {
          artifact_id?: string | null
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          encounter_id: string
          id?: string
          priority?: string | null
          reviewer_id: string
          status?: string
        }
        Update: {
          artifact_id?: string | null
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          encounter_id?: string
          id?: string
          priority?: string | null
          reviewer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_assignments_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "note_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_assignments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_events: {
        Row: {
          action_taken: string | null
          affected_claims: Json | null
          created_at: string
          description: string | null
          encounter_id: string | null
          evaluation_run_id: string | null
          event_type: string
          id: string
          resolved: boolean
          severity: string
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          affected_claims?: Json | null
          created_at?: string
          description?: string | null
          encounter_id?: string | null
          evaluation_run_id?: string | null
          event_type: string
          id?: string
          resolved?: boolean
          severity: string
          user_id: string
        }
        Update: {
          action_taken?: string | null
          affected_claims?: Json | null
          created_at?: string
          description?: string | null
          encounter_id?: string | null
          evaluation_run_id?: string | null
          event_type?: string
          id?: string
          resolved?: boolean
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_events_evaluation_run_id_fkey"
            columns: ["evaluation_run_id"]
            isOneToOne: false
            referencedRelation: "evaluation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_criteria: {
        Row: {
          artifact_types: string[] | null
          calibration_matrix: Json | null
          calibration_status: string
          clinician_agreement_rate: number | null
          created_at: string
          criterion_id: string
          critical_failure_possible: boolean
          domain_id: string | null
          effective_date: string | null
          evidence_requirements: Json | null
          explainability_template: string | null
          id: string
          last_calibrated_at: string | null
          last_calibrated_by: string | null
          name: string
          review_action: Json | null
          scoring: Json | null
          sensitivity: number | null
          severity_level: string | null
          specialty_modules: string[] | null
          specificity: number | null
          trigger_logic: Json | null
          version: string | null
        }
        Insert: {
          artifact_types?: string[] | null
          calibration_matrix?: Json | null
          calibration_status?: string
          clinician_agreement_rate?: number | null
          created_at?: string
          criterion_id: string
          critical_failure_possible?: boolean
          domain_id?: string | null
          effective_date?: string | null
          evidence_requirements?: Json | null
          explainability_template?: string | null
          id?: string
          last_calibrated_at?: string | null
          last_calibrated_by?: string | null
          name: string
          review_action?: Json | null
          scoring?: Json | null
          sensitivity?: number | null
          severity_level?: string | null
          specialty_modules?: string[] | null
          specificity?: number | null
          trigger_logic?: Json | null
          version?: string | null
        }
        Update: {
          artifact_types?: string[] | null
          calibration_matrix?: Json | null
          calibration_status?: string
          clinician_agreement_rate?: number | null
          created_at?: string
          criterion_id?: string
          critical_failure_possible?: boolean
          domain_id?: string | null
          effective_date?: string | null
          evidence_requirements?: Json | null
          explainability_template?: string | null
          id?: string
          last_calibrated_at?: string | null
          last_calibrated_by?: string | null
          name?: string
          review_action?: Json | null
          scoring?: Json | null
          sensitivity?: number | null
          severity_level?: string | null
          specialty_modules?: string[] | null
          specificity?: number | null
          trigger_logic?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "rubric_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_domains: {
        Row: {
          core_question: string | null
          created_at: string
          display_order: number | null
          domain_code: string
          id: string
          main_failure_type: string | null
          name: string
        }
        Insert: {
          core_question?: string | null
          created_at?: string
          display_order?: number | null
          domain_code: string
          id?: string
          main_failure_type?: string | null
          name: string
        }
        Update: {
          core_question?: string | null
          created_at?: string
          display_order?: number | null
          domain_code?: string
          id?: string
          main_failure_type?: string | null
          name?: string
        }
        Relationships: []
      }
      rubric_load_manifests: {
        Row: {
          assembled_at: string
          encounter_id: string
          excluded_modules: Json | null
          guideline_versions: Json | null
          id: string
          loaded_modules: string[] | null
          loaded_modules_detail: Json
        }
        Insert: {
          assembled_at?: string
          encounter_id: string
          excluded_modules?: Json | null
          guideline_versions?: Json | null
          id?: string
          loaded_modules?: string[] | null
          loaded_modules_detail?: Json
        }
        Update: {
          assembled_at?: string
          encounter_id?: string
          excluded_modules?: Json | null
          guideline_versions?: Json | null
          id?: string
          loaded_modules?: string[] | null
          loaded_modules_detail?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rubric_load_manifests_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          guideline_overrides: Json | null
          id: string
          local_policy: Json | null
          name: string
          organization_id: string
          site_type: string
          specialty_config: Json | null
        }
        Insert: {
          created_at?: string
          guideline_overrides?: Json | null
          id?: string
          local_policy?: Json | null
          name: string
          organization_id: string
          site_type: string
          specialty_config?: Json | null
        }
        Update: {
          created_at?: string
          guideline_overrides?: Json | null
          id?: string
          local_policy?: Json | null
          name?: string
          organization_id?: string
          site_type?: string
          specialty_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      source_spans: {
        Row: {
          created_at: string
          encounter_id: string
          end_time: string | null
          id: string
          source_id: string
          span_tags: Json | null
          speaker: string | null
          start_time: string | null
          text_content: string
        }
        Insert: {
          created_at?: string
          encounter_id: string
          end_time?: string | null
          id?: string
          source_id: string
          span_tags?: Json | null
          speaker?: string | null
          start_time?: string | null
          text_content: string
        }
        Update: {
          created_at?: string
          encounter_id?: string
          end_time?: string | null
          id?: string
          source_id?: string
          span_tags?: Json | null
          speaker?: string | null
          start_time?: string | null
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_spans_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_spans_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "encounter_sources"
            referencedColumns: ["id"]
          },
        ]
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
      vellum_users: {
        Row: {
          created_at: string
          credentials: string | null
          display_name: string | null
          email: string | null
          id: string
          invited_by: string | null
          invited_email: string | null
          organization_id: string | null
          removed_at: string | null
          site_id: string | null
          specialty: string | null
          status: string
          user_id: string | null
          vellum_role: string
        }
        Insert: {
          created_at?: string
          credentials?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          organization_id?: string | null
          removed_at?: string | null
          site_id?: string | null
          specialty?: string | null
          status?: string
          user_id?: string | null
          vellum_role?: string
        }
        Update: {
          created_at?: string
          credentials?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          organization_id?: string | null
          removed_at?: string | null
          site_id?: string | null
          specialty?: string | null
          status?: string
          user_id?: string | null
          vellum_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "vellum_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vellum_users_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      finding_feedback_stats: {
        Row: {
          confirmed_count: number | null
          false_positive_rate: number | null
          finding_type: string | null
          partial_count: number | null
          rejected_count: number | null
          total_feedback: number | null
        }
        Relationships: []
      }
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
      severity_level: ["critical", "important", "minor", "info"],
    },
  },
} as const
