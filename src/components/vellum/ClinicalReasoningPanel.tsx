import { CheckCircle2, AlertTriangle, Brain } from "lucide-react";

const QUALITY_TONE: Record<string, string> = {
  excellent: "text-pass border-pass/40 bg-pass/5",
  adequate: "text-moderate border-moderate/40 bg-moderate/5",
  weak: "text-high border-high/40 bg-high/5",
  unsafe: "text-critical border-critical/40 bg-critical/5",
};

const SEV_TONE: Record<string, string> = {
  critical: "border-critical/40 bg-critical/5",
  high: "border-high/40 bg-high/5",
  moderate: "border-moderate/40 bg-moderate/5",
  low: "border-border bg-surface",
};

export default function ClinicalReasoningPanel({ run }: { run: any }) {
  if (!run?.reasoning_quality && !(run?.reasoning_strengths?.length || run?.reasoning_gaps?.length)) {
    return null;
  }
  const tone = QUALITY_TONE[run.reasoning_quality] ?? "text-foreground border-border";
  return (
    <section className="vellum-panel">
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-accent" />
          <span className="font-heading text-xs uppercase tracking-wider">Clinical reasoning analysis</span>
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5 rounded-sm ${tone}`}>
          {run.reasoning_quality ?? "—"}
        </span>
      </div>

      {run.reasoning_summary && (
        <p className="px-5 py-4 text-sm text-foreground/90 border-b border-border leading-relaxed">
          {run.reasoning_summary}
        </p>
      )}

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-pass mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" /> Strengths · {run.reasoning_strengths?.length ?? 0}
          </div>
          <ul className="space-y-2.5">
            {(run.reasoning_strengths ?? []).map((s: any, i: number) => (
              <li key={i} className="border-l-2 border-pass/50 pl-3">
                <div className="font-heading text-xs text-foreground">{s.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.detail}</div>
                {s.evidence_quote && (
                  <div className="mt-1 text-[11px] italic text-muted-foreground/80">"{s.evidence_quote}"</div>
                )}
              </li>
            ))}
            {!run.reasoning_strengths?.length && <li className="text-xs text-tertiary">None identified.</li>}
          </ul>
        </div>

        <div className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-high mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" /> Reasoning gaps · {run.reasoning_gaps?.length ?? 0}
          </div>
          <ul className="space-y-2">
            {(run.reasoning_gaps ?? []).map((g: any, i: number) => (
              <li key={i} className={`border rounded-sm p-2.5 ${SEV_TONE[g.severity] ?? "border-border bg-surface"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-heading text-xs">{g.title}</div>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">{g.severity}</span>
                </div>
                <div className="text-[11px] text-foreground/80 mt-1">{g.detail}</div>
                {g.suggestion && (
                  <div className="mt-1.5 text-[11px] text-accent">→ {g.suggestion}</div>
                )}
              </li>
            ))}
            {!run.reasoning_gaps?.length && <li className="text-xs text-tertiary">No reasoning gaps detected.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}