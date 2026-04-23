import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/clinical/SectionCard";
import { Button } from "@/components/ui/button";
import { FileSearch, Layers, BookMarked, Activity, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const [recent, setRecent] = useState<any[]>([]);
  const [stats, setStats] = useState({ notes: 0, batches: 0, guidelines: 0, sources: 0 });

  useEffect(() => {
    (async () => {
      const [{ data: analyses }, { count: notesCount }, { count: batchesCount }, { count: glCount }, { count: srcCount }] = await Promise.all([
        supabase.from("note_analyses").select("id, top_clinical_risk, overall_trust_score, reasoning_rating, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("clinical_notes").select("id", { count: "exact", head: true }),
        supabase.from("batch_jobs").select("id", { count: "exact", head: true }),
        supabase.from("clinical_guidelines").select("id", { count: "exact", head: true }),
        supabase.from("ai_sources").select("id", { count: "exact", head: true }),
      ]);
      setRecent(analyses ?? []);
      setStats({
        notes: notesCount ?? 0,
        batches: batchesCount ?? 0,
        guidelines: glCount ?? 0,
        sources: srcCount ?? 0,
      });
    })();
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-accent">Overview</div>
          <h1 className="mt-2 font-display text-4xl font-semibold">Clinical QA workspace</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Audit individual notes or run a bulk batch. Every finding is cross-referenced
            against your saved clinical guidelines.
          </p>
        </div>
        <Link to="/app/review">
          <Button className="gap-2 bg-gradient-ink text-primary-foreground hover:opacity-90">
            New review <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Notes audited", value: stats.notes, icon: FileSearch, to: "/app/review" },
          { label: "Bulk batches", value: stats.batches, icon: Layers, to: "/app/bulk" },
          { label: "Guidelines", value: stats.guidelines, icon: BookMarked, to: "/app/guidelines" },
          { label: "AI sources", value: stats.sources, icon: Activity, to: "/app/sources" },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="paper-card p-5 transition-all hover:shadow-elevated">
            <s.icon className="h-5 w-5 text-accent" />
            <div className="mt-3 font-display text-3xl font-semibold">{s.value}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
          </Link>
        ))}
      </div>

      <SectionCard title="Recent audits" eyebrow="Activity">
        {recent.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No audits yet. <Link to="/app/review" className="text-accent underline-offset-4 hover:underline">Run your first review →</Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="line-clamp-2 font-medium text-foreground">{a.top_clinical_risk}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })} · Reasoning: {a.reasoning_rating}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold">{Math.round(Number(a.overall_trust_score))}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Trust</div>
                  </div>
                  <Link to={`/app/review/${a.id}`} className="text-sm text-accent">View</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}