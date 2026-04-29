import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type FailureKind = "omission_hazard" | "true_negation" | "other" | "passing";

/**
 * Distinguishes:
 *  - "Omission hazard": something present in source is MISSING from the note
 *    (e.g. penicillin allergy in EHR but not documented in note).
 *  - "True negation": the note actively asserts the OPPOSITE of source
 *    (e.g. "no chest pain" when source says chest pain present).
 *  - "Other": failures that don't fit either bucket (hallucinations, format).
 */
export function classifyFailure(criterion: {
  result?: string;
  explanation?: string | null;
  criterion_id?: string | null;
  name?: string | null;
}): FailureKind {
  if (criterion.result === "pass") return "passing";
  const txt = `${criterion.criterion_id ?? ""} ${criterion.name ?? ""} ${criterion.explanation ?? ""}`.toLowerCase();
  const omissionSignals = /\b(missing|omitted|absent|not documented|not mentioned|not listed|not in (the )?note|left out|undocumented|fail(ed)? to (note|document|mention)|no mention)\b/;
  const negationSignals = /\b(invert|inverted|inversion|contradict|contradicted|opposite|reversed|negated|denies .*? but|stated as.*?(positive|negative|absent|present)|wrong (direction|sign))\b/;
  if (negationSignals.test(txt)) return "true_negation";
  if (omissionSignals.test(txt)) return "omission_hazard";
  return "other";
}

const META: Record<FailureKind, { label: string; tone: string; tip: string }> = {
  omission_hazard: {
    label: "Omission hazard",
    tone: "bg-critical/10 text-critical border-critical/30",
    tip: "Information present in the source (transcript / EHR / labs) is missing from the note. Distinct from a true negation — nothing was actively asserted as false; the gap itself is the safety risk.",
  },
  true_negation: {
    label: "True negation",
    tone: "bg-high/10 text-high border-high/30",
    tip: "The note actively asserts the OPPOSITE of what the source says (e.g. denies a symptom that the patient reported). The note is wrong, not just incomplete.",
  },
  other: {
    label: "Other failure",
    tone: "bg-muted text-muted-foreground border-border",
    tip: "Failure that is neither an omission nor a negation (e.g. hallucination, format, scoring).",
  },
  passing: { label: "", tone: "", tip: "" },
};

export default function CriterionFailureKindBadge({
  criterion,
}: {
  criterion: { result?: string; explanation?: string | null; criterion_id?: string | null; name?: string | null };
}) {
  const kind = classifyFailure(criterion);
  if (kind === "passing") return null;
  const meta = META[kind];
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border font-mono text-[9px] uppercase tracking-wider cursor-help ${meta.tone}`}
          >
            {meta.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-[11px]">
          {meta.tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}