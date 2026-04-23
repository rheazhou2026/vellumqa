import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Quote, Info } from "lucide-react";
import { ScoreGauge } from "./ScoreGauge";

interface EvidenceItem { quote: string; reason: string; }

interface Props {
  label: string;
  score: number;
  rationale?: string;
  evidence?: EvidenceItem[];
  size?: number;
}

export function ScoreEvidencePopover({ label, score, rationale, evidence, size = 88 }: Props) {
  const hasEvidence = (evidence?.length ?? 0) > 0 || !!rationale;

  const gauge = (
    <button
      type="button"
      className="group flex flex-col items-center gap-1 rounded-md p-1 transition-colors hover:bg-surface-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`${label} score evidence`}
    >
      <ScoreGauge label={label} score={Number(score)} size={size} />
      {hasEvidence && (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-accent opacity-60 group-hover:opacity-100">
          <Info className="h-3 w-3" />
          Why this score
        </span>
      )}
    </button>
  );

  if (!hasEvidence) {
    return <div className="flex flex-col items-center gap-1"><ScoreGauge label={label} score={Number(score)} size={size} /></div>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{gauge}</PopoverTrigger>
      <PopoverContent align="center" className="w-96 p-0">
        <div className="border-b border-border p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label} score deductions</div>
          {rationale && <p className="mt-1 text-sm font-medium">{rationale}</p>}
        </div>
        <div className="max-h-72 overflow-auto p-3">
          {evidence && evidence.length > 0 ? (
            <ul className="space-y-2.5">
              {evidence.map((e, i) => {
                const isAbsence = /not documented|absent|missing|no mention/i.test(e.quote);
                return (
                  <li key={i} className="rounded-sm border border-border bg-surface-muted/30 p-2.5">
                    <div className={`flex gap-1.5 text-xs ${isAbsence ? "text-critical" : "text-foreground"}`}>
                      <Quote className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
                      <span className={isAbsence ? "italic" : "italic"}>"{e.quote}"</span>
                    </div>
                    <p className="mt-1.5 border-l-2 border-accent/40 pl-2 text-xs text-muted-foreground">
                      {e.reason}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No specific evidence quotes were captured for this score.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
