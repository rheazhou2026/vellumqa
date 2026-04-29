import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/vellum/PageHeader";
import TrustScorePill from "@/components/vellum/TrustScorePill";
import SeverityDot from "@/components/vellum/SeverityDot";
import ClinicalReasoningPanel from "@/components/vellum/ClinicalReasoningPanel";
import GuidelineMatchPanel from "@/components/vellum/GuidelineMatchPanel";
import RedFlagPanel from "@/components/vellum/RedFlagPanel";
import CognitiveBiasPanel from "@/components/vellum/CognitiveBiasPanel";
import { Button } from "@/components/ui/button";
import { Download, Printer, FileDown, Loader2 } from "lucide-react";
import { EvidenceTraceProvider, EvidenceQuote } from "@/components/vellum/EvidenceTrace";
import { downloadEvaluationPdf } from "@/components/vellum/EvaluationPdf";
import { toast } from "sonner";

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export default function EvaluationReport() {
  const { id } = useParams<{ id: string }>();
  const [encounter, setEncounter] = useState<any>(null);
  const [run, setRun] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<Map<string, any>>(new Map());
  const [domains, setDomains] = useState<Record<string, string>>({});
  const [analytics, setAnalytics] = useState<{ vendor: string; avg: number; runs: number; criticalRate: number }[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: enc } = await supabase.from("encounters").select("*").eq("id", id).maybeSingle();
      setEncounter(enc);
      const { data: r } = await supabase.from("evaluation_runs").select("*").eq("encounter_id", id).order("completed_at", { ascending: false }).limit(1).maybeSingle();
      setRun(r);
      if (r) {
        const { data: cr } = await supabase.from("criterion_results").select("*").eq("evaluation_run_id", r.id);
        setResults(cr ?? []);
      }
      if (r?.artifact_id) {
        const { data: cl } = await supabase.from("clinical_claims").select("*").eq("artifact_id", r.artifact_id);
        setClaims(cl ?? []);
      }
      const { data: cm } = await supabase.from("rubric_criteria").select("criterion_id, name, domain_id");
      setCriteria(new Map((cm ?? []).map((c: any) => [c.criterion_id, c])));
      const { data: doms } = await supabase.from("rubric_domains").select("id, name");
      setDomains(Object.fromEntries((doms ?? []).map((d: any) => [d.id, d.name])));

      // Analytics snapshot — vendor reliability over recent runs.
      const { data: hist } = await supabase
        .from("evaluation_runs")
        .select("trust_score, critical_failures, encounter_id")
        .order("completed_at", { ascending: false })
        .limit(500);
      if (hist?.length) {
        const { data: encs } = await supabase
          .from("encounters")
          .select("id, ai_vendor")
          .in("id", hist.map((h: any) => h.encounter_id).filter(Boolean));
        const vendorById = new Map<string, string>((encs ?? []).map((e: any) => [e.id, e.ai_vendor ?? "unknown"]));
        const buckets = new Map<string, { sum: number; n: number; crit: number }>();
        for (const h of hist) {
          const v = vendorById.get(h.encounter_id) ?? "unknown";
          const b = buckets.get(v) ?? { sum: 0, n: 0, crit: 0 };
          b.sum += h.trust_score ?? 0;
          b.n += 1;
          if ((h.critical_failures ?? []).length > 0) b.crit += 1;
          buckets.set(v, b);
        }
        setAnalytics(
          [...buckets.entries()]
            .map(([vendor, b]) => ({ vendor, avg: b.n ? b.sum / b.n : 0, runs: b.n, criticalRate: b.n ? b.crit / b.n : 0 }))
            .sort((a, b) => a.avg - b.avg)
        );
      }
    })();
  }, [id]);

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of results) {
      const key = criteria.get(r.criterion_id)?.domain_id ?? "ungrouped";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return m;
  }, [results, criteria]);

  function exportCSV() {
    const csv = toCSV(results.map((r) => ({
      criterion_id: r.criterion_id,
      name: criteria.get(r.criterion_id)?.name ?? "",
      result: r.result,
      severity: r.severity,
      confidence: r.confidence,
      explanation: r.explanation,
      evidence_quote: r.evidence?.quote ?? "",
    })));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vellum-encounter-${id?.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    if (!encounter || !run) {
      toast.error("Run an evaluation before exporting.");
      return;
    }
    setPdfBusy(true);
    try {
      await downloadEvaluationPdf({
        encounter,
        run,
        results,
        claims,
        criteriaByCriterionId: Object.fromEntries(
          [...criteria.entries()].map(([k, v]) => [k, { name: v.name, domain_id: v.domain_id }])
        ),
        domains,
        analytics,
      });
      toast.success("Audit PDF generated");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <EvidenceTraceProvider>
    <div>
      <PageHeader
        eyebrow={`AUDIT PACK // ${id?.slice(0, 8)}`}
        title="Full evaluation report"
        description="Printable, regulator-ready audit trail for this encounter."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
            </Button>
            <Button size="sm" onClick={exportCSV} className="bg-accent text-accent-foreground hover:bg-accent-hover">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={exportPDF} disabled={pdfBusy} className="bg-foreground text-background hover:bg-foreground/90">
              {pdfBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-1.5" />}
              Audit PDF
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6 max-w-5xl">
        {/* Executive summary */}
        <section className="vellum-panel p-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-2">Executive summary</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-3xl">{encounter?.chief_complaint ?? "Encounter"}</div>
              <div className="font-mono text-[11px] text-muted-foreground mt-1">
                {encounter?.specialty?.replace(/_/g, " ")} · {encounter?.ai_vendor ?? "—"} · {encounter && new Date(encounter.encounter_date).toISOString().slice(0,10)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-6xl">{run?.trust_score != null ? Math.round(run.trust_score) : "—"}</div>
              <div className="mt-1"><TrustScorePill score={run?.trust_score} /></div>
            </div>
          </div>
          {run?.critical_failures?.length > 0 && (
            <div className="mt-4 border border-critical/30 bg-critical/5 rounded-sm p-3">
              <div className="font-heading text-xs uppercase tracking-wider text-critical mb-1">Critical failures</div>
              <ul className="text-xs text-foreground/90 space-y-0.5">
                {run.critical_failures.map((f: string, i: number) => <li key={i}>· {f}</li>)}
              </ul>
            </div>
          )}
        </section>

        {/* Sub-scores */}
        {run && (
          <section className="vellum-panel p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-3">Domain sub-scores</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Source faithfulness", run.source_faithfulness_index],
                ["Differential integrity", run.differential_integrity_score],
                ["Guideline concordance", run.guideline_concordance_score],
                ["Omission hazard", run.omission_hazard_score],
                ["Patient-safety escalation", run.patient_safety_escalation_score],
                ["Uncertainty calibration", run.uncertainty_calibration_score],
                ["Medico-legal exposure", run.medico_legal_exposure_score],
                ["Reviewability", run.reviewability_index],
                ["Evaluator confidence", run.evaluator_confidence],
              ].map(([label, val]: any) => (
                <div key={label} className="border border-border rounded-sm p-3 bg-surface">
                  <div className="text-[10px] uppercase tracking-wider text-tertiary">{label}</div>
                  <div className="font-display text-2xl mt-1">{val != null ? Math.round(val * 10) / 10 : "—"}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {run && <ClinicalReasoningPanel run={run} />}
        {run && <GuidelineMatchPanel matches={run.guideline_matches} />}
        {run && <RedFlagPanel findings={run.red_flag_findings} />}
        {run && <CognitiveBiasPanel biases={run.cognitive_biases} />}

        {/* Claim ledger */}
        <section className="vellum-panel p-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-3">Clinical claim ledger · {claims.length}</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-2 font-mono text-[10px] uppercase tracking-widest text-tertiary">Claim</th>
                <th className="py-2 font-mono text-[10px] uppercase tracking-widest text-tertiary w-24">Type</th>
                <th className="py-2 font-mono text-[10px] uppercase tracking-widest text-tertiary w-28">Status</th>
                <th className="py-2 font-mono text-[10px] uppercase tracking-widest text-tertiary w-16">Risk</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">{c.claim_text}</td>
                  <td className="py-2 font-mono text-tertiary">{c.claim_type}</td>
                  <td className="py-2 font-mono">{c.status}</td>
                  <td className="py-2 font-mono">{c.risk_weight}</td>
                </tr>
              ))}
              {!claims.length && <tr><td colSpan={4} className="py-4 text-muted-foreground text-center">No claims extracted.</td></tr>}
            </tbody>
          </table>
        </section>

        {/* Criterion results grouped */}
        <section className="vellum-panel p-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-3">Criterion findings · {results.length}</div>
          <div className="space-y-4">
            {[...grouped.entries()].map(([dom, items]) => (
              <div key={dom}>
                <div className="font-heading text-xs uppercase tracking-wider text-muted-foreground mb-2">Domain · {dom.slice(0, 8)}</div>
                <ul className="space-y-1.5">
                  {items.map((r) => (
                    <li key={r.id} className="border border-border rounded-sm p-2.5 bg-surface">
                      <div className="flex items-center gap-2">
                        <SeverityDot severity={r.severity} />
                        <span className="font-heading text-xs">{criteria.get(r.criterion_id)?.name ?? r.criterion_id}</span>
                        <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">{r.result}</span>
                      </div>
                      <div className="text-[11px] text-foreground/80 mt-1">{r.explanation}</div>
                      {r.evidence?.quote && (
                        <div className="mt-1.5 text-[11px]">
                          <EvidenceQuote quote={r.evidence.quote} prefer="any" />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!results.length && <div className="text-muted-foreground text-sm">No evaluation results.</div>}
          </div>
        </section>

        {/* Audit trace */}
        <section className="vellum-panel p-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-3">Audit trace</div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-mono text-muted-foreground">
            <div><dt className="text-tertiary">encounter_id</dt><dd>{encounter?.id}</dd></div>
            <div><dt className="text-tertiary">artifact_id</dt><dd>{run?.artifact_id ?? "—"}</dd></div>
            <div><dt className="text-tertiary">run_id</dt><dd>{run?.id ?? "—"}</dd></div>
            <div><dt className="text-tertiary">completed_at</dt><dd>{run?.completed_at ?? "—"}</dd></div>
            <div><dt className="text-tertiary">ai_vendor</dt><dd>{encounter?.ai_vendor ?? "—"}</dd></div>
            <div><dt className="text-tertiary">specialty</dt><dd>{encounter?.specialty}</dd></div>
          </dl>
        </section>
      </div>
    </div>
    </EvidenceTraceProvider>
  );
}