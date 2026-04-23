// Edge function: analyze a single clinical note for reasoning,
// red flags, biases, pattern matches, gold standard, and scoring.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a clinical reasoning auditor and patient safety reviewer.
You evaluate AI-generated clinical notes for hospital QA teams. You go beyond documentation
quality and rigorously assess whether the clinical THINKING is safe and complete.

You produce structured findings covering:
1. CLINICAL REASONING ANALYSIS — differential breadth, justification of leading diagnosis,
   alternatives considered, whether reasoning matches presented data.
2. RED FLAG CHECKLIST — first identify the appropriate scenario-specific checklist
   (e.g. SNOOP for headache, HEART for chest pain, qSOFA/SIRS for infection, NAEPP
   severity for asthma, ACS chest-pain ROS, stroke FAST, etc.). For each checklist
   item, report whether it was screened/documented in the note (status = present),
   not screened (status = missing), or not applicable (status = not_applicable). Then
   surface the missing items as red_flags with severity grading.
3. COGNITIVE BIAS DETECTION — premature closure, anchoring, availability, attribution.
   Cite evidence from the note.
4. PATTERN RECOGNITION — recognize the clinical pattern (e.g. "new persistent headache",
   "undifferentiated chest pain", "infection symptoms", "daily analgesic use") and flag
   missing expected elements for that pattern.
5. GOLD STANDARD — what a best-practice note for THIS specific presentation should include.
6. RISK IMPACT — concrete clinical risks (missed diagnosis, delayed escalation,
   inappropriate reassurance) tied to the actual case.
7. GUIDELINE CROSS-REFERENCE — for every provided guideline, indicate whether it
   applies, then list the specific recommended elements that ARE present in the note
   (aligned_elements) and the specific recommended elements that are MISSING from the
   note (missing_elements). Use direct quotes or paraphrases of guideline language.
8. ISSUES — categorized as: red_flag, reasoning, diagnostic_safety, documentation,
   guideline, communication. Severity = critical, important, minor, info. Missing red
   flag screening is CRITICAL when relevant.
9. SCORING (0-100): safety, completeness, accuracy, reasoning. Overall trust score is
   the weighted mean (safety 35%, reasoning 30%, accuracy 20%, completeness 15%).
   Do NOT inflate scores when reasoning is incomplete. Missing red flag screening
   significantly lowers safety. Weak differential lowers completeness AND accuracy.
   Cognitive bias lowers reasoning.
10. TOP CLINICAL RISK — single most important takeaway for the reviewer (e.g.
    "Potential missed secondary headache due to lack of red flag screening").

Be precise. Be specific. Quote evidence from the note. Use clinical language a
physician would trust.`;

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
              aligned_elements: { type: "array", items: { type: "string" } },
              missing_elements: { type: "array", items: { type: "string" } },
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
            },
            required: ["category", "severity", "description", "suggested_fix"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "top_clinical_risk",
        "recognized_pattern",
        "reasoning_rating",
        "scores",
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

    return new Response(
      JSON.stringify({ note: noteRow, analysis: analysisRow }),
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