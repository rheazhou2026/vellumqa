import { Sparkles, ChevronDown, ChevronUp, ShieldAlert, AlertOctagon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "./ScoreGauge";
import { ScoreEvidencePopover } from "./ScoreEvidencePopover";

interface Props {
  analysis: any;
  expanded: boolean;
  onToggle: () => void;
}

export function ExecutiveSummary({ analysis, expanded, onToggle }: Props) {
  const exec = analysis.executive_summary ?? {};
  const issues = analysis.issues ?? [];
  const criticalCount = exec.critical_count ?? issues.filter((i: any) => i.severity === "critical").length;
  const importantCount = exec.important_count ?? issues.filter((i: any) => i.severity === "important").length;
  const topRisk = exec.top_clinical_risk ?? analysis.top_clinical_risk;
  const headlineAction = exec.headline_action ?? "";
  const oneLiner = exec.one_liner ?? "";
  const rating = analysis.reasoning_rating ?? "—";
  const trust = Number(analysis.overall_trust_score ?? 0);
  const trustRationale = analysis.score_rationales?.overall_trust;
  const trustEvidence = analysis.score_evidence?.overall_trust;

  const ratingColor =
    rating === "Strong" ? "text-safe" :
    rating === "Adequate" ? "text-important" : "text-critical";

  return (
    <section className="paper-card overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[auto_1fr_auto] lg:items-stretch">
        <div className="flex flex-col items-center justify-center gap-2 border-b border-border bg-surface-muted/40 p-6 lg:border-b-0 lg:border-r">
          <ScoreEvidencePopover
            label="Trust"
            score={trust}
            size={112}
            rationale={trustRationale}
            evidence={trustEvidence}
          />
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Overall</div>
        </div>

        <div className="space-y-3 p-6">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Executive summary
          </div>
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Top clinical risk</div>
            <p className="font-display text-xl font-semibold leading-snug">{topRisk ?? "No risk identified"}</p>
          </div>
          {headlineAction && (
            <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-accent">Headline action</div>
              <p className="mt-0.5 text-sm font-medium">{headlineAction}</p>
            </div>
          )}
          {oneLiner && (
            <p className="text-sm italic text-muted-foreground">"{oneLiner}"</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-px bg-border lg:grid-cols-1 lg:bg-transparent lg:border-l lg:border-border">
          <Stat icon={AlertOctagon} value={criticalCount} label="Critical" tone="critical" />
          <Stat icon={AlertTriangle} value={importantCount} label="Important" tone="important" />
          <Stat
            icon={ShieldAlert}
            value={rating}
            label="Reasoning"
            tone="neutral"
            valueClassName={ratingColor}
          />
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-border bg-surface-muted/30 px-6 py-2.5">
        <Button variant="ghost" size="sm" onClick={onToggle} className="gap-1.5 text-xs">
          {expanded ? (
            <><ChevronUp className="h-3.5 w-3.5" /> Collapse full audit</>
          ) : (
            <><ChevronDown className="h-3.5 w-3.5" /> Expand full audit</>
          )}
        </Button>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon, value, label, tone, valueClassName,
}: {
  icon: any; value: any; label: string; tone: "critical" | "important" | "neutral"; valueClassName?: string;
}) {
  const tones = {
    critical: "text-critical bg-critical-soft/40",
    important: "text-important bg-important-soft/40",
    neutral: "text-foreground bg-background",
  } as const;
  return (
    <div className={`flex min-w-[120px] flex-col items-center justify-center gap-1 p-5 ${tones[tone]}`}>
      <Icon className="h-4 w-4 opacity-70" />
      <div className={`font-display text-3xl font-semibold ${valueClassName ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}