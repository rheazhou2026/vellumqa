import { useMemo, useState } from "react";
import { ShieldCheck, ChevronDown, Copy, Check } from "lucide-react";

/**
 * Auto-suggested safe plan.
 *
 * When an encounter looks like febrile neutropenia (oncology / chemo +
 * fever, OR the rubric flagged ONC_NEUTROPENIC_FEVER_001, OR the AI note
 * recommends unsafe outpatient management for a chemo patient with fever),
 * surface a guideline-aligned admission + cultures + empiric antibiotic
 * plan that the clinician can copy into the chart in one click.
 *
 * This is a *suggestion* — Vellum never edits the original AI note.
 */

type Detect = {
  trigger: boolean;
  reasons: string[];
  unsafeOutpatient: boolean;
};

function detectFebrileNeutropenia(args: {
  specialty?: string | null;
  chiefComplaint?: string | null;
  sourceText?: string | null;
  noteText?: string | null;
  criticalFailures?: string[] | null;
}): Detect {
  const reasons: string[] = [];
  const cc = (args.chiefComplaint ?? "").toLowerCase();
  const src = (args.sourceText ?? "").toLowerCase();
  const note = (args.noteText ?? "").toLowerCase();
  const blob = `${cc}\n${src}\n${note}`;
  const cfs = (args.criticalFailures ?? []).map((s) => String(s).toLowerCase());

  const ruleHit = cfs.some((c) => c.includes("onc_neutropenic_fever") || c.includes("neutropenic fever"));
  if (ruleHit) reasons.push("Rubric flagged ONC_NEUTROPENIC_FEVER_001.");

  const fever =
    /\bfever\b|\bfebrile\b|\btemp(erature)?\s*(?:of\s*)?(?:3[89]|40|101|102|103|104)/i.test(blob) ||
    /\bt\s*max\b|\btmax\b/i.test(blob);
  const chemo =
    /\bchemo(therapy)?\b|\bcycle\s*\d/i.test(blob) ||
    /\b(folfox|folfiri|r-chop|chop|carboplatin|cisplatin|paclitaxel|docetaxel|doxorubicin|cyclophosphamide|fluorouracil|gemcitabine|etoposide)\b/i.test(blob) ||
    /\b(filgrastim|pegfilgrastim|neupogen|neulasta)\b/i.test(blob);
  const neutropenia = /\bneutropen(ia|ic)\b|\banc\b\s*(<|less than|of)?\s*(0\.?5|500|1\.?0|1000)?/i.test(blob);
  const oncology = (args.specialty ?? "").toLowerCase() === "oncology";

  if (fever && (chemo || neutropenia || oncology)) {
    if (!ruleHit) reasons.push("Source contains fever + chemotherapy/neutropenia signals.");
  }

  // Unsafe outpatient guidance heuristics
  const unsafePhrases = [
    /discharge(d)? home/,
    /home with (oral )?(antibiotics|abx)/,
    /reassur\w+ and discharge/,
    /follow.?up (in|with).{0,30}(clinic|primary|outpatient)/,
    /outpatient management/,
    /pcp follow.?up/,
    /no antibiotics indicated/,
    /symptomatic (treatment|management) only/,
  ];
  const unsafeOutpatient = unsafePhrases.some((re) => re.test(note));
  if (unsafeOutpatient && (fever || neutropenia) && (chemo || oncology || neutropenia)) {
    reasons.push("AI note recommends outpatient management for a febrile chemotherapy patient.");
  }

  const trigger = ruleHit || (fever && (chemo || neutropenia)) || (unsafeOutpatient && oncology && fever);
  return { trigger, reasons, unsafeOutpatient };
}

const SAFE_PLAN_TEXT = `SAFE PLAN — Febrile Neutropenia (NCCN / IDSA aligned)

Disposition
  • Admit. Do NOT discharge. High-risk febrile neutropenia is a medical emergency.
  • Reverse / protective isolation; neutropenic precautions.
  • Notify primary oncology team and on-call hospitalist / ID.

Workup (within 60 minutes of triage)
  • CBC with differential and ANC, CMP, lactate, LFTs, coagulation panel.
  • Blood cultures × 2 sets — one peripheral, one from each indwelling line lumen.
  • Urinalysis + urine culture.
  • Chest imaging (PA/lateral CXR; consider CT if persistent symptoms).
  • Cultures of any symptomatic site (sputum, stool, wound, CSF if indicated).

Empiric antibiotics (administer within 60 minutes — do NOT wait for ANC)
  • Monotherapy: cefepime 2 g IV q8h  OR
  • Piperacillin-tazobactam 4.5 g IV q6h  OR
  • Meropenem 1 g IV q8h (if prior resistant organisms / severe sepsis).
  • Add vancomycin if: hemodynamic instability, suspected catheter infection,
    skin/soft-tissue infection, severe mucositis, or prior MRSA colonization.
  • Add antifungal coverage if persistent fever > 4–7 days on broad-spectrum abx.

Supportive
  • IV fluids, antipyretics (acetaminophen — avoid NSAIDs).
  • Consider G-CSF (filgrastim) per oncology if expected prolonged neutropenia.
  • Strict I/Os, q4h vitals, sepsis re-eval.

Documentation
  • ANC value and time of antibiotic administration MUST be charted.
  • Time-to-antibiotic is a regulatory quality metric.`;

export default function SafePlanSuggestion(props: {
  specialty?: string | null;
  chiefComplaint?: string | null;
  sourceText?: string | null;
  noteText?: string | null;
  criticalFailures?: string[] | null;
}) {
  const detect = useMemo(() => detectFebrileNeutropenia(props), [props]);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!detect.trigger) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(SAFE_PLAN_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <section className="vellum-panel border-pass/40 bg-pass/[0.04]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-pass/30 text-left"
      >
        <ShieldCheck className="h-4 w-4 text-pass shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-heading text-xs uppercase tracking-wider text-pass">
            Auto-suggested safe plan · Febrile neutropenia
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
            NCCN / IDSA aligned · Replaces unsafe outpatient guidance with admission + cultures + empiric antibiotics
          </div>
        </div>
        {detect.unsafeOutpatient && (
          <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-critical/40 bg-critical/10 text-critical">
            Unsafe outpatient guidance detected
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {detect.reasons.length > 0 && (
            <ul className="text-[11px] text-foreground/80 space-y-0.5 list-disc pl-4">
              {detect.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}

          <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-surface border border-border rounded-sm p-3 text-foreground/90 max-h-[420px] overflow-auto">
{SAFE_PLAN_TEXT}
          </pre>

          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] text-muted-foreground">
              Suggestion only · Vellum does not modify the original AI note.
            </div>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-sm bg-pass/15 text-pass hover:bg-pass/25 border border-pass/30 transition"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy safe plan"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}