import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, LabelList, Tooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

const SPECIALTIES = [
  "emergency_medicine", "psychiatry", "oncology", "cardiology",
  "primary_care", "surgery", "pediatrics", "critical_care",
];

const RED = "#FF3B30";
const YELLOW = "#FFB800";
const GREEN = "#30D158";
const GRAY = "hsl(var(--border))";

const PLACEHOLDER: Record<string, number> = {
  emergency_medicine: 58,
  psychiatry: 62,
  oncology: 65,
  cardiology: 71,
  primary_care: 74,
  surgery: 78,
  pediatrics: 82,
  critical_care: 85,
};

function pretty(s: string) {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function colorFor(score: number, hasData: boolean) {
  if (!hasData) return GRAY;
  if (score < 50) return RED;
  if (score < 80) return YELLOW;
  return GREEN;
}

type Row = { trust_score: number | null; encounters: { specialty: string | null } | null };

export default function SpecialtyPerformance() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("evaluation_runs")
        .select("trust_score, encounters!inner(specialty)")
        .not("trust_score", "is", null);
      setRows((data as any[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const { data, isPlaceholder } = useMemo(() => {
    const sums = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      const s = r.encounters?.specialty;
      if (!s || r.trust_score == null) continue;
      const cur = sums.get(s) ?? { sum: 0, n: 0 };
      cur.sum += r.trust_score; cur.n += 1;
      sums.set(s, cur);
    }
    const placeholder = sums.size === 0;
    const arr = SPECIALTIES.map((key) => {
      const c = sums.get(key);
      const hasData = !!c && c.n > 0;
      const score = placeholder
        ? PLACEHOLDER[key]
        : hasData ? Math.round((c!.sum / c!.n) * 10) / 10 : 0;
      return {
        key,
        label: pretty(key),
        score,
        hasData: placeholder ? true : hasData,
        displayScore: placeholder
          ? PLACEHOLDER[key].toString()
          : hasData ? String(score) : "No data",
      };
    }).sort((a, b) => a.score - b.score);
    return { data: arr, isPlaceholder: placeholder };
  }, [rows]);

  return (
    <section className="vellum-panel p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">Specialty Performance</div>
          <h2 className="font-display text-2xl mt-1">Avg Trust Score</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Sorted worst-first</p>
        </div>
        {isPlaceholder && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary">Sample data</span>
        )}
      </div>

      <div className="h-[360px]">
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : (
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
              barCategoryGap={10}
            >
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--surface-muted) / 0.4)" }}
                contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(_v: any, _n: any, p: any) => [p.payload.displayScore, "Trust"]}
              />
              <Bar dataKey="score" radius={[3, 3, 3, 3]} background={{ fill: "hsl(var(--surface-muted) / 0.35)" }}>
                {data.map((d) => (
                  <Cell key={d.key} fill={colorFor(d.score, d.hasData)} />
                ))}
                <LabelList
                  dataKey="displayScore"
                  position="right"
                  className="fill-foreground"
                  style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
