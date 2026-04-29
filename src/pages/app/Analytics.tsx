import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/vellum/PageHeader";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar,
} from "recharts";
import DomainRadar from "@/components/vellum/DomainRadar";
import SpecialtyPerformance from "@/components/vellum/SpecialtyPerformance";

const COLORS = ["hsl(var(--accent))", "hsl(var(--pass))", "hsl(var(--moderate))", "hsl(var(--high))", "hsl(var(--critical))"];

type Row = {
  completed_at: string;
  trust_score: number | null;
  guideline_matches: any[] | null;
  red_flag_findings: any[] | null;
  cognitive_biases: any[] | null;
  critical_failures: string[] | null;
  encounters: { specialty: string; ai_vendor: string | null } | null;
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export default function Analytics() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("evaluation_runs")
        .select("completed_at, trust_score, guideline_matches, red_flag_findings, cognitive_biases, critical_failures, encounters!inner(specialty, ai_vendor)")
        .order("completed_at", { ascending: true })
        .limit(500);
      setRows((data as any[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // Trust score over time, grouped per vendor
  const trustByVendor = useMemo(() => {
    const days = new Map<string, Record<string, { sum: number; n: number }>>();
    for (const r of rows) {
      if (r.trust_score == null) continue;
      const d = dayKey(r.completed_at);
      const v = r.encounters?.ai_vendor ?? "unknown";
      const day = days.get(d) ?? {};
      const cell = day[v] ?? { sum: 0, n: 0 };
      cell.sum += r.trust_score; cell.n += 1;
      day[v] = cell; days.set(d, day);
    }
    const vendors = Array.from(new Set(rows.map((r) => r.encounters?.ai_vendor ?? "unknown")));
    const series = Array.from(days.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, vmap]) => {
        const row: any = { date: d };
        vendors.forEach((v) => {
          row[v] = vmap[v] ? Math.round((vmap[v].sum / vmap[v].n) * 10) / 10 : null;
        });
        return row;
      });
    return { series, vendors };
  }, [rows]);

  // Issue categories by count
  const issueBreakdown = useMemo(() => {
    let crit = 0, missedFlags = 0, missingGuideline = 0, biases = 0;
    for (const r of rows) {
      crit += r.critical_failures?.length ?? 0;
      missedFlags += (r.red_flag_findings ?? []).filter((f: any) => f.status === "missed").length;
      missingGuideline += (r.guideline_matches ?? []).filter((g: any) => g.status === "missing" || g.status === "contradicted").length;
      biases += r.cognitive_biases?.length ?? 0;
    }
    return [
      { category: "Critical failures", count: crit },
      { category: "Missed red flags", count: missedFlags },
      { category: "Guideline misses", count: missingGuideline },
      { category: "Cognitive biases", count: biases },
    ];
  }, [rows]);

  // Per-vendor reliability table
  const vendorTable = useMemo(() => {
    const m = new Map<string, { n: number; sum: number; crit: number; flags: number; biases: number }>();
    for (const r of rows) {
      const v = r.encounters?.ai_vendor ?? "unknown";
      const cur = m.get(v) ?? { n: 0, sum: 0, crit: 0, flags: 0, biases: 0 };
      cur.n += 1;
      if (r.trust_score != null) cur.sum += r.trust_score;
      cur.crit += r.critical_failures?.length ?? 0;
      cur.flags += (r.red_flag_findings ?? []).filter((f: any) => f.status === "missed").length;
      cur.biases += r.cognitive_biases?.length ?? 0;
      m.set(v, cur);
    }
    return Array.from(m.entries()).map(([v, c]) => ({
      vendor: v,
      avgTrust: c.n ? Math.round((c.sum / c.n) * 10) / 10 : null,
      n: c.n,
      critRate: c.n ? Math.round((c.crit / c.n) * 100) / 100 : 0,
      flagRate: c.n ? Math.round((c.flags / c.n) * 100) / 100 : 0,
      biasRate: c.n ? Math.round((c.biases / c.n) * 100) / 100 : 0,
    })).sort((a, b) => (a.avgTrust ?? 0) - (b.avgTrust ?? 0));
  }, [rows]);

  // Reliability insights
  const insights = useMemo(() => {
    const out: string[] = [];
    if (vendorTable.length >= 2) {
      const worst = vendorTable[0];
      const best = vendorTable[vendorTable.length - 1];
      if (worst.avgTrust != null && best.avgTrust != null && best.avgTrust - worst.avgTrust >= 5) {
        out.push(`${worst.vendor} averages ${worst.avgTrust} trust vs ${best.vendor} at ${best.avgTrust} — investigate vendor-specific failure modes.`);
      }
    }
    const totals = issueBreakdown.reduce((a, b) => a + b.count, 0);
    if (totals > 0) {
      const top = [...issueBreakdown].sort((a, b) => b.count - a.count)[0];
      out.push(`${top.category} dominates issue volume (${top.count} of ${totals}). Prioritize remediation here.`);
    }
    if (trustByVendor.series.length >= 5) {
      const recent = trustByVendor.series.slice(-3);
      const prior = trustByVendor.series.slice(-6, -3);
      const avg = (xs: any[]) => {
        let s = 0, n = 0;
        xs.forEach((x) => Object.entries(x).forEach(([k, v]) => { if (k !== "date" && typeof v === "number") { s += v; n++; } }));
        return n ? s / n : null;
      };
      const r = avg(recent), p = avg(prior);
      if (r != null && p != null) {
        const delta = r - p;
        if (Math.abs(delta) >= 3) {
          out.push(`Trust score ${delta > 0 ? "improved" : "drifted down"} ${Math.abs(delta).toFixed(1)} pts over the last 3 days vs prior 3 days.`);
        }
      }
    }
    if (out.length === 0) out.push("Not enough data yet to surface reliability trends. Ingest more encounters to unlock insights.");
    return out;
  }, [vendorTable, issueBreakdown, trustByVendor]);

  return (
    <div>
      <PageHeader
        eyebrow="Console / Analytics"
        title="AI performance"
        description="Trust score, issue categories, and reliability trends across AI vendors and time."
      />
      <div className="p-6 space-y-6">
        {/* Insights */}
        <section className="vellum-panel p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-3">Reliability insights</div>
          <ul className="space-y-1.5 text-sm text-foreground/90">
            {insights.map((t, i) => <li key={i} className="flex gap-2"><span className="text-accent">›</span>{t}</li>)}
          </ul>
        </section>

        {/* Domain Score Radar */}
        <DomainRadar />

        {/* Specialty Performance */}
        <SpecialtyPerformance />

        {/* Trust over time */}
        <section className="vellum-panel p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">Trust score over time</div>
              <h2 className="font-display text-2xl mt-1">By AI source</h2>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">{rows.length} runs</div>
          </div>
          <div className="h-[280px]">
            {loading ? (
              <div className="text-muted-foreground text-sm">Loading…</div>
            ) : trustByVendor.series.length === 0 ? (
              <div className="text-muted-foreground text-sm">No evaluation runs yet.</div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={trustByVendor.series}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {trustByVendor.vendors.map((v, i) => (
                    <Line key={v} type="monotone" dataKey={v} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Issue categories */}
          <section className="vellum-panel p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-1">Issue categories</div>
            <h2 className="font-display text-xl mb-3">Failure mode mix</h2>
            <div className="h-[260px]">
              <ResponsiveContainer>
                <BarChart data={issueBreakdown}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Vendor table */}
          <section className="vellum-panel p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-1">Vendor reliability</div>
            <h2 className="font-display text-xl mb-3">Worst-first ranking</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary py-2">Vendor</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary py-2">Trust</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary py-2">Runs</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary py-2">Crit/run</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary py-2">Flags/run</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary py-2">Bias/run</th>
                </tr>
              </thead>
              <tbody>
                {vendorTable.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">No data yet.</td></tr>
                ) : vendorTable.map((v) => (
                  <tr key={v.vendor} className="border-b border-border last:border-0">
                    <td className="py-2 font-mono text-xs">{v.vendor}</td>
                    <td className="py-2 font-mono text-xs">{v.avgTrust ?? "—"}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{v.n}</td>
                    <td className="py-2 font-mono text-xs text-critical">{v.critRate}</td>
                    <td className="py-2 font-mono text-xs text-high">{v.flagRate}</td>
                    <td className="py-2 font-mono text-xs text-moderate">{v.biasRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}