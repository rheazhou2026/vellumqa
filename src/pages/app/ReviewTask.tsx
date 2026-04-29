import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Check, X, CircleSlash, AlertTriangle, ArrowUpRight, FileText, Save, Send, ShieldAlert,
} from "lucide-react";
import PageHeader from "@/components/vellum/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import SeverityDot from "@/components/vellum/SeverityDot";
import CriterionFailureKindBadge from "@/components/vellum/CriterionFailureKindBadge";

type Adj = "agree" | "disagree" | "partial" | "escalate";

const ADJ_META: Record<Adj, { label: string; tone: string; Icon: any }> = {
  agree:    { label: "AGREE",    tone: "bg-pass/15 text-pass border-pass/40",         Icon: Check },
  disagree: { label: "DISAGREE", tone: "bg-critical/15 text-critical border-critical/40", Icon: X },
  partial:  { label: "PARTIAL",  tone: "bg-moderate/15 text-moderate border-moderate/40", Icon: CircleSlash },
  escalate: { label: "ESCALATE", tone: "bg-high/15 text-high border-high/40",         Icon: ArrowUpRight },
};

export default function ReviewTask() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState<null | "approved" | "edits" | "escalated">(null);

  const [assignment, setAssignment] = useState<any>(null);
  const [encounter, setEncounter] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [artifact, setArtifact] = useState<any>(null);
  const [run, setRun] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [criteriaMap, setCriteriaMap] = useState<Map<string, any>>(new Map());

  // adjudication state keyed by criterion_result_id
  const [decisions, setDecisions] = useState<Record<string, Adj>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [activeSource, setActiveSource] = useState<"transcript" | "ehr" | "labs">("transcript");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: a } = await supabase
        .from("reviewer_assignments")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!a) { setLoading(false); return; }
      setAssignment(a);

      const [{ data: enc }, { data: src }, { data: art }, { data: cm }] = await Promise.all([
        supabase.from("encounters").select("*").eq("id", a.encounter_id).maybeSingle(),
        supabase.from("encounter_sources").select("*").eq("encounter_id", a.encounter_id),
        supabase.from("note_artifacts").select("*").eq("encounter_id", a.encounter_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("rubric_criteria").select("criterion_id, name, severity_level, domain_id"),
      ]);
      setEncounter(enc);
      setSources(src ?? []);
      setArtifact(art ?? null);
      setCriteriaMap(new Map((cm ?? []).map((c: any) => [c.criterion_id, c])));

      const { data: r } = await supabase
        .from("evaluation_runs")
        .select("*")
        .eq("encounter_id", a.encounter_id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setRun(r);

      if (r) {
        const { data: cr } = await supabase
          .from("criterion_results")
          .select("*")
          .eq("evaluation_run_id", r.id);
        setResults(cr ?? []);

        // hydrate prior adjudications for this assignment
        const { data: priors } = await supabase
          .from("adjudications")
          .select("criterion_result_id, adjudication, reviewer_notes")
          .eq("assignment_id", id);
        const d: Record<string, Adj> = {};
        const n: Record<string, string> = {};
        for (const p of priors ?? []) {
          if (p.criterion_result_id && p.adjudication) {
            d[p.criterion_result_id] = p.adjudication as Adj;
            if (p.reviewer_notes) n[p.criterion_result_id] = p.reviewer_notes;
          }
        }
        setDecisions(d);
        setNotes(n);
      }
      setLoading(false);
    })();
  }, [id]);

  const sourceByType = useMemo(() => {
    const map: Record<string, string[]> = { transcript: [], ehr: [], labs: [] };
    for (const s of sources) {
      const t = (s.source_type ?? "transcript").toLowerCase();
      const target = map[t] ? t : "transcript";
      map[target].push(s.content ?? "");
    }
    return map;
  }, [sources]);

  const criticalFirst = useMemo(() => {
    const sevRank: Record<string, number> = { S5: 5, S4: 4, S3: 3, S2: 2, S1: 1, S0: 0 };
    return [...results].sort((a, b) => {
      const aFail = a.result !== "pass" ? 1 : 0;
      const bFail = b.result !== "pass" ? 1 : 0;
      if (aFail !== bFail) return bFail - aFail;
      return (sevRank[b.severity ?? ""] ?? 0) - (sevRank[a.severity ?? ""] ?? 0);
    });
  }, [results]);

  const decided = Object.keys(decisions).length;
  const failingCount = results.filter((r) => r.result !== "pass").length;
  const remaining = Math.max(0, failingCount - Object.keys(decisions).filter((k) => {
    const r = results.find((x) => x.id === k);
    return r && r.result !== "pass";
  }).length);

  function setDecision(rid: string, adj: Adj) {
    setDecisions((p) => ({ ...p, [rid]: adj }));
  }
  function setNote(rid: string, text: string) {
    setNotes((p) => ({ ...p, [rid]: text }));
  }

  async function saveDraft() {
    if (!id) return;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const reviewerId = userRes?.user?.id;
      if (!reviewerId) throw new Error("Not signed in");

      // delete prior + reinsert (simple upsert pattern given composite uniqueness isn't defined)
      await supabase.from("adjudications").delete().eq("assignment_id", id);
      const rows = Object.keys(decisions).map((rid) => ({
        assignment_id: id,
        reviewer_id: reviewerId,
        criterion_result_id: rid,
        adjudication: decisions[rid],
        reviewer_notes: notes[rid] ?? null,
      }));
      if (rows.length) {
        const { error } = await supabase.from("adjudications").insert(rows);
        if (error) throw error;
      }
      await supabase.from("reviewer_assignments").update({ status: "in_review" }).eq("id", id);
      toast.success(`Draft saved · ${rows.length} adjudications`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Couldn't save draft");
    } finally {
      setSaving(false);
    }
  }

  async function submit(kind: "approved" | "edits" | "escalated") {
    if (!id) return;
    setSubmitting(kind);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const reviewerId = userRes?.user?.id;
      if (!reviewerId) throw new Error("Not signed in");

      await supabase.from("adjudications").delete().eq("assignment_id", id);
      const rows = Object.keys(decisions).map((rid) => ({
        assignment_id: id,
        reviewer_id: reviewerId,
        criterion_result_id: rid,
        adjudication: decisions[rid],
        reviewer_notes: notes[rid] ?? null,
      }));
      if (rows.length) {
        const { error } = await supabase.from("adjudications").insert(rows);
        if (error) throw error;
      }

      const newStatus =
        kind === "escalated" ? "needs_escalation" : kind === "approved" ? "completed" : "in_review";
      await supabase
        .from("reviewer_assignments")
        .update({
          status: newStatus,
          completed_at: kind === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", id);

      // Audit + risk event for escalations
      if (kind === "escalated" && encounter) {
        await supabase.from("risk_events").insert({
          encounter_id: encounter.id,
          evaluation_run_id: run?.id ?? null,
          user_id: reviewerId,
          event_type: "reviewer_escalation",
          severity: "S4",
          description: `Reviewer escalated assignment ${id.slice(0, 8)}`,
        });
      }
      toast.success(
        kind === "approved" ? "Approved & finalized" :
        kind === "edits" ? "Edits requested" : "Escalated to compliance",
      );
      navigate("/review");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Submit failed");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="p-12 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading review task…
      </div>
    );
  }
  if (!assignment) {
    return (
      <div>
        <PageHeader eyebrow={`REVIEW TASK // ${id}`} title="Not found" description="No assignment with that ID." />
        <div className="p-6">
          <Link to="/review" className="font-mono text-xs text-accent">← back to review queue</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`REVIEW TASK // ${String(id).slice(0, 8).toUpperCase()}`}
        title="Adjudicate findings"
        description="Per-criterion AGREE / DISAGREE / PARTIAL with notes. Then approve, request edits, or escalate."
      />

      <div className="px-6 pt-4 pb-2 border-b border-border flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary">Encounter</span>
        <Link to={`/encounters/${assignment.encounter_id}`} className="font-mono text-xs text-accent hover:underline">
          {String(assignment.encounter_id).slice(0, 8)}↗
        </Link>
        {encounter?.specialty && (
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-surface border border-border text-muted-foreground uppercase">
            {encounter.specialty}
          </span>
        )}
        {encounter?.chief_complaint && (
          <span className="text-xs text-muted-foreground truncate">"{encounter.chief_complaint}"</span>
        )}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span><span className="font-mono text-foreground">{decided}</span> adjudicated</span>
          <span><span className="font-mono text-critical">{failingCount}</span> failures total</span>
          {run?.trust_score != null && (
            <span>Trust <span className="font-display text-base text-foreground">{Number(run.trust_score).toFixed(0)}</span></span>
          )}
        </div>
      </div>

      <div className="p-6 grid lg:grid-cols-3 gap-4 items-start">
        {/* Source Evidence */}
        <section className="vellum-panel">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="font-heading text-xs uppercase tracking-wider">Source evidence</div>
            <FileText className="h-3.5 w-3.5 text-tertiary" />
          </div>
          <div className="px-4 pt-3 flex gap-1 border-b border-border">
            {(["transcript", "ehr", "labs"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveSource(t)}
                className={`px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider border-b-2 -mb-px transition ${
                  activeSource === t ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t} {sourceByType[t].length > 0 && <span className="text-tertiary">·{sourceByType[t].length}</span>}
              </button>
            ))}
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto">
            {sourceByType[activeSource].length === 0 ? (
              <div className="text-xs text-muted-foreground">No {activeSource} content for this encounter.</div>
            ) : (
              sourceByType[activeSource].map((c, i) => (
                <pre key={i} className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90 border-b border-border/40 pb-3 mb-3 last:border-0">
                  {c}
                </pre>
              ))
            )}
          </div>
        </section>

        {/* AI Note */}
        <section className="vellum-panel">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="font-heading text-xs uppercase tracking-wider">AI note</div>
            {artifact?.artifact_type && (
              <span className="font-mono text-[10px] text-tertiary uppercase">{artifact.artifact_type}</span>
            )}
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto">
            {!artifact ? (
              <div className="text-xs text-muted-foreground">No AI note artifact attached.</div>
            ) : (
              <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                {artifact.raw_text ?? (typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content, null, 2))}
              </pre>
            )}
          </div>
        </section>

        {/* Adjudication */}
        <section className="vellum-panel">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="font-heading text-xs uppercase tracking-wider">Adjudication</div>
            <span className="font-mono text-[10px] text-tertiary">
              {decided}/{results.length}
            </span>
          </div>
          <div className="p-3 max-h-[70vh] overflow-auto space-y-2">
            {criticalFirst.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2">No criterion results to adjudicate yet.</div>
            ) : (
              criticalFirst.map((r) => {
                const meta = criteriaMap.get(r.criterion_id) ?? {};
                const decision = decisions[r.id];
                return (
                  <div key={r.id} className="border border-border rounded-sm p-2.5 bg-surface">
                    <div className="flex items-start gap-2">
                      <SeverityDot severity={r.severity ?? meta.severity_level ?? "S1"} />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10px] text-tertiary truncate">{r.criterion_id}</div>
                        <div className="text-xs text-foreground mt-0.5">{meta.name ?? r.criterion_id}</div>
                        {r.explanation && (
                          <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            {r.explanation}
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className={`font-mono text-[9px] px-1 py-0.5 rounded-sm border ${
                            r.result === "pass" ? "bg-pass/10 text-pass border-pass/30"
                            : r.result === "critical_fail" ? "bg-critical/10 text-critical border-critical/30"
                            : "bg-high/10 text-high border-high/30"
                          }`}>
                            {String(r.result ?? "—").toUpperCase()}
                          </span>
                          {r.result !== "pass" && (
                            <CriterionFailureKindBadge criterion={{ result: r.result, explanation: r.explanation, criterion_id: r.criterion_id, name: meta.name }} />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1 mt-2.5">
                      {(Object.keys(ADJ_META) as Adj[]).map((a) => {
                        const m = ADJ_META[a];
                        const Icon = m.Icon;
                        const active = decision === a;
                        return (
                          <button
                            key={a}
                            onClick={() => setDecision(r.id, a)}
                            className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-sm border font-mono text-[9px] uppercase tracking-wider transition ${
                              active ? m.tone : "border-border bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Icon className="h-2.5 w-2.5" />
                            {m.label}
                          </button>
                        );
                      })}
                    </div>

                    {decision && (
                      <Textarea
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNote(r.id, e.target.value)}
                        placeholder="Reviewer notes (optional)…"
                        className="mt-2 text-xs min-h-[60px] font-mono"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="px-3 py-3 border-t border-border space-y-2">
            <Button
              onClick={saveDraft}
              disabled={saving || !!submitting}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {saving ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Save className="h-3 w-3 mr-1.5" />}
              Save draft
            </Button>
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                onClick={() => submit("approved")}
                disabled={!!submitting || saving}
                size="sm"
                className="bg-pass/15 hover:bg-pass/25 text-pass border border-pass/40"
              >
                {submitting === "approved" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                Approve
              </Button>
              <Button
                onClick={() => submit("edits")}
                disabled={!!submitting || saving}
                size="sm"
                variant="outline"
              >
                {submitting === "edits" ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                Edits
              </Button>
              <Button
                onClick={() => submit("escalated")}
                disabled={!!submitting || saving}
                size="sm"
                className="bg-high/15 hover:bg-high/25 text-high border border-high/40"
              >
                {submitting === "escalated" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3 mr-1" />}
                Escalate
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
