import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";
import { AlertTriangle, Activity, FileCheck2, AlertOctagon, CircleSlash } from "lucide-react";

type Kpi = { label: string; value: string; trend?: string; icon: React.ComponentType<{ className?: string }>; tone?: "default" | "critical" | "high" | "moderate" | "pass" };

export default function Dashboard() {
  const [stats, setStats] = useState({ encounters: 0, criticals: 0, evaluations: 0, guidelines: 0, criteria: 0 });

  useEffect(() => {
    (async () => {
      const [enc, crit, evals, gl, cr] = await Promise.all([
        supabase.from("encounters").select("*", { count: "exact", head: true }),
        supabase.from("risk_events").select("*", { count: "exact", head: true }).eq("severity", "S5"),
        supabase.from("evaluation_runs").select("*", { count: "exact", head: true }),
        supabase.from("guideline_sources").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("rubric_criteria").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        encounters: enc.count ?? 0,
        criticals: crit.count ?? 0,
        evaluations: evals.count ?? 0,
        guidelines: gl.count ?? 0,
        criteria: cr.count ?? 0,
      });
    })();
  }, []);

  const kpis: Kpi[] = [
    { label: "Avg Trust Score", value: "—", icon: Activity },
    { label: "Critical Flags", value: String(stats.criticals), icon: AlertOctagon, tone: "critical" },
    { label: "Evaluations Run", value: String(stats.evaluations), icon: FileCheck2 },
    { label: "Hallucination Rate", value: "—", icon: AlertTriangle, tone: "high" },
    { label: "Omission Rate", value: "—", icon: CircleSlash, tone: "moderate" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Console / Overview"
        title="Dashboard"
        description="Independent clinical AI trust monitoring across all evaluated encounters."
      />

      <div className="p-6 space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-border border border-border rounded-sm overflow-hidden">
          {kpis.map((k) => {
            const Icon = k.icon;
            const toneClass =
              k.tone === "critical" ? "text-critical"
              : k.tone === "high" ? "text-high"
              : k.tone === "moderate" ? "text-moderate"
              : k.tone === "pass" ? "text-pass"
              : "text-foreground";
            return (
              <div key={k.label} className="bg-surface p-5">
                <div className="flex items-center justify-between">
                  <div className="font-heading text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {k.label}
                  </div>
                  <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
                </div>
                <div className={`font-display text-4xl mt-3 ${toneClass}`}>{k.value}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mt-2">
                  7d trend pending
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 vellum-panel p-6 min-h-[320px]">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="font-heading text-xs uppercase tracking-wider text-muted-foreground">90-Day Trust Score</div>
                <h2 className="font-display text-2xl mt-1">Multi-specialty trend</h2>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">CHART</div>
            </div>
            <StubPanel title="Trust score time-series" description="Multi-series Recharts line chart by specialty, annotated with model and guideline update events. Wires up after the first batch of evaluations is recorded." status="WIRES NEXT" />
          </div>
          <div className="lg:col-span-2 vellum-panel p-6 min-h-[320px]">
            <div className="font-heading text-xs uppercase tracking-wider text-muted-foreground mb-1">Live Risk Events</div>
            <h2 className="font-display text-2xl mb-4">Critical activity</h2>
            <StubPanel title="Realtime risk feed" description="Subscribes to risk_events via Supabase Realtime — color-coded severity, encounter ID, action required." status="REALTIME WIRED" />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <StubPanel title="Domain Score Radar" description="All 10 evaluation domains, current week vs prior week overlay." />
          <StubPanel title="Specialty Performance" description="Horizontal bars by specialty, sorted worst-first to highlight where review attention is needed." />
          <StubPanel title="Critical Failure Types" description="Top 6 never-event categories from criterion_results, donut visualization." />
        </div>

        <div className="vellum-panel">
          <div className="px-6 py-4 border-b border-border flex items-baseline justify-between">
            <div>
              <div className="font-heading text-xs uppercase tracking-wider text-muted-foreground">Pending Review Queue</div>
              <h2 className="font-display text-xl mt-1">Awaiting clinician adjudication</h2>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">QUEUE</div>
          </div>
          <div className="p-6 text-sm text-muted-foreground">
            No assignments yet. Once encounters are evaluated and routed, they appear here.
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <Stat label="Encounters" value={stats.encounters} />
          <Stat label="Active Guidelines" value={stats.guidelines} />
          <Stat label="Rubric Criteria" value={stats.criteria} />
          <Stat label="Evaluations" value={stats.evaluations} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-sm px-4 py-3 bg-surface">
      <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}