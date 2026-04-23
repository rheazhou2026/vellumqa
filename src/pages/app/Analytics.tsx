import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/clinical/SectionCard";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { format, parseISO, startOfDay } from "date-fns";
import { Activity } from "lucide-react";

export default function Analytics() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      supabase.from("note_analyses").select("id, ai_source_id, overall_trust_score, safety_score, reasoning_score, issues, created_at").order("created_at"),
      supabase.from("ai_sources").select("id, name"),
    ]).then(([a, s]) => { setAnalyses(a.data ?? []); setSources(s.data ?? []); });
  }, []);

  const filtered = useMemo(() => selected === "all" ? analyses : analyses.filter(a => a.ai_source_id === selected), [analyses, selected]);

  const trend = useMemo(() => {
    const buckets = new Map<string, { trust: number[]; safety: number[]; reasoning: number[] }>();
    for (const a of filtered) {
      const day = format(startOfDay(parseISO(a.created_at)), "yyyy-MM-dd");
      const b = buckets.get(day) ?? { trust: [], safety: [], reasoning: [] };
      b.trust.push(Number(a.overall_trust_score) || 0);
      b.safety.push(Number(a.safety_score) || 0);
      b.reasoning.push(Number(a.reasoning_score) || 0);
      buckets.set(day, b);
    }
    return Array.from(buckets.entries()).sort().map(([day, b]) => ({
      day,
      trust: Math.round(b.trust.reduce((s, x) => s + x, 0) / b.trust.length),
      safety: Math.round(b.safety.reduce((s, x) => s + x, 0) / b.safety.length),
      reasoning: Math.round(b.reasoning.reduce((s, x) => s + x, 0) / b.reasoning.length),
    }));
  }, [filtered]);

  const issueDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of filtered) for (const i of a.issues ?? []) counts[i.category] = (counts[i.category] || 0) + 1;
    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  }, [filtered]);

  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.18em] text-accent">AI Performance</div>
        <h1 className="mt-2 font-display text-4xl font-semibold">Trends, regressions, reliability</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Aggregate trust scores and issue categories per AI source over time. Catch documentation
          trends and systemic failure modes after model updates.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setSelected("all")} className={`rounded-md border px-3 py-1.5 text-xs ${selected === "all" ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"}`}>All sources</button>
        {sources.map((s) => (
          <button key={s.id} onClick={() => setSelected(s.id)} className={`rounded-md border px-3 py-1.5 text-xs ${selected === s.id ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"}`}>{s.name}</button>
        ))}
      </div>

      <SectionCard icon={Activity} title="Trust trend" eyebrow="Daily averages">
        {trend.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No analyses yet for this filter.</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="trust" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="safety" stroke="hsl(var(--critical))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reasoning" stroke="hsl(var(--info))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Issue category distribution" eyebrow="Failure mode mix">
        {issueDist.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No issues recorded yet.</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={issueDist}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  );
}