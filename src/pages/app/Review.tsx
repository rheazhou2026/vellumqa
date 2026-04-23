import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SectionCard } from "@/components/clinical/SectionCard";
import { ScoreGauge } from "@/components/clinical/ScoreGauge";
import { ExecutiveSummary } from "@/components/clinical/ExecutiveSummary";
import { IssueCard } from "@/components/clinical/IssueCard";
import { SeverityBadge } from "@/components/clinical/SeverityBadge";
import { RedFlagChecklist } from "@/components/clinical/RedFlagChecklist";
import { GuidelineMatchPanel } from "@/components/clinical/GuidelineMatchPanel";
import { ScoreEvidencePopover } from "@/components/clinical/ScoreEvidencePopover";
import { SuppressedFlagsPanel } from "@/components/clinical/SuppressedFlagsPanel";
import { exportAuditAsCSV, exportAuditAsPDF } from "@/lib/export-report";
import { toast } from "sonner";
import {
  Brain, ShieldAlert, Eye, Sparkles, BookMarked, Target, AlertTriangle, ListChecks, Loader2,
  RefreshCw, FileDown, FileText, AlertCircle, ChevronDown, Info,
} from "lucide-react";
import { SAMPLE_HEADACHE_NOTE } from "@/lib/clinical-types";

const ISSUE_CAP = 6;

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

  // Progressive disclosure state
  const [expanded, setExpanded] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    safety: true,
    reasoning: false,
    guidelines: false,
  });
  const toggleGroup = (k: string) => setOpenGroups((g) => ({ ...g, [k]: !g[k] }));

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
    setExpanded(false);
    setShowAllIssues(false);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-note", {
        body: { noteText, chiefComplaint, specialty, patientLabel, aiSourceId },
      });
      if (error) {
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

  const sortedIssues: any[] = useMemo(() => {
    const order: Record<string, number> = { critical: 0, important: 1, minor: 2, info: 3 };
    return [...(analysis?.issues ?? [])].sort(
      (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9),
    );
  }, [analysis]);

  const visibleIssues = showAllIssues ? sortedIssues : sortedIssues.slice(0, ISSUE_CAP);
  const hiddenCount = Math.max(0, sortedIssues.length - ISSUE_CAP);
  const topIssues = sortedIssues.slice(0, 3);

  const scoreRows = analysis ? [
    { key: "safety", label: "Safety", value: analysis.safety_score },
    { key: "reasoning", label: "Reasoning", value: analysis.reasoning_score },
    { key: "accuracy", label: "Accuracy", value: analysis.accuracy_score },
    { key: "completeness", label: "Completeness", value: analysis.completeness_score },
  ] : [];
  const rationales = analysis?.score_rationales ?? {};

  return (
    <div className="space-y-6">
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
            <Textarea id="note" rows={12} value={noteText} onChange={(e) => setNoteText(e.target.value)} className="font-mono text-sm" placeholder="Paste an AI-generated clinical note here..." />
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={runAnalysis} disabled={loading} className="gap-2 bg-gradient-ink text-primary-foreground hover:opacity-90">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Auditing...</> : <>Run audit</>}
            </Button>
          </div>
        </SectionCard>
      )}

      {analysis && (
        <>
          <ExecutiveSummary
            analysis={analysis}
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
          />

          {topIssues.length > 0 && (
            <SectionCard
              icon={ListChecks}
              title="Top findings"
              eyebrow="Highest priority"
              description="The most clinically consequential issues for this case."
              action={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportAuditAsPDF(analysis, patientLabel)}>
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportAuditAsCSV(analysis, patientLabel)}>
                    <FileDown className="h-3.5 w-3.5" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAnalysis(null)}>New review</Button>
                </div>
              }
            >
              <div className="space-y-3">
                {topIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
              </div>
            </SectionCard>
          )}

          {expanded && (
            <>
              <SectionCard icon={Sparkles} title="Score breakdown" eyebrow="Why this score" description="Each score includes a one-line clinical rationale.">
                <div className="grid gap-6 sm:grid-cols-4">
                  {scoreRows.map((s) => (
                    <div key={s.key} className="flex flex-col items-center gap-2 text-center">
                      <ScoreGauge label={s.label} score={Number(s.value)} />
                      {rationales[s.key] && (
                        <p className="text-xs leading-snug text-muted-foreground">{rationales[s.key]}</p>
                      )}
                    </div>
                  ))}
                </div>
                {rationales.overall_trust && (
                  <div className="mt-5 flex items-start gap-2 rounded-md border border-border bg-surface-muted/40 p-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Overall trust rationale</div>
                      <p className="mt-0.5 text-sm">{rationales.overall_trust}</p>
                    </div>
                  </div>
                )}
              </SectionCard>

              <Group title="Safety & Red flags" icon={ShieldAlert} open={openGroups.safety} onToggle={() => toggleGroup("safety")}>
                {analysis.red_flag_checklist?.items?.length > 0 && (
                  <div className="mb-6">
                    <SubHeading icon={ListChecks} title="Red-flag checklist" />
                    <RedFlagChecklist
                      scenario={analysis.red_flag_checklist.scenario}
                      items={analysis.red_flag_checklist.items}
                    />
                  </div>
                )}
                <div className="mb-6">
                  <SubHeading icon={ShieldAlert} title="Surfaced red flags (filtered for relevance)" />
                  {(analysis.red_flags ?? []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No clinically relevant red-flag gaps detected.</div>
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
                </div>
                <div>
                  <SubHeading icon={AlertTriangle} title="Risk impact" />
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
                </div>
              </Group>

              <Group title="Reasoning & Bias" icon={Brain} open={openGroups.reasoning} onToggle={() => toggleGroup("reasoning")}>
                <div className="mb-6">
                  <SubHeading icon={Brain} title="Clinical reasoning" />
                  <p className="mb-4 text-sm text-foreground/80">{analysis.clinical_reasoning?.summary}</p>
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
                </div>

                <div className="mb-6">
                  <SubHeading icon={Eye} title="Cognitive bias detection" />
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
                </div>

                <div>
                  <SubHeading icon={Sparkles} title="Pattern recognition" />
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
                </div>
              </Group>

              <Group title="Guidelines & Standards" icon={BookMarked} open={openGroups.guidelines} onToggle={() => toggleGroup("guidelines")}>
                <div className="mb-6">
                  <SubHeading icon={BookMarked} title="Guideline cross-reference" />
                  <GuidelineMatchPanel refs={analysis.guideline_references ?? []} />
                </div>
                <div>
                  <SubHeading icon={Target} title="Gold-standard check" />
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
                </div>
              </Group>

              <SectionCard icon={ListChecks} title="All issues" eyebrow="Prioritized findings">
                <div className="space-y-3">
                  {visibleIssues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
                </div>
                {hiddenCount > 0 && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="ghost" size="sm" onClick={() => setShowAllIssues((v) => !v)} className="gap-1.5 text-xs">
                      {showAllIssues
                        ? <>Collapse to top {ISSUE_CAP}</>
                        : <>+ {hiddenCount} additional lower-priority finding{hiddenCount === 1 ? "" : "s"}</>}
                    </Button>
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SubHeading({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-accent" />
      {title}
    </h3>
  );
}

function Group({
  title, icon: Icon, open, onToggle, children,
}: {
  title: string; icon: any; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <section className="paper-card overflow-hidden p-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-surface-muted/40"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-accent" />
              <h2 className="font-display text-lg font-semibold">{title}</h2>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-6 py-5">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}