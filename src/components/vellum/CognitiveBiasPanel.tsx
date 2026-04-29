import { Lightbulb } from "lucide-react";
import { EvidenceQuote } from "@/components/vellum/EvidenceTrace";

const LABELS: Record<string, string> = {
  premature_closure: "Premature closure",
  anchoring: "Anchoring bias",
  availability: "Availability bias",
  confirmation: "Confirmation bias",
  framing: "Framing effect",
  search_satisficing: "Search satisficing",
};

export default function CognitiveBiasPanel({ biases }: { biases: any[] | null | undefined }) {
  if (!biases || biases.length === 0) return null;
  return (
    <section className="vellum-panel">
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-accent" />
          <span className="font-heading text-xs uppercase tracking-wider">Cognitive bias detection</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-high">
          {biases.length} detected
        </span>
      </div>
      <div className="p-5 space-y-3">
        {biases.map((b, i) => (
          <div key={i} className="border border-high/30 bg-high/5 rounded-sm p-3">
            <div className="font-heading text-xs text-foreground">{LABELS[b.bias] ?? b.bias}</div>
            <div className="text-[11px] text-foreground/80 mt-1">{b.explanation}</div>
            {b.evidence_quote && (
              <div className="mt-1.5 text-[11px]">
                <EvidenceQuote quote={b.evidence_quote} prefer="note" />
              </div>
            )}
            {b.remediation && (
              <div className="mt-1.5 text-[11px] text-accent">→ {b.remediation}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}