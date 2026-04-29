import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

/**
 * Renders an evaluator confidence value with strict clamped formatting:
 *  - null/undefined → "—"
 *  - raw value in [0,1] → percent
 *  - raw value already in [0,100] → percent (handles model variance)
 *  - never displays "100%" unless raw === 1 (or raw >= 100). 0.99x renders as "99%".
 *  - never displays bare "1" as a confidence level.
 */
export function formatConfidence(val: unknown): string {
  if (val == null) return "—";
  const raw = Number(val);
  if (!Number.isFinite(raw)) return "—";
  // Treat anything <= 1 as a 0–1 fraction; otherwise it's already a percent.
  const pct = raw <= 1 ? raw * 100 : raw;
  if (pct >= 100) return raw === 1 || raw >= 100 ? "100%" : "99%";
  if (pct >= 99.5) return "99%"; // never silently round 99.7 → 100
  return `${Math.round(pct)}%`;
}

const LEGEND = [
  { range: "≥ 90%", meaning: "Strong, unambiguous evidence in source/note", tone: "text-pass" },
  { range: "70–89%", meaning: "Reasonable evidence; minor ambiguity", tone: "text-foreground" },
  { range: "50–69%", meaning: "Mixed signals — review recommended", tone: "text-moderate" },
  { range: "< 50%", meaning: "Weak evidence; treat output as low-confidence", tone: "text-high" },
];

export function ConfidenceLegend({ value, compact = false }: { value?: unknown; compact?: boolean }) {
  const display = formatConfidence(value);
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            <span className={compact ? "font-mono text-sm" : "font-display text-2xl"}>{display}</span>
            <Info className="h-3 w-3 text-tertiary" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5 text-tertiary">
            Evaluator confidence · 0–100%
          </div>
          <p className="text-[11px] mb-2 text-foreground/90">
            How sure the evaluator is about its own scoring. Never displayed as a bare “1” — values
            below 100% are always rendered as percentages. Only exact 1.0 (or 100) shows “100%”.
          </p>
          <ul className="space-y-1 text-[11px]">
            {LEGEND.map((l) => (
              <li key={l.range} className="flex items-baseline gap-2">
                <span className={`font-mono ${l.tone}`}>{l.range}</span>
                <span className="text-foreground/80">{l.meaning}</span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}