import { useMemo, useState } from "react";
import { Pill, ChevronDown, ChevronRight } from "lucide-react";

// Heuristic medication name extractor. We deliberately avoid over-engineering;
// reviewers use this as a quick verification surface, not as a clinical NER.
const STOP = new Set([
  "the","and","for","with","from","this","that","have","has","was","were","not","but",
  "patient","reports","states","denies","history","exam","plan","assessment","mg","mcg","g","ml",
  "tablet","tablets","cap","caps","daily","bid","tid","qid","po","prn","every","hours","day","week",
]);
const COMMON_DRUG_HINTS =
  /\b([A-Z][a-z]{3,}(?:in|ol|ide|ate|ase|one|pril|sartan|statin|cillin|mycin|azole|prazole|olol|formin|parin|setron|vir))\b/g;
const EXPLICIT_DRUG_LIST = [
  // Common chronic / ED meds — high recall is more useful than precision here.
  "lisinopril","atorvastatin","metformin","amlodipine","aspirin","clopidogrel","apixaban","rivaroxaban",
  "warfarin","heparin","insulin","metoprolol","losartan","hydrochlorothiazide","furosemide",
  "albuterol","prednisone","ibuprofen","acetaminophen","tylenol","advil","omeprazole","pantoprazole",
  "sertraline","citalopram","fluoxetine","trazodone","gabapentin","levothyroxine","sitagliptin",
  "amoxicillin","azithromycin","ceftriaxone","vancomycin","nitroglycerin","morphine","fentanyl",
  "ondansetron","zofran","lorazepam","diazepam","alprazolam","clonazepam","tramadol","oxycodone",
];

function extractMeds(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const d of EXPLICIT_DRUG_LIST) {
    if (lower.includes(d)) found.add(d);
  }
  let m: RegExpExecArray | null;
  const re = new RegExp(COMMON_DRUG_HINTS.source, "g");
  while ((m = re.exec(text)) !== null) {
    const w = m[1].toLowerCase();
    if (!STOP.has(w) && w.length >= 5) found.add(w);
  }
  return Array.from(found).sort();
}

export default function MedReconciliationCompare({
  sourceText,
  noteText,
  defaultOpen = false,
}: {
  sourceText: string;
  noteText: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const { sourceMeds, noteMeds, missing, extra, both } = useMemo(() => {
    const s = new Set(extractMeds(sourceText));
    const n = new Set(extractMeds(noteText));
    const missing: string[] = [];
    const extra: string[] = [];
    const both: string[] = [];
    for (const d of s) (n.has(d) ? both : missing).push(d);
    for (const d of n) if (!s.has(d)) extra.push(d);
    return {
      sourceMeds: Array.from(s).sort(),
      noteMeds: Array.from(n).sort(),
      missing: missing.sort(),
      extra: extra.sort(),
      both: both.sort(),
    };
  }, [sourceText, noteText]);

  return (
    <div className="mt-2 border border-border rounded-sm bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/30 transition"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-tertiary" />
        ) : (
          <ChevronRight className="h-3 w-3 text-tertiary" />
        )}
        <Pill className="h-3 w-3 text-accent" />
        <span className="font-mono text-[10px] uppercase tracking-wider">Source vs note medications</span>
        <span className="ml-auto font-mono text-[10px]">
          <span className="text-pass">{both.length} match</span>
          <span className="text-tertiary"> · </span>
          <span className="text-critical">{missing.length} missing</span>
          <span className="text-tertiary"> · </span>
          <span className="text-moderate">{extra.length} extra</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 grid grid-cols-3 gap-3 text-[11px]">
          <Column title="In source" tone="text-tertiary" items={sourceMeds} />
          <Column
            title="Missing from note"
            tone="text-critical"
            items={missing}
            empty="None — all source meds appear in the note."
          />
          <Column
            title="In note only"
            tone="text-moderate"
            items={extra}
            empty="None — note adds nothing extra."
          />
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: string;
  items: string[];
  empty?: string;
}) {
  return (
    <div>
      <div className={`font-mono text-[9px] uppercase tracking-wider mb-1 ${tone}`}>{title}</div>
      {items.length === 0 ? (
        <div className="text-muted-foreground text-[10px]">{empty ?? "—"}</div>
      ) : (
        <ul className="space-y-0.5 max-h-32 overflow-auto">
          {items.map((m) => (
            <li key={m} className="font-mono text-foreground/90">· {m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}