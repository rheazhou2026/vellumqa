import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";

type Slice = { key: string; label: string; color: string; count: number };

const CATEGORIES: { key: string; label: string; color: string; matches: RegExp }[] = [
  { key: "disposition", label: "Disposition Safety", color: "#FF3B30", matches: /disposition|discharge|admit/i },
  { key: "life_threat", label: "Life-Threatening Differential", color: "#FF6B35", matches: /life.?threat|differential|red.?flag|stemi|sepsis|stroke/i },
  { key: "negation", label: "Negation Inversion", color: "#FFB800", matches: /negation|inversion|opposite|denied/i },
  { key: "suicidality", label: "Suicidality Omission", color: "#8B5CF6", matches: /suicid|self.?harm|si\b|ideation/i },
  { key: "med_fab", label: "Medication Fabrication", color: "#3B82F6", matches: /med(ication)?.?(fab|hallucin|invented)|drug.?fab/i },
  { key: "consent_fab", label: "Consent Fabrication", color: "#EC4899", matches: /consent.?(fab|hallucin|invented|missing)/i },
];

const PLACEHOLDER: Record<string, number> = {
  disposition: 12, life_threat: 9, negation: 7, suicidality: 5, med_fab: 4, consent_fab: 3,
};

type Row = { criterion_id: string | null };

export default function CriticalFailureTypes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("criterion_results")
        .select("criterion_id")
        .eq("result", "critical_fail")
        .gte("created_at", since.toISOString());
      setRows((data as any[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const { slices, total, isPlaceholder } = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));
    for (const r of rows) {
      const id = r.criterion_id ?? "";
      const match = CATEGORIES.find((c) => c.matches.test(id));
      if (match) counts[match.key] += 1;
    }
    const real = CATEGORIES.map<Slice>((c) => ({ key: c.key, label: c.label, color: c.color, count: counts[c.key] }));
    const totalReal = real.reduce((a, b) => a + b.count, 0);
    if (totalReal === 0) {
      const placeholder = CATEGORIES.map<Slice>((c) => ({
        key: c.key, label: c.label, color: c.color, count: PLACEHOLDER[c.key],
      }));
      return {
        slices: placeholder.sort((a, b) => b.count - a.count),
        total: placeholder.reduce((a, b) => a + b.count, 0),
        isPlaceholder: true,
      };
    }
    return { slices: real.sort((a, b) => b.count - a.count), total: totalReal, isPlaceholder: false };
  }, [rows]);

  return (
    <section className="vellum-panel p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">Critical Failure Types</div>
          <h2 className="font-display text-2xl mt-1">Never-event categories</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
        </div>
        {isPlaceholder && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary">Sample data</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
        <div className="relative h-[260px] w-full">
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : (
            <>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="62%"
                    outerRadius="92%"
                    stroke="hsl(var(--surface))"
                    strokeWidth={2}
                    paddingAngle={1}
                  >
                    {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-display text-4xl text-foreground">{total}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mt-1">critical failures</div>
              </div>
            </>
          )}
        </div>

        <ul className="space-y-2 min-w-[220px]">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-foreground">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-mono text-muted-foreground">{s.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
