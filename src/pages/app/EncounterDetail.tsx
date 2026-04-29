import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/vellum/PageHeader";
import TrustScorePill from "@/components/vellum/TrustScorePill";
import SeverityDot from "@/components/vellum/SeverityDot";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Loader2, Play, AlertOctagon, FileText, ExternalLink } from "lucide-react";

export default function EncounterDetail() {
  const { id } = useParams<{ id: string }>();
  const [encounter, setEncounter] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [artifact, setArtifact] = useState<any>(null);
  const [run, setRun] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [criteriaMap, setCriteriaMap] = useState<Map<string, any>>(new Map());
  const [activeTab, setActiveTab] = useState("transcript");
  const [running, setRunning] = useState(false);

  async function load() {
    if (!id) return;
    const [{ data: enc }, { data: src }, { data: art }, { data: cm }] = await Promise.all([
      supabase.from("encounters").select("*").eq("id", id).maybeSingle(),
      supabase.from("encounter_sources").select("*").eq("encounter_id", id),
      supabase.from("note_artifacts").select("*").eq("encounter_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("rubric_criteria").select("criterion_id, name, severity_level, domain_id"),
    ]);
    setEncounter(enc);
    setSources(src ?? []);
    setArtifact(art ?? null);
    setCriteriaMap(new Map((cm ?? []).map((c: any) => [c.criterion_id, c])));

    const { data: r } = await supabase.from("evaluation_runs").select("*").eq("encounter_id", id).order("completed_at", { ascending: false }).limit(1).maybeSingle();
    setRun(r ?? null);

    if (art) {
      const { data: c } = await supabase.from("clinical_claims").select("*").eq("artifact_id", art.id);
      setClaims(c ?? []);
    }
    if (r) {
      const { data: cr } = await supabase.from("criterion_results").select("*").eq("evaluation_run_id", r.id);
      setResults(cr ?? []);
    }
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`enc-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluation_runs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "criterion_results" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "clinical_claims" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function rerun() {
    if (!id) return;
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("evaluate-encounter", { body: { encounter_id: id } });
      if (error) throw error;
      toast.success("Evaluation complete");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Evaluation failed");
    } finally {
      setRunning(false);
    }
  }

  if (!encounter) {
    return <div className="p-12 text-muted-foreground">Loading encounter…</div>;
  }

  const sourceText = (st: string) => {
    const s = sources.find((x) => x.source_type === st);
    if (!s) return null;
    const c = s.content;
    return typeof c === "string" ? c : (c?.text ?? JSON.stringify(c, null, 2));
  };

  const subScores = run ? [
    ["Source faithfulness", run.source_faithfulness_index],
    ["Differential integrity", run.differential_integrity_score],
    ["Guideline concordance", run.guideline_concordance_score],
    ["Omission hazard", run.omission_hazard_score],
    ["Patient-safety escalation", run.patient_safety_escalation_score],
    ["Uncertainty calibration", run.uncertainty_calibration_score],
    ["Medico-legal exposure", run.medico_legal_exposure_score],
    ["Reviewability", run.reviewability_index],
    ["Evaluator confidence", run.evaluator_confidence],
  ] as [string, number | null][] : [];

  const sortedResults = [...results].sort((a, b) => {
    const order = { critical_fail: 0, fail: 1, concern: 2, pass: 3 } as Record<string, number>;
    return (order[a.result] ?? 9) - (order[b.result] ?? 9);
  });

  return (
    <div>
      <PageHeader
        eyebrow={`ENC // ${id?.slice(0, 8)}`}
        title={encounter.chief_complaint ?? "Encounter audit"}
        description={`${encounter.specialty?.replace(/_/g, " ")} · ${encounter.visit_type ?? ""} · ${encounter.ai_vendor ?? "unknown vendor"}`}
        actions={
          <div className="flex items-center gap-2">
            {run && (
              <Link to={`/encounters/${id}/eval`} className="font-mono text-[11px] text-accent hover:text-accent-hover flex items-center gap-1">
                Full report <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            <Button size="sm" onClick={rerun} disabled={running} className="bg-accent text-accent-foreground hover:bg-accent-hover">
              {running ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Evaluating</> : <><Play className="h-3.5 w-3.5 mr-1.5" /> {run ? "Re-run audit" : "Run audit"}</>}
            </Button>
          </div>
        }
      />

      <div className="p-6 grid lg:grid-cols-12 gap-4">
        {/* Source */}
        <div className="lg:col-span-4 vellum-panel flex flex-col min-h-[640px]">
          <div className="border-b border-border px-4 py-2 flex items-center gap-1">
            {["transcript", "ehr", "labs"].map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm transition ${
                  activeTab === t ? "bg-accent/15 text-accent" : "text-tertiary hover:text-foreground"
                }`}>
                {t}
              </button>
            ))}
            <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary ml-auto">SOURCE</span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90">
              {sourceText(activeTab) ?? <span className="text-tertiary italic">No {activeTab} source provided.</span>}
            </pre>
          </div>
        </div>

        {/* AI-generated note */}
        <div className="lg:col-span-4 vellum-panel flex flex-col min-h-[640px]">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-accent" />
              <span className="font-heading text-xs uppercase tracking-wider">AI-generated note</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary">{artifact?.artifact_type ?? "—"}</span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90">
              {artifact?.raw_text ?? "—"}
            </pre>
          </div>
          {claims.length > 0 && (
            <div className="border-t border-border px-4 py-3 max-h-[200px] overflow-auto">
              <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-2">Extracted claims · {claims.length}</div>
              <ul className="space-y-1.5">
                {claims.slice(0, 12).map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-[11px]">
                    <span className={`mt-1 inline-block w-1.5 h-1.5 rounded-full ${
                      c.status === "supported" ? "bg-pass"
                      : c.status === "contradicted" ? "bg-critical"
                      : c.status === "unsupported" ? "bg-high"
                      : "bg-moderate"}`} />
                    <span className="flex-1">
                      <span className="text-foreground/90">{c.claim_text}</span>
                      <span className="font-mono text-tertiary ml-2">{c.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Vellum evaluation */}
        <div className="lg:col-span-4 vellum-panel flex flex-col min-h-[640px]">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <span className="font-heading text-xs uppercase tracking-wider">Vellum evaluation</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary">{run ? "COMPLETE" : "PENDING"}</span>
          </div>

          {!run ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-3">No evaluation yet</div>
                <Button size="sm" onClick={rerun} disabled={running} className="bg-accent text-accent-foreground hover:bg-accent-hover">
                  {running ? "Evaluating…" : "Run audit"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">Trust score</div>
                    <div className="font-display text-5xl mt-1">
                      {run.trust_score != null ? Math.round(run.trust_score) : "—"}
                      <span className="font-mono text-xs text-tertiary ml-1">/100</span>
                    </div>
                  </div>
                  <TrustScorePill score={run.trust_score} />
                </div>

                {run.critical_failures?.length > 0 && (
                  <div className="mt-4 border border-critical/30 bg-critical/5 rounded-sm p-3">
                    <div className="flex items-center gap-1.5 text-critical font-heading text-xs uppercase tracking-wider mb-1.5">
                      <AlertOctagon className="h-3.5 w-3.5" /> Critical failures · {run.critical_failures.length}
                    </div>
                    <ul className="text-[11px] text-foreground/90 space-y-1">
                      {run.critical_failures.map((f: string, i: number) => <li key={i}>· {f}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div className="p-4 border-b border-border">
                <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-2">Sub-scores</div>
                <div className="grid grid-cols-2 gap-2">
                  {subScores.map(([label, val]) => (
                    <div key={label} className="border border-border rounded-sm px-2 py-1.5 bg-surface">
                      <div className="text-[9px] uppercase tracking-wider text-tertiary truncate">{label}</div>
                      <div className="font-mono text-sm">{val != null ? Math.round(val * 10) / 10 : "—"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-2">Criterion findings · {results.length}</div>
                <ul className="space-y-2">
                  {sortedResults.map((r) => {
                    const meta = criteriaMap.get(r.criterion_id);
                    return (
                      <li key={r.id} className={`border rounded-sm p-2.5 ${
                        r.result === "critical_fail" ? "border-critical/40 bg-critical/5"
                        : r.result === "fail" ? "border-high/40 bg-high/5"
                        : r.result === "concern" ? "border-moderate/40 bg-moderate/5"
                        : "border-border bg-surface"}`}>
                        <div className="flex items-start gap-2">
                          <SeverityDot severity={r.severity} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-heading text-xs">{meta?.name ?? r.criterion_id}</span>
                              <span className="font-mono text-[9px] text-tertiary">{r.criterion_id}</span>
                              <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">{r.result}</span>
                            </div>
                            <div className="text-[11px] text-foreground/80 mt-1">{r.explanation}</div>
                            {r.evidence?.quote && (
                              <div className="mt-1.5 border-l-2 border-accent/40 pl-2 text-[11px] italic text-muted-foreground">
                                "{r.evidence.quote}"
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}