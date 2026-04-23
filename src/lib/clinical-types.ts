// Shared types for the clinical QA app, mirrored from the analyze-note edge function.

export type Severity = "critical" | "important" | "minor" | "info";
export type ReasoningRating = "Strong" | "Adequate" | "Weak";
export type IssueCategory =
  | "red_flag"
  | "reasoning"
  | "diagnostic_safety"
  | "documentation"
  | "guideline"
  | "communication";
export type GuidelineAlignment = "aligned" | "partial" | "missing" | "not_applicable";

export interface ClinicalReasoning {
  summary: string;
  strengths: string[];
  gaps: string[];
}

export interface RedFlagFinding {
  label: string;
  severity: Severity;
  why_matters: string;
  suggested_addition: string;
}

export interface BiasFinding {
  bias: string;
  evidence: string;
  why_matters: string;
  suggested_fix: string;
}

export interface PatternMatch {
  pattern: string;
  expected: string[];
  missing: string[];
}

export interface GoldStandard {
  expected_elements: string[];
  present: string[];
  missing: string[];
}

export interface RiskImpact {
  missed_diagnosis_risk: string;
  delayed_escalation_risk: string;
  inappropriate_reassurance_risk: string;
}

export interface GuidelineReference {
  guideline_id: string;
  name: string;
  organization: string;
  alignment: GuidelineAlignment;
  notes: string;
}

export interface IssueFinding {
  category: IssueCategory;
  severity: Severity;
  description: string;
  suggested_fix: string;
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  important: "Important",
  minor: "Minor",
  info: "Info",
};

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  red_flag: "Red Flag",
  reasoning: "Reasoning",
  diagnostic_safety: "Diagnostic Safety",
  documentation: "Documentation",
  guideline: "Guideline",
  communication: "Communication",
};

export const ALIGNMENT_LABELS: Record<GuidelineAlignment, string> = {
  aligned: "Aligned",
  partial: "Partial",
  missing: "Missing",
  not_applicable: "N/A",
};

export const SAMPLE_HEADACHE_NOTE = `28 y/o female presents with 3 weeks of daily, bilateral, pressure-type headaches.
Reports daily ibuprofen use. No nausea, vomiting, photophobia. No fever.
Physical exam unremarkable.

Assessment: Tension-type headache.
Plan: Continue ibuprofen as needed. Stress reduction. Follow up if not improving.`;