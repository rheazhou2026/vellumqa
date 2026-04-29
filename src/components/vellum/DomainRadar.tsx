import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

const ACCENT = "#5E6AD2";

// 10 evaluation domains, mapped to evaluation_runs columns where available.
// The four extras (Medico-Legal Exposure already exists; Reviewability via reviewability_index;
// Evaluator Confidence via evaluator_confidence; Longitudinal Consistency has no direct column,
// so we approximate it with trust_score smoothness — fall back to trust_score average).
const DOMAINS: { key: string; label: string; col: keyof Row | "longitudinal" }[] = [
  { key: "source_faithfulness", label: "Source Faithfulness", col: "source_faithfulness_index" },
  { key: "differential_integrity", label: "Differential Integrity", col: "differential_integrity_score" },
  { key: "guideline_concordance", label: "Guideline Concordance", col: "guideline_concordance_score" },
  { key: "omission_hazard", label: "Omission Hazard", col: "omission_hazard_score" },
  { key: "patient_safety_escalation", label: "Patient Safety Escalation", col: "patient_safety_escalation_score" },
  { key: "uncertainty_calibration", label: "Uncertainty Calibration", col: "uncertainty_calibration_score" },
  { key: "medico_legal_exposure", label: "Medico-Legal Exposure", col: "medico_legal_exposure_score" },
  { key: "reviewability", label: "Reviewability", col: "reviewability_index" },
  { key: "evaluator_confidence", label: "Evaluator Confidence", col: "evaluator_confidence" },
  { key: "longitudinal_consistency", label: "Longitudinal Consistency", col: "longitudinal" },
];

type Row = {
  completed_at: string;
  trust_score: number | null;
  source_faithfulness_index: number | null;
  omission_hazard_score: number | null;
  guideline_concordance_score: number | null;
  differential_integrity_score: number | null;
  patient_safety_escalation_score: number | null;
  uncertainty_calibration_score: number | null;
  medico_legal_exposure_score: number | null;
  reviewability_index: number | null;
  evaluator_confidence: number | null;
};

// Start of ISO week (Monday) at 00:00 local time
function startOfIsoWeek(d: Date) {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // 0=Mon
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - day);
  return dt;
}

function avg(vals: (number | null | undefined)[]) {
  const xs = vals.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Approximate longitudinal consistency: 100 minus the std-dev of trust scores
function longitudinalScore(rows: Row[]) {
  const xs = rows.map((r) => r.trust_score).filter((v): v is number => typeof v === "number");
  if (xs.length < 2) return xs[0] ?? null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
  const sd = Math.sqrt(variance);
  return Math.max(0, Math.min(100, 100 - sd));
}

function aggregate(rows: Row[]) {
  return DOMAINS.map((d) => {
    let v: number | null;
    if (d.col === "longitudinal") v = longitudinalScore(rows);
    else v = avg(rows.map((r) => r[d.col as keyof Row] as number | null));
    return { domain: d.label, score: v == null ? null : Math.round(v) };
  });
}

const PLACEHOLDER_CURRENT = DOMAINS.map((d) => ({ domain: d.label, score: 70 }));
const PLACEHOLDER_PRIOR = DOMAINS.map((d) => ({ domain: d.label, score: 60 }));

export default function DomainRadar() {
  const [current, setCurrent] = useState<Row[]>([]);
  const [prior, setPrior] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const startCurrent = startOfIsoWeek(new Date());
      const startPrior = new Date(startCurrent); startPrior.setDate(startPrior.getDate() - 7);
      const cols = "completed_at, trust_score, source_faithfulness_index, omission_hazard_score, guideline_concordance_score, differential_integrity_score, patient_safety_escalation_score, uncertainty_calibration_score, medico_legal_exposure_score, reviewability_index, evaluator_confidence";
      const [c, p] = await Promise.all([
        supabase.from("evaluation_runs").select(cols).gte("completed_at", startCurrent.toISOString()),
        supabase.from("evaluation_runs").select(cols).gte("completed_at", startPrior.toISOString()).lt("completed_at", startCurrent.toISOString()),
      ]);
      setCurrent((c.data as Row[]) ?? []);
      setPrior((p.data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const { data, isPlaceholder } = useMemo(() => {
    if (current.length === 0 && prior.length === 0) {
      const merged = DOMAINS.map((d, i) => ({
        domain: d.label,
        current: PLACEHOLDER_CURRENT[i].score,
        prior: PLACEHOLDER_PRIOR[i].score,
      }));
      return { data: merged, isPlaceholder: true };
    }
    const cAgg = aggregate(current);
    const pAgg = aggregate(prior);
    const merged = DOMAINS.map((d, i) => ({
      domain: d.label,
      current: cAgg[i].score ?? 0,
      prior: pAgg[i].score ?? 0,
    }));
    return { data: merged, isPlaceholder: false };
  }, [current, prior]);

  return (
    <section className="vellum-panel p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">Domain score radar</div>
          <h2 className="font-display text-2xl mt-1">Week-over-week evaluation profile</h2>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
          {loading ? "Loading…" : `${current.length} this week · ${prior.length} prior`}
        </div>
      </div>

      <div className="h-[420px]">
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="78%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="domain"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
              stroke="hsl(var(--border))"
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
            />
            <Radar
              name="Prior week"
              dataKey="prior"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="none"
            />
            <Radar
              name="Current week"
              dataKey="current"
              stroke={ACCENT}
              strokeWidth={2}
              fill={ACCENT}
              fillOpacity={0.4}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />
          Current week
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-6 border-t-2 border-dashed border-muted-foreground" />
          Prior week
        </span>
      </div>

      {isPlaceholder && (
        <div className="text-center mt-2 font-mono text-[10px] uppercase tracking-widest text-tertiary">
          Sample data — no evaluations yet
        </div>
      )}
    </section>
  );
}
