// Vellum — multi-agent evaluation pipeline
// Stages: 1) extract claims  2) score against rubric criteria  3) compute sub-scores
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODEL = "google/gemini-2.5-pro";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Json = Record<string, unknown>;

async function callGateway(body: Json, apiKey: string) {
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (r.status === 429)
    throw new Response(
      JSON.stringify({ error: "Rate limit. Try again in a moment." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  if (r.status === 402)
    throw new Response(
      JSON.stringify({ error: "Lovable AI credits exhausted." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  if (!r.ok) {
    const t = await r.text();
    console.error("AI gateway error", r.status, t);
    throw new Error("AI gateway error");
  }
  return r.json();
}

function toolArgs(resp: any) {
  const call = resp?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("No tool call in AI response");
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    throw new Error("Invalid JSON in tool call");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const correlationId = crypto.randomUUID();

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const body = await req.json().catch(() => ({}));
    const encounterId = String(body.encounter_id ?? "");
    if (!UUID_RE.test(encounterId))
      return new Response(JSON.stringify({ error: "Invalid encounter_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // Load encounter, sources, artifact
    const { data: encounter, error: encErr } = await admin
      .from("encounters")
      .select("*")
      .eq("id", encounterId)
      .maybeSingle();
    if (encErr || !encounter) throw new Error("Encounter not found");
    if (encounter.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sources } = await admin
      .from("encounter_sources")
      .select("*")
      .eq("encounter_id", encounterId);

    const { data: artifact } = await admin
      .from("note_artifacts")
      .select("*")
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!artifact) throw new Error("No note artifact for encounter");

    const noteText = (artifact.raw_text ?? "").slice(0, 24000);
    const sourceText = (sources ?? [])
      .map(
        (s: any) =>
          `[${s.source_type}]\n${
            typeof s.content === "string"
              ? s.content
              : (s.content?.text ?? JSON.stringify(s.content))
          }`,
      )
      .join("\n\n")
      .slice(0, 24000);

    // Load applicable criteria
    const { data: criteria } = await admin
      .from("rubric_criteria")
      .select("criterion_id,name,severity_level,critical_failure_possible,specialty_modules,artifact_types,explainability_template")
      .limit(60);

    const filteredCriteria = (criteria ?? []).filter((c: any) => {
      const okSpec =
        !c.specialty_modules?.length ||
        c.specialty_modules.includes(encounter.specialty) ||
        c.specialty_modules.includes("all");
      return okSpec;
    });

    // ---- Stage 1: Claim extraction ----
    const claimSchema = {
      type: "object",
      properties: {
        claims: {
          type: "array",
          items: {
            type: "object",
            properties: {
              claim_text: { type: "string" },
              claim_type: {
                type: "string",
                enum: ["history", "exam", "assessment", "plan", "medication", "vital", "lab", "diagnosis", "other"],
              },
              status: {
                type: "string",
                enum: ["supported", "unsupported", "contradicted", "uncertain"],
              },
              evidence_quote: { type: "string" },
              risk_weight: { type: "number" },
            },
            required: ["claim_text", "claim_type", "status", "risk_weight"],
          },
        },
      },
      required: ["claims"],
    };

    const claimResp = await callGateway(
      {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Vellum's claim extractor. Extract atomic clinical claims from the AI-generated note and verify each against the source evidence. A claim is 'supported' if a quote from the source attests to it; 'unsupported' if no source mentions it; 'contradicted' if the source contradicts it; 'uncertain' if partial. Risk weight 0.1–1.0 (medication errors, missed red flags = high).",
          },
          {
            role: "user",
            content: `SPECIALTY: ${encounter.specialty}\nVISIT: ${encounter.visit_type ?? "n/a"}\nCHIEF COMPLAINT: ${encounter.chief_complaint ?? "n/a"}\n\n=== SOURCE EVIDENCE ===\n${sourceText || "(no structured source provided)"}\n\n=== AI-GENERATED NOTE ===\n${noteText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_claims",
              description: "Report extracted clinical claims",
              parameters: claimSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_claims" } },
      },
      apiKey,
    );
    const claimsOut = toolArgs(claimResp).claims as any[];

    // ---- Stage 2: Rubric scoring ----
    const critList = filteredCriteria
      .map(
        (c: any) =>
          `- ${c.criterion_id} | ${c.name} | severity=${c.severity_level ?? "?"}${c.critical_failure_possible ? " | CRITICAL_POSSIBLE" : ""}`,
      )
      .join("\n");

    const scoreSchema = {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              criterion_id: { type: "string" },
              applicability: {
                type: "string",
                enum: ["applicable", "not_applicable", "insufficient_data"],
              },
              result: { type: "string", enum: ["pass", "concern", "fail", "critical_fail"] },
              severity: { type: "string", enum: ["S1", "S2", "S3", "S4", "S5"] },
              confidence: { type: "number" },
              explanation: { type: "string" },
              evidence_quote: { type: "string" },
              score_delta: { type: "number" },
              requires_human_adjudication: { type: "boolean" },
            },
            required: ["criterion_id", "applicability", "result", "severity", "confidence", "explanation"],
          },
        },
        sub_scores: {
          type: "object",
          properties: {
            source_faithfulness_index: { type: "number" },
            differential_integrity_score: { type: "number" },
            guideline_concordance_score: { type: "number" },
            omission_hazard_score: { type: "number" },
            patient_safety_escalation_score: { type: "number" },
            uncertainty_calibration_score: { type: "number" },
            medico_legal_exposure_score: { type: "number" },
            reviewability_index: { type: "number" },
            evaluator_confidence: { type: "number" },
            trust_score: { type: "number" },
          },
          required: ["trust_score"],
        },
        critical_failures: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["results", "sub_scores", "critical_failures"],
    };

    const scoreResp = await callGateway(
      {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Vellum's rubric scorer. For each criterion, mark applicable/not_applicable/insufficient_data, then result (pass/concern/fail/critical_fail), severity (S1 low → S5 critical/never-event), confidence 0–1, an explanation citing evidence, an evidence quote from the note or source, and a score_delta (negative integer for failures, 0 for pass). Then compute the 9 sub-scores and an overall trust_score (0–100). Be strict: hallucinated medications, missed red flags, omitted allergies → critical_fail / S5.",
          },
          {
            role: "user",
            content: `SPECIALTY: ${encounter.specialty}\n\nCRITERIA:\n${critList}\n\nCLAIMS:\n${JSON.stringify(claimsOut).slice(0, 8000)}\n\nNOTE:\n${noteText}\n\nSOURCE:\n${sourceText.slice(0, 6000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_evaluation",
              description: "Report rubric evaluation",
              parameters: scoreSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_evaluation" } },
      },
      apiKey,
    );
    const evalOut = toolArgs(scoreResp);

    // ---- Stage 3: Clinical reasoning + guideline-aware QA + red flags + bias ----
    // Resolve which guideline VERSIONS to evaluate against.
    // Default: each source's `is_current` version. Override: caller passes
    // { guideline_version_ids: [...] } to re-run an audit against a historical set.
    const requestedVersionIds: string[] = Array.isArray(body.guideline_version_ids)
      ? body.guideline_version_ids.filter((v: any) => UUID_RE.test(String(v)))
      : [];

    // Pull every active guideline, then narrow by BOTH specialty and chief
    // complaint. A chest-pain ED encounter must trigger the cardiology chest
    // pain pathway even though the encounter specialty is emergency_medicine,
    // and a headache encounter must NOT load sepsis/chest-pain rules.
    const { data: allSourcesRaw } = await admin
      .from("guideline_sources")
      .select("id,name,abbreviation,specialty,key_recommendations,red_flag_criteria")
      .eq("active", true);

    // Lightweight chief-complaint → topic keyword router. Each topic lists
    // the substrings (against guideline name/abbrev/recommendations) that
    // make a guideline relevant. Anything not matched is excluded so the
    // rubric load manifest stays scoped to this encounter.
    const cc = (encounter.chief_complaint ?? "").toLowerCase();
    const topicMatchers: { test: RegExp; needles: RegExp }[] = [
      { test: /chest pain|angina|acs|stemi|nstemi|cardiac/, needles: /chest pain|acs|cardiac|aha|acc|cp/i },
      { test: /headache|migraine|thunderclap/, needles: /headache|snoop|sah|migraine/i },
      { test: /fever|sepsis|infection/, needles: /sepsis|febrile|neutropenia|infection/i },
      { test: /infant|pediatric|neonate|febrile baby/, needles: /pediatric|infant|aap/i },
      { test: /diabetes|hyperglycem|dka|a1c/, needles: /ada|diabetes/i },
      { test: /suicid|self harm|depression|psychiatric/, needles: /suicide|psychiatric|apa/i },
      { test: /cancer|chemo|oncolog|neutropen/, needles: /oncology|nccn|neutropenia/i },
    ];
    const matchedTopics = topicMatchers.filter((t) => t.test.test(cc));
    const allSources = (allSourcesRaw ?? []).filter((g: any) => {
      const sameSpecialty = g.specialty === encounter.specialty || !g.specialty;
      if (!matchedTopics.length) {
        // No CC keywords matched — fall back to specialty-only filtering.
        return sameSpecialty;
      }
      const hay = `${g.name ?? ""} ${g.abbreviation ?? ""} ${JSON.stringify(g.key_recommendations ?? [])} ${JSON.stringify(g.red_flag_criteria ?? [])}`;
      const topicallyRelevant = matchedTopics.some((t) => t.needles.test(hay));
      return topicallyRelevant; // cross-specialty allowed when CC matches
    });
    const excludedGuidelines = (allSourcesRaw ?? [])
      .filter((g: any) => !allSources.some((k: any) => k.id === g.id))
      .map((g: any) => g.abbreviation ?? g.name);

    let versionRows: any[] = [];
    if (requestedVersionIds.length) {
      const { data } = await admin
        .from("guideline_versions")
        .select("id,source_id,version_string,effective_date,is_current")
        .in("id", requestedVersionIds);
      versionRows = data ?? [];
    } else {
      const sourceIds = (allSources ?? []).map((g: any) => g.id);
      if (sourceIds.length) {
        const { data } = await admin
          .from("guideline_versions")
          .select("id,source_id,version_string,effective_date,is_current")
          .in("source_id", sourceIds)
          .eq("is_current", true);
        versionRows = data ?? [];
      }
    }

    const sourcesById = new Map((allSources ?? []).map((g: any) => [g.id, g]));
    const usedVersions = versionRows
      .map((v: any) => {
        const src = sourcesById.get(v.source_id);
        if (!src) return null;
        return {
          version_id: v.id,
          source_id: v.source_id,
          name: src.name,
          abbreviation: src.abbreviation,
          version_string: v.version_string,
          effective_date: v.effective_date,
          is_current: v.is_current,
        };
      })
      .filter(Boolean) as any[];

    const activeSources = usedVersions.length
      ? usedVersions.map((v) => sourcesById.get(v.source_id)).filter(Boolean)
      : (allSources ?? []);

    const guidelineBlock = (activeSources ?? [])
      .map(
        (g: any) =>
          `${g.abbreviation ?? g.name} (${g.specialty ?? "general"}):\n  Recommendations: ${JSON.stringify(g.key_recommendations ?? [])}\n  Red flags: ${JSON.stringify(g.red_flag_criteria ?? [])}`,
      )
      .join("\n\n")
      .slice(0, 8000);

    // Pull recent reviewer feedback to nudge the scorer away from known false positives.
    const { data: feedbackStats } = await admin
      .from("finding_feedback_stats")
      .select("*");
    const feedbackHint = (feedbackStats ?? [])
      .filter((f: any) => f.total_feedback >= 3 && f.false_positive_rate >= 0.3)
      .map(
        (f: any) =>
          `- ${f.finding_type}: ${(f.false_positive_rate * 100).toFixed(0)}% historical false-positive rate (n=${f.total_feedback}). Require stronger evidence.`,
      )
      .join("\n");

    const reasoningSchema = {
      type: "object",
      properties: {
        reasoning_quality: {
          type: "string",
          enum: ["excellent", "adequate", "weak", "unsafe"],
        },
        reasoning_summary: { type: "string" },
        strengths: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              evidence_quote: { type: "string" },
            },
            required: ["title", "detail"],
          },
        },
        gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              severity: { type: "string", enum: ["low", "moderate", "high", "critical"] },
              suggestion: { type: "string" },
            },
            required: ["title", "detail", "severity"],
          },
        },
        guideline_matches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              guideline: { type: "string" },
              recommendation_id: { type: "string" },
              recommendation: { type: "string" },
              status: { type: "string", enum: ["aligned", "partial", "missing", "contradicted"] },
              evidence_quote: { type: "string" },
              suggestion: { type: "string" },
            },
            required: ["guideline", "recommendation", "status"],
          },
        },
        red_flag_findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              guideline: { type: "string" },
              flag_id: { type: "string" },
              label: { type: "string" },
              status: { type: "string", enum: ["addressed", "missed", "not_applicable"] },
              why_it_matters: { type: "string" },
              suggested_addition: { type: "string" },
            },
            required: ["label", "status", "why_it_matters"],
          },
        },
        cognitive_biases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              bias: {
                type: "string",
                enum: [
                  "premature_closure",
                  "anchoring",
                  "availability",
                  "confirmation",
                  "framing",
                  "search_satisficing",
                ],
              },
              detected: { type: "boolean" },
              evidence_quote: { type: "string" },
              explanation: { type: "string" },
              remediation: { type: "string" },
            },
            required: ["bias", "detected", "explanation"],
          },
        },
      },
      required: [
        "reasoning_quality",
        "reasoning_summary",
        "strengths",
        "gaps",
        "guideline_matches",
        "red_flag_findings",
        "cognitive_biases",
      ],
    };

    const reasoningResp = await callGateway(
      {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Vellum's Clinical Reasoning analyst. Critique the AI-generated note like a senior attending: assess reasoning quality, identify strengths and gaps, cross-reference saved specialty guidelines (mark each recommendation aligned/partial/missing/contradicted with an evidence quote and suggestion), screen the listed red-flag criteria (e.g. SNOOP, sepsis, ACS) and flag missed ones with WHY they matter and a concrete suggested note addition, and detect cognitive biases (premature closure, anchoring, availability, confirmation, framing, search satisficing) — only mark detected=true with concrete evidence and a remediation. Be specific. Cite quotes from the note verbatim." +
              (feedbackHint
                ? `\n\nREVIEWER FEEDBACK CALIBRATION — these finding types have been over-flagged in past reviews; raise your threshold and demand strong evidence:\n${feedbackHint}`
                : ""),
          },
          {
            role: "user",
            content: `SPECIALTY: ${encounter.specialty}\nVISIT: ${encounter.visit_type ?? "n/a"}\nCHIEF COMPLAINT: ${encounter.chief_complaint ?? "n/a"}\n\n=== SAVED GUIDELINES FOR THIS SPECIALTY ===\n${guidelineBlock || "(no guidelines configured)"}\n\n=== SOURCE EVIDENCE ===\n${sourceText.slice(0, 8000) || "(none)"}\n\n=== AI-GENERATED NOTE ===\n${noteText}\n\n=== EXTRACTED CLAIMS ===\n${JSON.stringify(claimsOut).slice(0, 4000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_reasoning",
              description: "Report clinical reasoning analysis",
              parameters: reasoningSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_reasoning" } },
      },
      apiKey,
    );
    const reasoningOut = toolArgs(reasoningResp);

    // Persist the rubric load manifest so reviewers can see exactly which
    // guideline sources were considered for THIS chief complaint and which
    // were excluded. This is the audit trail that tells you the cross-refs
    // weren't the wrong specialty's rules accidentally loaded.
    let manifestId: string | null = null;
    {
      const { data: manifest } = await admin
        .from("rubric_load_manifests")
        .insert({
          encounter_id: encounterId,
          loaded_modules: (allSources ?? []).map((g: any) => g.abbreviation ?? g.name),
          excluded_modules: excludedGuidelines,
          guideline_versions: usedVersions,
        })
        .select("id")
        .single();
      manifestId = manifest?.id ?? null;
    }

    // ---- Persist ----
    const claimRows = (claimsOut ?? []).map((c: any) => ({
      artifact_id: artifact.id,
      claim_text: String(c.claim_text).slice(0, 2000),
      claim_type: c.claim_type,
      status: c.status,
      risk_weight: c.risk_weight ?? 0.5,
      claim_entities: c.evidence_quote ? [{ evidence_quote: c.evidence_quote }] : [],
    }));
    if (claimRows.length) {
      await admin.from("clinical_claims").insert(claimRows);
    }

    const ss = evalOut.sub_scores ?? {};
    const { data: run, error: runErr } = await admin
      .from("evaluation_runs")
      .insert({
        encounter_id: encounterId,
        artifact_id: artifact.id,
        trust_score: ss.trust_score ?? null,
        source_faithfulness_index: ss.source_faithfulness_index ?? null,
        differential_integrity_score: ss.differential_integrity_score ?? null,
        guideline_concordance_score: ss.guideline_concordance_score ?? null,
        omission_hazard_score: ss.omission_hazard_score ?? null,
        patient_safety_escalation_score: ss.patient_safety_escalation_score ?? null,
        uncertainty_calibration_score: ss.uncertainty_calibration_score ?? null,
        medico_legal_exposure_score: ss.medico_legal_exposure_score ?? null,
        reviewability_index: ss.reviewability_index ?? null,
        evaluator_confidence: ss.evaluator_confidence ?? null,
        critical_failures: evalOut.critical_failures ?? [],
        reasoning_quality: reasoningOut.reasoning_quality ?? null,
        reasoning_summary: reasoningOut.reasoning_summary ?? null,
        reasoning_strengths: reasoningOut.strengths ?? [],
        reasoning_gaps: reasoningOut.gaps ?? [],
        guideline_matches: reasoningOut.guideline_matches ?? [],
        red_flag_findings: reasoningOut.red_flag_findings ?? [],
        cognitive_biases: (reasoningOut.cognitive_biases ?? []).filter((b: any) => b.detected),
        guideline_versions_used: usedVersions,
        auto_escalated:
          (evalOut.critical_failures ?? []).length > 0 || (ss.trust_score ?? 100) < 60,
      })
      .select()
      .single();
    if (runErr) throw runErr;

    const critRows = (evalOut.results ?? []).map((r: any) => ({
      evaluation_run_id: run.id,
      criterion_id: r.criterion_id,
      applicability: r.applicability,
      result: r.result,
      severity: r.severity,
      confidence: r.confidence,
      explanation: String(r.explanation ?? "").slice(0, 4000),
      evidence: r.evidence_quote ? { quote: r.evidence_quote } : {},
      score_delta: r.score_delta ?? 0,
      requires_human_adjudication: !!r.requires_human_adjudication,
    }));
    if (critRows.length) {
      await admin.from("criterion_results").insert(critRows);
    }

    // Auto-escalate to a reviewer assignment if needed
    if (run.auto_escalated) {
      await admin.from("reviewer_assignments").insert({
        encounter_id: encounterId,
        artifact_id: artifact.id,
        reviewer_id: user.id,
        assigned_by: user.id,
        priority: (evalOut.critical_failures ?? []).length > 0 ? "critical" : "high",
        status: "pending",
      });
    }

    // Risk events for critical failures
    for (const cf of (evalOut.critical_failures ?? []).slice(0, 10)) {
      await admin.from("risk_events").insert({
        user_id: user.id,
        encounter_id: encounterId,
        evaluation_run_id: run.id,
        event_type: "critical_failure",
        severity: "S5",
        description: String(cf).slice(0, 500),
      });
    }

    await admin.from("audit_events").insert({
      user_id: user.id,
      encounter_id: encounterId,
      event_type: "evaluation_completed",
      event_data: { run_id: run.id, trust_score: ss.trust_score, claims: claimRows.length, results: critRows.length },
    });

    return new Response(
      JSON.stringify({ run_id: run.id, trust_score: ss.trust_score, claims: claimRows.length, results: critRows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("evaluate-encounter", correlationId, e);
    return new Response(
      JSON.stringify({ error: "Evaluation failed", correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});