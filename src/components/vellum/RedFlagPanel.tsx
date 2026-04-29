import { Flag } from "lucide-react";

const STATUS: Record<string, string> = {
  missed: "border-critical/40 bg-critical/5 text-critical",
  addressed: "border-pass/40 bg-pass/5 text-pass",
  not_applicable: "border-border bg-surface text-tertiary",
};

export default function RedFlagPanel({ findings }: { findings: any[] | null | undefined }) {
  if (!findings || findings.length === 0) return null;
  const missed = findings.filter((f) => f.status === "missed");
  const addressed = findings.filter((f) => f.status === "addressed");
  return (
    <section className="vellum-panel">
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-3.5 w-3.5 text-critical" />
          <span className="font-heading text-xs uppercase tracking-wider">Context-aware red flag screen</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest">
          {missed.length > 0 && <span className="text-critical">{missed.length} missed</span>}
          <span className="text-pass">{addressed.length} addressed</span>
        </div>
      </div>

      <div className="p-5 space-y-2">
        {missed.map((f, i) => (
          <div key={`m-${i}`} className={`border rounded-sm p-3 ${STATUS.missed}`}>
            <div className="flex items-center justify-between">
              <div className="font-heading text-xs text-foreground">{f.label}</div>
              <span className="font-mono text-[9px] uppercase">MISSED</span>
            </div>
            <div className="text-[11px] text-foreground/80 mt-1">
              <span className="text-tertiary">Why it matters:</span> {f.why_it_matters}
            </div>
            {f.suggested_addition && (
              <div className="mt-1.5 text-[11px] text-accent">
                → Suggested note addition: <span className="text-foreground/90 italic">"{f.suggested_addition}"</span>
              </div>
            )}
          </div>
        ))}
        {addressed.length > 0 && (
          <details className="mt-2">
            <summary className="font-mono text-[10px] uppercase tracking-widest text-tertiary cursor-pointer hover:text-foreground">
              Show {addressed.length} addressed flags
            </summary>
            <ul className="mt-2 space-y-1">
              {addressed.map((f, i) => (
                <li key={`a-${i}`} className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-pass" />
                  {f.label}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}