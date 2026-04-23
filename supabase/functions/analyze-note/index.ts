// Edge function: analyze a single clinical note for reasoning,
// red flags, biases, pattern matches, gold standard, and scoring.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a senior physician conducting a hospital QA safety audit on an AI-generated clinical note.
You write like an attending reviewing a resident's chart, not like a generic AI critic.
Your output must be high-signal, low-noise, and immediately actionable.

CORE OUTPUT EXPECTATIONS
1. CLINICAL REASONING ANALYSIS - Assess differential breadth, justification of the leading diagnosis,
   alternatives explicitly considered/excluded, and whether reasoning matches the presented data.
2. RED FLAG CHECKLIST - Identify the scenario-appropriate checklist (SNOOP for headache, HEART for
   chest pain, qSOFA/SIRS for infection, NAEPP for asthma, FAST for stroke, etc.). For every item,
   set status to present, missing, or not_applicable, with brief evidence from the note.
3. SURFACED RED FLAGS - Only surface red flags that are clinically relevant to THIS patient.
   Strict suppression rules:
     - Suppress age-conditional flags when the patient is clearly outside the at-risk band
       (e.g. do NOT surface "new headache > 50" if the documented patient is < 50).
     - Suppress sex/pregnancy/comorbidity-conditional flags when the underlying condition is
       clearly absent.
     - If a flag is borderline relevant, you MAY surface it but mark severity as minor or info.
   Internal checklist tracking still happens, but the surfaced red_flags array must be
   precision-filtered.
4. COGNITIVE BIAS DETECTION - Premature closure, anchoring, availability, attribution. Cite
   direct evidence from the note. Do not invent biases.
5. PATTERN RECOGNITION - Name the clinical pattern and list expected vs missing elements.
6. GOLD STANDARD - What a best-practice note for THIS specific presentation should include.
7. RISK IMPACT - Concrete, case-specific risks (missed diagnosis, delayed escalation,
   inappropriate reassurance).
8. GUIDELINE CROSS-REFERENCE - For every provided guideline, set alignment, then for each
   recommended element list whether it is aligned or missing AND include a short evidence
   snippet:
     - aligned elements: include the exact (or near-exact) quote/paraphrase from the note
       that satisfies the recommendation in note_evidence.
     - missing elements: include the exact guideline phrase or expected action that is absent
       in guideline_evidence, so a reviewer can see WHY it was marked missing.
9. ISSUES - Categorized as: red_flag, reasoning, diagnostic_safety, documentation, guideline,
   communication. See SEVERITY CALIBRATION below. Each issue must include a "next_best_step"
   that is a concrete clinical action a clinician can take immediately (more actionable than
   "suggested_fix"). Group issues by root cause when possible (see CONSOLIDATION).

SEVERITY CALIBRATION (STRICT)
- critical: Reserved for IMMEDIATE risk of missed serious diagnosis, an unsafe clinical
  decision (e.g. premature closure with no rule-out of a dangerous mimic), or a missing
  essential safety screening (e.g. SNOOP in a true new headache).
  HARD CAP: at most 2 critical issues per case unless multiple INDEPENDENT life-threatening
  risks genuinely exist. If you would emit more, downgrade the less severe ones to important.
- important: Incomplete reasoning, missing secondary considerations, follow-up gaps,
  medication safety issues that are not immediately life-threatening.
- minor: Documentation clarity, terminology, formatting.
- info: Stylistic or contextual notes only.

CONSOLIDATION
- If multiple issues stem from one root cause (e.g. missing SNOOP + premature closure +
  no differential, all flowing from "failure to evaluate new persistent headache"), emit
  ONE primary issue and put the supporting failures in subpoints.
- Order issues by severity, then by clinical impact.

LANGUAGE PRECISION
- Use clinical-audit phrasing, not generic AI critique. Examples:
  "Failure to assess..." instead of "No documentation of...".
  "Increases risk of..." instead of "Could lead to issues".
  "Not evaluated" or "Not addressed" instead of bare "Missing".
- Quote evidence from the note when calling out gaps.

SCORING (0-100)
- safety, completeness, accuracy, reasoning, overall_trust (weighted: safety 35%,
  reasoning 30%, accuracy 20%, completeness 15%).
- Do NOT inflate. Missing red flag screening drops safety. Weak differential drops
  completeness AND accuracy. Cognitive bias drops reasoning.
- For EACH score, return a one-line score_rationale explaining the deduction in plain
  clinical language (e.g. "Reduced due to premature closure and absent differential").
- For SAFETY, REASONING, and OVERALL_TRUST, also return score_evidence: an array of
  short verbatim quotes from the clinical note (or the explicit absence of an
  expected element) that drove the deduction. Each entry should include the
  short note quote (or "(not documented in note)" when the deduction is for an
  absence) and a one-line clinician-facing reason for why it lowered the score.

SUPPRESSED RED FLAGS
- For every red flag you internally considered but did NOT surface (because the
  patient is outside the at-risk band, or the underlying condition is clearly
  absent), add an entry to suppressed_red_flags with:
    label: the red flag name
    reason: a brief clinician-facing explanation citing the note (e.g.
      "Patient is 28; age-conditional flag '>50' does not apply.")
- This keeps the surfaced red_flags list precise while still showing the
  reviewer that the screen was considered.

EXECUTIVE SUMMARY
Return executive_summary with:
- top_clinical_risk: one tight sentence.
- headline_action: the single most important next clinical action.
- critical_count, important_count.
- one_liner: a 10-second case verdict for a busy reviewer.

Be precise. Be specific. Sound like a senior clinician.`;

function buildUserPrompt(note: string, specialty: string | null, chiefComplaint: string | null, guidelines: any[]) {
  const guidelinesBlock =
    guidelines.length === 0
      ? "(No matching guidelines in library.)"
      : guidelines
          .map(
            (g, i) =>
              `[${i + 1}] ${g.name} — ${g.organization} (${g.specialty})
Summary: ${g.summary}
Recommendations:
${g.recommendations}
Red flags: ${g.red_flags ?? "n/a"}
Citation: ${g.citation ?? "n/a"}`,
          )
          .join("\n\n");

  return `## Context
Chief complaint (if provided): ${chiefComplaint ?? "not provided"}
Specialty (if provided): ${specialty ?? "not provided"}

## Clinical Guidelines from QA library to cross-reference
${guidelinesBlock}

## Clinical note to audit
"""
${note}
"""

Return your full structured assessment via the submit_clinical_audit tool.`;
}

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "submit_clinical_audit",
    description: "Submit the structured clinical reasoning audit.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        top_clinical_risk: { type: "string" },
        recognized_pattern: { type: "string" },
        reasoning_rating: { type: "string", enum: ["Strong", "Adequate", "Weak"] },
        scores: {
          type: "object",
          properties: {
            safety: { type: "number" },
            completeness: { type: "number" },
            accuracy: { type: "number" },
            reasoning: { type: "number" },
            overall_trust: { type: "number" },
          },
          required: ["safety", "completeness", "accuracy", "reasoning", "overall_trust"],
          additionalProperties: false,
        },
        score_rationales: {
          type: "object",
          properties: {
            safety: { type: "string" },
            completeness: { type: "string" },
            accuracy: { type: "string" },
            reasoning: { type: "string" },
            overall_trust: { type: "string" },
          },
          required: ["safety", "completeness", "accuracy", "reasoning", "overall_trust"],
          additionalProperties: false,
        },
        score_evidence: {
          type: "object",
          properties: {
            safety: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  quote: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["quote", "reason"],
                additionalProperties: false,
              },
            },
            reasoning: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  quote: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["quote", "reason"],
                additionalProperties: false,
              },
            },
            overall_trust: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  quote: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["quote", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["safety", "reasoning", "overall_trust"],
          additionalProperties: false,
        },
        suppressed_red_flags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              reason: { type: "string" },
            },
            required: ["label", "reason"],
            additionalProperties: false,
          },
        },
        executive_summary: {
          type: "object",
          properties: {
            top_clinical_risk: { type: "string" },
            headline_action: { type: "string" },
            one_liner: { type: "string" },
            critical_count: { type: "number" },
            important_count: { type: "number" },
          },
          required: ["top_clinical_risk", "headline_action", "one_liner", "critical_count", "important_count"],
          additionalProperties: false,
        },
        clinical_reasoning: {
          type: "object",
          properties: {
            summary: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            gaps: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "strengths", "gaps"],
          additionalProperties: false,
        },
        red_flags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              severity: { type: "string", enum: ["critical", "important", "minor", "info"] },
              why_matters: { type: "string" },
              suggested_addition: { type: "string" },
            },
            required: ["label", "severity", "why_matters", "suggested_addition"],
            additionalProperties: false,
          },
        },
        red_flag_checklist: {
          type: "object",
          properties: {
            scenario: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  status: { type: "string", enum: ["present", "missing", "not_applicable"] },
                  evidence: { type: "string" },
                },
                required: ["item", "status", "evidence"],
                additionalProperties: false,
              },
            },
          },
          required: ["scenario", "items"],
          additionalProperties: false,
        },
        cognitive_biases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              bias: { type: "string" },
              evidence: { type: "string" },
              why_matters: { type: "string" },
              suggested_fix: { type: "string" },
            },
            required: ["bias", "evidence", "why_matters", "suggested_fix"],
            additionalProperties: false,
          },
        },
        pattern_matches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pattern: { type: "string" },
              expected: { type: "array", items: { type: "string" } },
              missing: { type: "array", items: { type: "string" } },
            },
            required: ["pattern", "expected", "missing"],
            additionalProperties: false,
          },
        },
        gold_standard: {
          type: "object",
          properties: {
            expected_elements: { type: "array", items: { type: "string" } },
            present: { type: "array", items: { type: "string" } },
            missing: { type: "array", items: { type: "string" } },
          },
          required: ["expected_elements", "present", "missing"],
          additionalProperties: false,
        },
        risk_impact: {
          type: "object",
          properties: {
            missed_diagnosis_risk: { type: "string" },
            delayed_escalation_risk: { type: "string" },
            inappropriate_reassurance_risk: { type: "string" },
          },
          required: [
            "missed_diagnosis_risk",
            "delayed_escalation_risk",
            "inappropriate_reassurance_risk",
          ],
          additionalProperties: false,
        },
        guideline_references: {
          type: "array",
          items: {
            type: "object",
            properties: {
              guideline_id: { type: "string" },
              name: { type: "string" },
              organization: { type: "string" },
              alignment: { type: "string", enum: ["aligned", "partial", "missing", "not_applicable"] },
              notes: { type: "string" },
              aligned_elements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    element: { type: "string" },
                    note_evidence: { type: "string" },
                  },
                  required: ["element", "note_evidence"],
                  additionalProperties: false,
                },
              },
              missing_elements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    element: { type: "string" },
                    guideline_evidence: { type: "string" },
                  },
                  required: ["element", "guideline_evidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["guideline_id", "name", "organization", "alignment", "notes", "aligned_elements", "missing_elements"],
            additionalProperties: false,
          },
        },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: [
                  "red_flag",
                  "reasoning",
                  "diagnostic_safety",
                  "documentation",
                  "guideline",
                  "communication",
                ],
              },
              severity: { type: "string", enum: ["critical", "important", "minor", "info"] },
              description: { type: "string" },
              suggested_fix: { type: "string" },
              next_best_step: { type: "string" },
              root_cause: { type: "string" },
              subpoints: { type: "array", items: { type: "string" } },
            },
            required: ["category", "severity", "description", "suggested_fix", "next_best_step"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "top_clinical_risk",
        "recognized_pattern",
        "reasoning_rating",
        "scores",
        "score_rationales",
        "score_evidence",
        "suppressed_red_flags",
        "executive_summary",
        "clinical_reasoning",
        "red_flags",
        "red_flag_checklist",
        "cognitive_biases",
        "pattern_matches",
        "gold_standard",
        "risk_impact",
        "guideline_references",
        "issues",
      ],
    },
  },
};

export async function runAnalysis(opts: {
  noteText: string;
  specialty?: string | null;
  chiefComplaint?: string | null;
  guidelines: any[];
  apiKey: string;
  model?: string;
}) {
  const model = opts.model ?? "google/gemini-2.5-flash";
  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserPrompt(opts.noteText, opts.specialty ?? null, opts.chiefComplaint ?? null, opts.guidelines),
      },
    ],
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "function", function: { name: "submit_clinical_audit" } },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    const err: any = new Error(`AI gateway ${resp.status}: ${txt}`);
    err.status = resp.status;
    throw err;
  }

  const json = await resp.json();
  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("AI returned no structured audit output");
  }
  const parsed = JSON.parse(toolCall.function.arguments);
  return { parsed, model, raw: json };
}

function pickRelevantGuidelines(noteText: string, all: any[]) {
  const lower = noteText.toLowerCase();
  const matched = all.filter((g) =>
    (g.condition_keywords ?? []).some((kw: string) => lower.includes(kw.toLowerCase())),
  );
  // Always include at least 3 (or all) to give the model context
  if (matched.length >= 3) return matched.slice(0, 6);
  const extras = all.filter((g) => !matched.includes(g)).slice(0, 3 - matched.length);
  return [...matched, ...extras];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const { noteText, patientLabel, chiefComplaint, specialty, aiSourceId } =
      await req.json();

    if (!noteText || typeof noteText !== "string" || noteText.trim().length < 20) {
      return new Response(JSON.stringify({ error: "noteText must be at least 20 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch guideline library
    const { data: guidelines } = await supabase
      .from("clinical_guidelines")
      .select("id, name, organization, specialty, condition_keywords, summary, recommendations, red_flags, citation")
      .eq("active", true);

    const relevant = pickRelevantGuidelines(noteText, guidelines ?? []);

    let parsed: any;
    let model: string;
    let raw: any;
    try {
      const result = await runAnalysis({
        noteText,
        specialty,
        chiefComplaint,
        guidelines: relevant,
        apiKey: lovableKey,
      });
      parsed = result.parsed;
      model = result.model;
      raw = result.raw;
    } catch (e: any) {
      if (e.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    // Insert clinical note
    const { data: noteRow, error: noteErr } = await supabase
      .from("clinical_notes")
      .insert({
        user_id: user.id,
        ai_source_id: aiSourceId ?? null,
        patient_label: patientLabel ?? null,
        chief_complaint: chiefComplaint ?? null,
        specialty: specialty ?? null,
        note_text: noteText,
      })
      .select()
      .single();
    if (noteErr) throw noteErr;

    // Insert analysis
    const { data: analysisRow, error: analysisErr } = await supabase
      .from("note_analyses")
      .insert({
        note_id: noteRow.id,
        user_id: user.id,
        ai_source_id: aiSourceId ?? null,
        top_clinical_risk: parsed.top_clinical_risk,
        overall_trust_score: parsed.scores.overall_trust,
        reasoning_rating: parsed.reasoning_rating,
        recognized_pattern: parsed.recognized_pattern,
        safety_score: parsed.scores.safety,
        completeness_score: parsed.scores.completeness,
        accuracy_score: parsed.scores.accuracy,
        reasoning_score: parsed.scores.reasoning,
        clinical_reasoning: parsed.clinical_reasoning,
        red_flags: parsed.red_flags,
        cognitive_biases: parsed.cognitive_biases,
        issues: parsed.issues,
        pattern_matches: parsed.pattern_matches,
        gold_standard: parsed.gold_standard,
        risk_impact: parsed.risk_impact,
        guideline_references: parsed.guideline_references,
        model_used: model,
        raw_response: raw,
      })
      .select()
      .single();
    if (analysisErr) throw analysisErr;

    // Enrich the response with fields not stored in dedicated columns
    // (red_flag_checklist; richer aligned/missing guideline elements;
    //  executive summary, score rationales, next_best_step on issues)
    const enrichedAnalysis = {
      ...analysisRow,
      red_flag_checklist: parsed.red_flag_checklist ?? null,
      guideline_references: parsed.guideline_references ?? analysisRow.guideline_references,
      executive_summary: parsed.executive_summary ?? null,
      score_rationales: parsed.score_rationales ?? null,
      issues: parsed.issues ?? analysisRow.issues,
    };

    return new Response(
      JSON.stringify({ note: noteRow, analysis: enrichedAnalysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("analyze-note error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});