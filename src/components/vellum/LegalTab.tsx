import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
  Scale,
  ShieldAlert,
  FileSignature,
  Brain,
  ClipboardCheck,
  HomeIcon,
  GitBranch,
  Eye,
  Link2,
  FileBarChart,
  Download,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

type DimKey =
  | "consent"
  | "capacity"
  | "informed"
  | "discharge"
  | "deviation"
  | "review_trail"
  | "source_trace"
  | "coding";

const DIMENSIONS: Array<{
  key: DimKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** substrings (lowercased) that map a criterion_id to this dimension */
  match: string[];
}> = [
  { key: "consent", label: "Consent Risk", icon: FileSignature, match: ["consent"] },
  {
    key: "capacity",
    label: "Capacity Documentation",
    icon: Brain,
    match: ["capacity", "competen"],
  },
  {
    key: "informed",
    label: "Informed Decision Evidence",
    icon: ClipboardCheck,
    match: ["informed", "shared_decision", "risk_benefit"],
  },
  {
    key: "discharge",
    label: "Discharge Safety Net",
    icon: HomeIcon,
    match: ["disposition", "discharge", "return", "safety_net", "red_flag_return"],
  },
  {
    key: "deviation",
    label: "Guideline Deviation Docs",
    icon: GitBranch,
    match: ["guideline", "concordance", "deviation"],
  },
  {
    key: "review_trail",
    label: "Review Trail Completeness",
    icon: Eye,
    match: ["review", "adjudic", "overconfidence"],
  },
  {
    key: "source_trace",
    label: "Source Traceability",
    icon: Link2,
    match: [
      "source",
      "trace",
      "fabrication",
      "wrong_patient",
      "copy_forward",
      "section_contamination",
    ],
  },
  {
    key: "coding",
    label: "Coding Integrity",
    icon: FileBarChart,
    match: ["billing", "coding", "icd", "cpt"],
  },
];

const SEVERITY_WEIGHT: Record<string, number> = {
  S1: 0.4,
  S2: 0.7,
  S3: 1.0,
  S4: 1.6,
  S5: 2.4,
};

const RESULT_WEIGHT: Record<string, number> = {
  pass: 0,
  inconclusive: 0.3,
  fail: 1.0,
  critical_fail: 1.8,
};

function dimensionFor(criterionId: string | null | undefined): DimKey | null {
  if (!criterionId) return null;
  const id = criterionId.toLowerCase();
  for (const d of DIMENSIONS) {
    if (d.match.some((m) => id.includes(m))) return d.key;
  }
  return null;
}

type CritRow = {
  evaluation_run_id: string;
  criterion_id: string | null;
  severity: string | null;
  result: string | null;
  created_at: string;
};

type EncounterRow = {
  encounter_id: string;
  evaluation_run_id: string;
  specialty: string;
  exposure: number;
  topRisk: string;
  status: string;
};

function colorFor(score: number) {
  if (score >= 70) return "text-critical";
  if (score >= 40) return "text-amber-500";
  return "text-emerald-500";
}

function bandLabel(score: number) {
  if (score >= 70) return "High";
  if (score >= 40) return "Elevated";
  if (score > 0) return "Low";
  return "None";
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta > 2) return <ArrowUp className="h-3.5 w-3.5 text-critical" aria-label="rising" />;
  if (delta < -2)
    return <ArrowDown className="h-3.5 w-3.5 text-emerald-500" aria-label="falling" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-label="flat" />;
}

function GaugeCircle({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const circ = 2 * Math.PI * 70;
  const dash = (clamped / 100) * circ;
  return (
    <div className="relative flex items-center justify-center">
      <svg width={180} height={180} viewBox="0 0 180 180" className="-rotate-90">
        <circle
          cx={90}
          cy={90}
          r={70}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={12}
        />
        <circle
          cx={90}
          cy={90}
          r={70}
          fill="none"
          stroke="hsl(var(--critical))"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-5xl ${colorFor(clamped)}`}>
          {Math.round(clamped)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
          / 100 · ↑ worse
        </span>
      </div>
    </div>
  );
}

export default function LegalTab() {
  const [loading, setLoading] = useState(true);
  const [dimScores, setDimScores] = useState<Record<DimKey, number>>(
    () => Object.fromEntries(DIMENSIONS.map((d) => [d.key, 0])) as Record<DimKey, number>,
  );
  const [dimTrends, setDimTrends] = useState<Record<DimKey, number>>(
    () => Object.fromEntries(DIMENSIONS.map((d) => [d.key, 0])) as Record<DimKey, number>,
  );
  const [overall, setOverall] = useState(0);
  const [encounters, setEncounters] = useState<EncounterRow[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: runs, error } = await supabase
        .from("evaluation_runs")
        .select(
          `id, encounter_id, completed_at, auto_escalated, medico_legal_exposure_score,
           encounters!inner ( id, specialty )`,
        )
        .order("completed_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const runList = (runs ?? []) as any[];
      if (runList.length === 0) {
        setDimScores(Object.fromEntries(DIMENSIONS.map((d) => [d.key, 0])) as any);
        setDimTrends(Object.fromEntries(DIMENSIONS.map((d) => [d.key, 0])) as any);
        setOverall(0);
        setEncounters([]);
        return;
      }
      const runIds = runList.map((r) => r.id);

      const { data: crits } = await supabase
        .from("criterion_results")
        .select("evaluation_run_id, criterion_id, severity, result, created_at")
        .in("evaluation_run_id", runIds);
      const critList = (crits ?? []) as CritRow[];

      // ---- Aggregate dimension scores across all runs (current period) ----
      // Score per dimension = clamp( 100 * sum(severity * result) / sum(severity) , 0..100 )
      // (i.e. weighted hazard density). Empty dimensions = 0.
      const halfTs =
        runList.length > 1
          ? new Date(runList[Math.floor(runList.length / 2)].completed_at).getTime()
          : 0;

      function aggregate(filter: (c: CritRow) => boolean) {
        const num: Record<DimKey, number> = Object.fromEntries(
          DIMENSIONS.map((d) => [d.key, 0]),
        ) as any;
        const den: Record<DimKey, number> = Object.fromEntries(
          DIMENSIONS.map((d) => [d.key, 0]),
        ) as any;
        for (const c of critList) {
          if (!filter(c)) continue;
          const dim = dimensionFor(c.criterion_id);
          if (!dim) continue;
          const sev = SEVERITY_WEIGHT[c.severity ?? "S3"] ?? 1;
          const res = RESULT_WEIGHT[c.result ?? "pass"] ?? 0;
          num[dim] += sev * res;
          den[dim] += sev;
        }
        const out: Record<DimKey, number> = {} as any;
        for (const d of DIMENSIONS) {
          out[d.key] = den[d.key] > 0 ? Math.min(100, (num[d.key] / den[d.key]) * 100) : 0;
        }
        return out;
      }

      const scoresAll = aggregate(() => true);
      const scoresRecent = aggregate(
        (c) => new Date(c.created_at).getTime() >= halfTs,
      );
      const scoresPrior = aggregate(
        (c) => new Date(c.created_at).getTime() < halfTs,
      );
      const trends: Record<DimKey, number> = {} as any;
      for (const d of DIMENSIONS) {
        trends[d.key] = scoresRecent[d.key] - scoresPrior[d.key];
      }

      setDimScores(scoresAll);
      setDimTrends(trends);

      // Overall = mean of declared MLE scores when present, else mean of dims.
      const declared = runList
        .map((r) => r.medico_legal_exposure_score)
        .filter((v) => typeof v === "number");
      const overallScore =
        declared.length > 0
          ? declared.reduce((a: number, b: number) => a + b, 0) / declared.length
          : DIMENSIONS.reduce((a, d) => a + scoresAll[d.key], 0) / DIMENSIONS.length;
      setOverall(Math.max(0, Math.min(100, overallScore)));

      // ---- High-exposure encounter table ----
      const byRun = new Map<string, CritRow[]>();
      for (const c of critList) {
        const arr = byRun.get(c.evaluation_run_id) ?? [];
        arr.push(c);
        byRun.set(c.evaluation_run_id, arr);
      }
      const built: EncounterRow[] = runList.map((r) => {
        const cs = byRun.get(r.id) ?? [];
        // Per-encounter exposure: weighted hazard across all dims
        let num = 0;
        let den = 0;
        const dimSubScores: Record<DimKey, number> = Object.fromEntries(
          DIMENSIONS.map((d) => [d.key, 0]),
        ) as any;
        const dimDen: Record<DimKey, number> = Object.fromEntries(
          DIMENSIONS.map((d) => [d.key, 0]),
        ) as any;
        for (const c of cs) {
          const dim = dimensionFor(c.criterion_id);
          const sev = SEVERITY_WEIGHT[c.severity ?? "S3"] ?? 1;
          const res = RESULT_WEIGHT[c.result ?? "pass"] ?? 0;
          num += sev * res;
          den += sev;
          if (dim) {
            dimSubScores[dim] += sev * res;
            dimDen[dim] += sev;
          }
        }
        const declaredScore =
          typeof r.medico_legal_exposure_score === "number"
            ? Math.max(0, Math.min(100, r.medico_legal_exposure_score))
            : null;
        const exposure =
          declaredScore ?? (den > 0 ? Math.min(100, (num / den) * 100) : 0);

        // Top risk = dimension with highest sub-score
        let topDim: DimKey | null = null;
        let topVal = -1;
        for (const d of DIMENSIONS) {
          if (dimDen[d.key] === 0) continue;
          const v = (dimSubScores[d.key] / dimDen[d.key]) * 100;
          if (v > topVal) {
            topVal = v;
            topDim = d.key;
          }
        }
        const topRisk =
          topDim && topVal > 0
            ? DIMENSIONS.find((d) => d.key === topDim)!.label
            : "—";

        const status = r.auto_escalated
          ? "Escalated"
          : exposure >= 70
            ? "Review"
            : "Monitored";

        return {
          encounter_id: r.encounter_id,
          evaluation_run_id: r.id,
          specialty: r.encounters?.specialty ?? "—",
          exposure,
          topRisk,
          status,
        };
      });

      const sorted = built
        .filter((b) => b.exposure > 0)
        .sort((a, b) => b.exposure - a.exposure)
        .slice(0, 50);
      setEncounters(sorted);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load exposure data.");
    } finally {
      setLoading(false);
    }
  }

  const exportable = useMemo(
    () => encounters.length > 0 || overall > 0,
    [encounters, overall],
  );

  function exportLegalReview() {
    if (!exportable) {
      toast.error("Nothing to export.");
      return;
    }
    const payload = {
      generated_at: new Date().toISOString(),
      overall_exposure: Math.round(overall),
      dimensions: DIMENSIONS.map((d) => ({
        dimension: d.label,
        score: Math.round(dimScores[d.key]),
        trend_delta: Math.round(dimTrends[d.key] * 10) / 10,
        band: bandLabel(dimScores[d.key]),
      })),
      high_exposure_encounters: encounters.map((e) => ({
        encounter_id: e.encounter_id,
        specialty: e.specialty,
        exposure_score: Math.round(e.exposure),
        top_risk_factor: e.topRisk,
        status: e.status,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legal-exposure-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Legal review packet downloaded.");
  }

  return (
    <div className="space-y-6">
      {/* Header + export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-critical" />
          <h3 className="font-display text-base">Medico-Legal Exposure</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportLegalReview}
          disabled={loading || !exportable}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export for Legal Review
        </Button>
      </div>

      {loading ? (
        <div className="vellum-panel p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Computing exposure…
        </div>
      ) : (
        <>
          {/* Gauge */}
          <section className="vellum-panel p-6 grid md:grid-cols-[200px_1fr] gap-6 items-center">
            <GaugeCircle score={overall} />
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
                Composite exposure score
              </div>
              <div className={`font-display text-2xl ${colorFor(overall)}`}>
                {bandLabel(overall)} risk
              </div>
              <p className="text-[12px] text-muted-foreground max-w-xl">
                Hazard-weighted aggregate across the 8 dimensions below. Higher values indicate
                greater documentation and process risk if these encounters were challenged in a
                medico-legal proceeding.
              </p>
              <div className="flex gap-3 pt-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-emerald-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> 0–39 low
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-amber-500">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> 40–69 elevated
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-critical">
                  <span className="h-2 w-2 rounded-full bg-critical" /> 70+ high
                </span>
              </div>
            </div>
          </section>

          {/* 8-cell grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {DIMENSIONS.map((d) => {
              const score = dimScores[d.key];
              const trend = dimTrends[d.key];
              const Icon = d.icon;
              return (
                <div key={d.key} className="vellum-panel p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${colorFor(score)}`} />
                      <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
                        {d.label}
                      </div>
                    </div>
                    <TrendArrow delta={trend} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-display text-3xl ${colorFor(score)}`}>
                      {Math.round(score)}
                    </span>
                    <span className="font-mono text-[10px] text-tertiary">/100</span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                    {bandLabel(score)} ·{" "}
                    {trend > 2 ? "rising" : trend < -2 ? "falling" : "stable"}
                  </div>
                </div>
              );
            })}
          </section>

          {/* High-exposure encounters table */}
          <section className="vellum-panel">
            <header className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h4 className="font-display text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-critical" /> High-exposure encounters
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Sorted by exposure score, highest first. Top {encounters.length} shown.
                </p>
              </div>
            </header>
            {encounters.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No encounters with measurable exposure yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Encounter ID</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Exposure Score</TableHead>
                    <TableHead>Top Risk Factor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {encounters.map((e) => (
                    <TableRow key={e.evaluation_run_id}>
                      <TableCell className="font-mono text-[11px]">
                        {e.encounter_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{e.specialty}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-border overflow-hidden">
                            <div
                              className={`h-full ${
                                e.exposure >= 70
                                  ? "bg-critical"
                                  : e.exposure >= 40
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.max(2, Math.min(100, e.exposure))}%` }}
                            />
                          </div>
                          <span className={`font-mono text-[12px] ${colorFor(e.exposure)}`}>
                            {Math.round(e.exposure)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.topRisk}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${
                            e.status === "Escalated"
                              ? "bg-critical/10 text-critical border-critical/30"
                              : e.status === "Review"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {e.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/encounters/${e.encounter_id}/eval`}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  );
}