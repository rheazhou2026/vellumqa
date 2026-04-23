// Edge function: process a batch of clinical notes sequentially.
// Reuses the analyze-note logic and writes an aggregate summary.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runAnalysis } from "../analyze-note/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pickRelevantGuidelines(noteText: string, all: any[]) {
  const lower = noteText.toLowerCase();
  const matched = all.filter((g) =>
    (g.condition_keywords ?? []).some((kw: string) => lower.includes(kw.toLowerCase())),
  );
  if (matched.length >= 3) return matched.slice(0, 6);
  const extras = all.filter((g) => !matched.includes(g)).slice(0, 3 - matched.length);
  return [...matched, ...extras];
}

function aggregate(analyses: any[]) {
  if (analyses.length === 0) return { count: 0 };

  const avg = (k: string) =>
    Math.round(
      (analyses.reduce((s, a) => s + (Number(a[k]) || 0), 0) / analyses.length) * 10,
    ) / 10;

  const issueCategoryCounts: Record<string, number> = {};
  const severityCounts: Record<string, number> = { critical: 0, important: 0, minor: 0, info: 0 };
  const biasCounts: Record<string, number> = {};
  const patternCounts: Record<string, number> = {};
  let redFlagsTotal = 0;

  for (const a of analyses) {
    for (const issue of a.issues ?? []) {
      issueCategoryCounts[issue.category] = (issueCategoryCounts[issue.category] || 0) + 1;
      severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
    }
    for (const b of a.cognitive_biases ?? []) {
      biasCounts[b.bias] = (biasCounts[b.bias] || 0) + 1;
    }
    if (a.recognized_pattern) {
      patternCounts[a.recognized_pattern] = (patternCounts[a.recognized_pattern] || 0) + 1;
    }
    redFlagsTotal += (a.red_flags ?? []).length;
  }

  const ratingDist = analyses.reduce((acc: Record<string, number>, a) => {
    const r = a.reasoning_rating || "Unknown";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  return {
    count: analyses.length,
    averages: {
      overall_trust: avg("overall_trust_score"),
      safety: avg("safety_score"),
      completeness: avg("completeness_score"),
      accuracy: avg("accuracy_score"),
      reasoning: avg("reasoning_score"),
    },
    reasoning_rating_distribution: ratingDist,
    issue_category_counts: issueCategoryCounts,
    severity_counts: severityCounts,
    bias_counts: biasCounts,
    pattern_counts: patternCounts,
    red_flags_total: redFlagsTotal,
    notes_with_critical_issues: analyses.filter((a) =>
      (a.issues ?? []).some((i: any) => i.severity === "critical"),
    ).length,
  };
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

    const { batchId } = await req.json();
    if (!batchId) {
      return new Response(JSON.stringify({ error: "batchId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: batch, error: batchErr } = await supabase
      .from("batch_jobs")
      .select("*")
      .eq("id", batchId)
      .single();
    if (batchErr || !batch) throw new Error("Batch not found");
    if (batch.user_id !== user.id) throw new Error("Forbidden");

    await supabase.from("batch_jobs").update({ status: "processing" }).eq("id", batchId);

    const { data: items } = await supabase
      .from("batch_job_items")
      .select("*")
      .eq("batch_id", batchId)
      .order("position", { ascending: true });

    const { data: guidelines } = await supabase
      .from("clinical_guidelines")
      .select("id, name, organization, specialty, condition_keywords, summary, recommendations, red_flags, citation")
      .eq("active", true);

    let processed = 0;
    let failed = 0;
    const analyses: any[] = [];

    for (const item of items ?? []) {
      if (item.status === "done") {
        processed++;
        continue;
      }
      await supabase.from("batch_job_items").update({ status: "processing" }).eq("id", item.id);
      try {
        const relevant = pickRelevantGuidelines(item.note_text, guidelines ?? []);
        const { parsed, model, raw } = await runAnalysis({
          noteText: item.note_text,
          guidelines: relevant,
          apiKey: lovableKey,
        });

        const { data: noteRow } = await supabase
          .from("clinical_notes")
          .insert({
            user_id: user.id,
            ai_source_id: batch.ai_source_id ?? null,
            patient_label: item.patient_label,
            note_text: item.note_text,
            source_metadata: { batch_id: batchId, position: item.position },
          })
          .select()
          .single();

        const { data: analysisRow } = await supabase
          .from("note_analyses")
          .insert({
            note_id: noteRow!.id,
            user_id: user.id,
            ai_source_id: batch.ai_source_id ?? null,
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

        await supabase
          .from("batch_job_items")
          .update({ status: "done", analysis_id: analysisRow!.id })
          .eq("id", item.id);

        analyses.push(analysisRow);
        processed++;
        await supabase
          .from("batch_jobs")
          .update({ processed_items: processed })
          .eq("id", batchId);
      } catch (e: any) {
        failed++;
        await supabase
          .from("batch_job_items")
          .update({ status: "error", error: e?.message ?? "unknown" })
          .eq("id", item.id);
      }
    }

    // Pull all analyses for aggregate (in case some were processed previously)
    const { data: allAnalyses } = await supabase
      .from("note_analyses")
      .select("*")
      .in(
        "id",
        (
          await supabase
            .from("batch_job_items")
            .select("analysis_id")
            .eq("batch_id", batchId)
            .not("analysis_id", "is", null)
        ).data?.map((r: any) => r.analysis_id) ?? [],
      );

    const summary = aggregate(allAnalyses ?? analyses);

    await supabase
      .from("batch_jobs")
      .update({
        status: failed > 0 && processed === 0 ? "failed" : "completed",
        processed_items: processed,
        failed_items: failed,
        aggregate_summary: summary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    return new Response(JSON.stringify({ ok: true, processed, failed, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("process-batch error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});