import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

const SPECIALTY_COLORS: Record<string, string> = {
  emergency: "#FF3B30",
  oncology: "#8B5CF6",
  cardiology: "#FF6B35",
  psychiatry: "#3B82F6",
  pediatrics: "#10B981",
  internal_medicine: "#FFB800",
  other: "#94A3B8",
};

type Point = { day: string } & Record<string, number | string | null>;

export default function TrustScoreTimeSeries() {
  const [data, setData] = useState<Point[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data: rows } = await supabase
        .from("evaluation_runs")
        .select("trust_score, completed_at, encounter:encounters(specialty)")
        .gte("completed_at", since.toISOString())
        .not("trust_score", "is", null)
        .order("completed_at", { ascending: true });

      const real = (rows ?? []) as any[];
      if (real.length === 0) {
        const { points, specs } = generatePlaceholder();
        setData(points);
        setSpecialties(specs);
        setIsPlaceholder(true);
      } else {
        const buckets = new Map<string, Map<string, number[]>>();
        const specSet = new Set<string>();
        for (const r of real) {
          const day = String(r.completed_at).slice(0, 10);
          const spec = r.encounter?.specialty ?? "other";
          specSet.add(spec);
          if (!buckets.has(day)) buckets.set(day, new Map());
          const inner = buckets.get(day)!;
          if (!inner.has(spec)) inner.set(spec, []);
          inner.get(spec)!.push(Number(r.trust_score));
        }
        const days = Array.from(buckets.keys()).sort();
        const points: Point[] = days.map((day) => {
          const inner = buckets.get(day)!;
          const p: Point = { day };
          for (const s of specSet) {
            const arr = inner.get(s);
            p[s] = arr && arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;
          }
          return p;
        });
        setData(points);
        setSpecialties(Array.from(specSet));
        setIsPlaceholder(false);
      }
      setLoading(false);
    })();
  }, []);

  const tickFmt = useMemo(() => (v: string) => v.slice(5), []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading trend…</div>;

  return (
    <div className="h-[260px] w-full">
      {isPlaceholder && (
        <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-1">Sample data</div>
      )}
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="day" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" width={32} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", fontSize: 11 }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
          {specialties.map((s) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={SPECIALTY_COLORS[s] ?? "#94A3B8"}
              strokeWidth={1.75}
              dot={false}
              connectNulls
              name={s.replace("_", " ")}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function generatePlaceholder() {
  const specs = ["emergency", "oncology", "cardiology", "psychiatry"];
  const days: Point[] = [];
  const now = new Date();
  const base: Record<string, number> = { emergency: 78, oncology: 82, cardiology: 85, psychiatry: 74 };
  for (let i = 89; i >= 0; i -= 3) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const p: Point = { day: d.toISOString().slice(0, 10) };
    for (const s of specs) {
      base[s] = Math.max(55, Math.min(95, base[s] + (Math.random() - 0.5) * 4));
      p[s] = +base[s].toFixed(1);
    }
    days.push(p);
  }
  return { points: days, specs };
}
