import { BookOpen } from "lucide-react";
import { EvidenceQuote } from "@/components/vellum/EvidenceTrace";

const STATUS: Record<string, { tone: string; label: string }> = {
  aligned: { tone: "text-pass border-pass/40 bg-pass/5", label: "ALIGNED" },
  partial: { tone: "text-moderate border-moderate/40 bg-moderate/5", label: "PARTIAL" },
  missing: { tone: "text-high border-high/40 bg-high/5", label: "MISSING" },
  contradicted: { tone: "text-critical border-critical/40 bg-critical/5", label: "CONTRADICTED" },
};

export default function GuidelineMatchPanel({ matches }: { matches: any[] | null | undefined }) {
  if (!matches || matches.length === 0) return null;
  const grouped = matches.reduce<Record<string, any[]>>((acc, m) => {
    const k = m.guideline ?? "Other";
    (acc[k] ||= []).push(m);
    return acc;
  }, {});
  return (
    <section className="vellum-panel">
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-accent" />
          <span className="font-heading text-xs uppercase tracking-wider">Guideline-aware QA</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
          {matches.length} cross-references
        </span>
      </div>
      <div className="p-5 space-y-4">
        {Object.entries(grouped).map(([g, items]) => (
          <div key={g}>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{g}</div>
            <ul className="space-y-1.5">
              {items.map((m, i) => {
                const s = STATUS[m.status] ?? STATUS.missing;
                return (
                  <li key={i} className={`border rounded-sm p-2.5 ${s.tone}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-heading text-xs flex-1">{m.recommendation}</div>
                      <span className="font-mono text-[9px]">{s.label}</span>
                    </div>
                    {m.evidence_quote && (
                      <div className="mt-1.5 text-[11px]">
                        <EvidenceQuote quote={m.evidence_quote} prefer="note" />
                      </div>
                    )}
                    {m.suggestion && (
                      <div className="mt-1 text-[11px] text-accent">→ {m.suggestion}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}