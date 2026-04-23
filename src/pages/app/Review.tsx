import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/clinical/SectionCard";
import { ScoreGauge } from "@/components/clinical/ScoreGauge";
import { TopRiskBanner } from "@/components/clinical/TopRiskBanner";
import { SeverityBadge } from "@/components/clinical/SeverityBadge";
import { RedFlagChecklist } from "@/components/clinical/RedFlagChecklist";
import { GuidelineMatchPanel } from "@/components/clinical/GuidelineMatchPanel";
import { exportAuditAsCSV, exportAuditAsPDF } from "@/lib/export-report";
import { toast } from "sonner";
import {
  Brain, ShieldAlert, Eye, Sparkles, BookMarked, Target, AlertTriangle, ListChecks, Loader2,
  RefreshCw, FileDown, FileText, AlertCircle,
} from "lucide-react";
import { CATEGORY_LABELS, ALIGNMENT_LABELS, SAMPLE_HEADACHE_NOTE } from "@/lib/clinical-types";

export default function Review() {
  const { analysisId } = useParams();
  const [noteText, setNoteText] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [patientLabel, setPatientLabel] = useState("");
  const [aiSourceId, setAiSourceId] = useState<string | undefined>(undefined);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ status?: number; message: string; raw?: any } | null>(null);

  useEffect(() => {
    supabase.from("ai_sources").select("id, name, vendor").then(({ data }) => setSources(data ?? []));
  }, []);

  useEffect(() => {
    if (!analysisId) return;
    (async () => {
      const { data } = await supabase.from("note_analyses").select("*, clinical_notes(*)").eq("id", analysisId).maybeSingle();
      if (data) setAnalysis(data);
    })();
  }, [analysisId]);

  const runAnalysis = async () => {
    if (noteText.trim().length < 20) {
      toast.error("Please paste a clinical note (at least 20 characters).");
      return;
    }
    setLoading(true);
    setAnalysis(null);
    setErrorInfo(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-note", {
        body: { noteText, chiefComplaint, specialty, patientLabel, aiSourceId },
      });
      if (error) {
        // FunctionsHttpError exposes response status via context.response
        let status: number | undefined;
        let body: any = null;
        try {
          status = (error as any)?.context?.response?.status;
          body = await (error as any)?.context?.response?.json?.();
        } catch { /* ignore */ }
        setErrorInfo({
          status,
          message: body?.error ?? error.message ?? "Edge function failed",
          raw: body ?? null,
        });
        return;
      }
      if (data?.error) {
        setErrorInfo({ message: data.error, raw: data });
        return;
      }
      setAnalysis(data.analysis);
      toast.success("Audit complete");
    } catch (e: any) {
      setErrorInfo({ message: e?.message ?? "Analysis failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.18em] text-accent">Single Note</div>
        <h1 className="mt-2 font-display text-4xl font-semibold">Clinical reasoning audit</h1>
      </header>

      {errorInfo && (
        <div className="rounded-md border border-critical/40 bg-critical-soft/30 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-critical" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-critical">Audit failed</div>
                {errorInfo.status != null && (
                  <span className="rounded-sm border border-critical/40 bg-background px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-critical">
                    HTTP {errorInfo.status}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-foreground">{errorInfo.message}</p>
              {errorInfo.raw && (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Raw response</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-[10px]">{JSON.stringify(errorInfo.raw, null, 2)}</pre>
                </details>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={runAnalysis} disabled={loading} className="gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Retry audit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setErrorInfo(null)}>Dismiss</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!analysis && (
        <SectionCard title="Submit a note for review" eyebrow="Input">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Label htmlFor="patient">Patient label (optional)</Label>
              <Input id="patient" value={patientLabel} onChange={(e) => setPatientLabel(e.target.value)} className="mt-1.5" placeholder="Case #2847" />
            </div>
            <div>
              <Label htmlFor="cc">Chief complaint (optional)</Label>
              <Input id="cc" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} className="mt-1.5" placeholder="Headache, 3 weeks" />
            </div>
            <div>
              <Label htmlFor="spec">Specialty (optional)</Label>
              <Input id="spec" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="mt-1.5" placeholder="Neurology" />
            </div>
            <div>
              <Label>AI source (optional)</Label>
              <Select value={aiSourceId} onValueChange={setAiSourceId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Tag the AI that produced this note" /></SelectTrigger>
                <SelectContent>
                  {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.vendor ? ` · ${s.vendor}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="note">Clinical note</Label>
              <button type="button" className="text-xs text-accent" onClick={() => setNoteText(SAMPLE_HEADACHE_NOTE)}>Load sample</button>
            </div>
            <Textarea id="note" rows={12} value={noteText} onChange={(e) => setNoteText(e.target.value)} className="font-mono text-sm" placeholder="Paste an AI-generated clinical note here…" />
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={runAnalysis} disabled={loading} className="gap-2 bg-gradient-ink text-primary-foreground hover:opacity-90">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Auditing…</> : <>Run audit</>}
            </Button>
          </div>
        </SectionCard>
      )}

      {analysis && (
        <>
          <TopRiskBanner risk={analysis.top_clinical_risk} rating={analysis.reasoning_rating} pattern={analysis.recognized_pattern} />

          <div className="paper-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-accent">Trust scores</div>
                <h2 className="mt-1 font-display text-xl font-semibold">Calibrated 0 to 100</h2>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAnalysis(null)}>New review</Button>
            </div>
            <div className="ink-rule mb-6" />
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
              <ScoreGauge label="Trust" score={Number(analysis.overall_trust_score)} size={104} />
              <ScoreGauge label="Safety" score={Number(analysis.safety_score)} />
              <ScoreGauge label="Reasoning" score={Number(analysis.reasoning_score)} />
              <ScoreGauge label="Accuracy" score={Number(analysis.accuracy_score)} />
              <ScoreGauge label="Completeness" score={Number(analysis.completeness_score)} />
            </div>
          </div>

          <SectionCard icon={Brain} title="Clinical reasoning analysis" eyebrow="1 / Reasoning">
            <p className="mb-5 text-sm text-foreground/80">{analysis.clinical_reasoning?.summary}</p>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-safe">Strengths</div>
                <ul className="space-y-2 text-sm">
                  {(analysis.clinical_reasoning?.strengths ?? []).map((s: string, i: number) => (
                    <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-safe" />{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-critical">Gaps</div>
                <ul className="space-y-2 text-sm">
                  {(analysis.clinical_reasoning?.gaps ?? []).map((s: string, i: number) => (
                    <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-critical" />{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={ShieldAlert} title="Missed red flags" eyebrow="2 / Safety">
            {(analysis.red_flags ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No red-flag screening gaps detected.</div>
            ) : (
              <div className="space-y-3">
                {analysis.red_flags.map((rf: any, i: number) => (
                  <div key={i} className="rounded-md border border-border bg-surface-muted/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-foreground">{rf.label}</div>
                      <SeverityBadge severity={rf.severity} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground/80">Why it matters: </span>{rf.why_matters}</p>
                    <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground/80">Suggested addition: </span>{rf.suggested_addition}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Eye} title="Cognitive bias detection" eyebrow="3 / Reasoning Quality">
            {(analysis.cognitive_biases ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No cognitive biases detected.</div>
            ) : (
              <div className="space-y-3">
                {analysis.cognitive_biases.map((b: any, i: number) => (
                  <div key={i} className="rounded-md border border-important/30 bg-important-soft/40 p-4">
                    <div className="font-medium text-foreground">{b.bias}</div>
                    <p className="mt-2 text-sm"><span className="font-medium text-foreground/80">Evidence: </span>{b.evidence}</p>
                    <p className="mt-1 text-sm"><span className="font-medium text-foreground/80">Why it matters: </span>{b.why_matters}</p>
                    <p className="mt-1 text-sm"><span className="font-medium text-foreground/80">Suggested fix: </span>{b.suggested_fix}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Sparkles} title="Pattern recognition" eyebrow="4 / Expectation engine">
            {(analysis.pattern_matches ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No specific clinical pattern matched.</div>
            ) : (
              <div className="space-y-4">
                {analysis.pattern_matches.map((p: any, i: number) => (
                  <div key={i}>
                    <div className="mb-2 font-medium">{p.pattern}</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Expected</div>
                        <ul className="space-y-1 text-sm">{p.expected.map((x: string, j: number) => <li key={j}>· {x}</li>)}</ul>
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-critical">Missing</div>
                        <ul className="space-y-1 text-sm">{p.missing.map((x: string, j: number) => <li key={j}>· {x}</li>)}</ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Target} title="Gold-standard check" eyebrow="5 / Best-practice elements">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-safe/30 bg-safe-soft/40 p-4">
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-safe">Present</div>
                <ul className="space-y-1 text-sm">{(analysis.gold_standard?.present ?? []).map((x: string, i: number) => <li key={i}>✓ {x}</li>)}</ul>
              </div>
              <div className="rounded-md border border-critical/30 bg-critical-soft/40 p-4">
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-critical">Missing</div>
                <ul className="space-y-1 text-sm">{(analysis.gold_standard?.missing ?? []).map((x: string, i: number) => <li key={i}>✗ {x}</li>)}</ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={AlertTriangle} title="Risk impact" eyebrow="6 / Clinical consequences">
            <dl className="grid gap-4 sm:grid-cols-3">
              {[
                ["Missed diagnosis", analysis.risk_impact?.missed_diagnosis_risk],
                ["Delayed escalation", analysis.risk_impact?.delayed_escalation_risk],
                ["Inappropriate reassurance", analysis.risk_impact?.inappropriate_reassurance_risk],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-md border border-border p-4">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{k}</dt>
                  <dd className="mt-2 text-sm">{v as string}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard icon={BookMarked} title="Guideline cross-reference" eyebrow="7 / Library evidence">
            {(analysis.guideline_references ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No guidelines matched this presentation.</div>
            ) : (
              <div className="space-y-3">
                {analysis.guideline_references.map((g: any, i: number) => (
                  <div key={i} className="flex flex-wrap items-start gap-3 rounded-md border border-border p-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{g.name} <span className="text-muted-foreground">· {g.organization}</span></div>
                      <p className="mt-1 text-sm text-muted-foreground">{g.notes}</p>
                    </div>
                    <span className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-xs uppercase tracking-wider">
                      {ALIGNMENT_LABELS[g.alignment as keyof typeof ALIGNMENT_LABELS] ?? g.alignment}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={ListChecks} title="All issues" eyebrow="8 / Categorized findings">
            <div className="space-y-3">
              {(analysis.issues ?? []).map((iss: any, i: number) => (
                <div key={i} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={iss.severity} />
                    <span className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {CATEGORY_LABELS[iss.category as keyof typeof CATEGORY_LABELS] ?? iss.category}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{iss.description}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{iss.suggested_fix}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}