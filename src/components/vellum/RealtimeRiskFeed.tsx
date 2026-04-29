import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertOctagon, AlertTriangle, AlertCircle, Info, Radio } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type RiskEvent = {
  id: string;
  encounter_id: string | null;
  severity: string;
  event_type: string;
  description: string | null;
  action_taken: string | null;
  resolved: boolean;
  created_at: string;
};

const SEV_META: Record<string, { label: string; tone: string; Icon: any }> = {
  S5: { label: "CRITICAL", tone: "text-critical border-critical/40 bg-critical/10", Icon: AlertOctagon },
  S4: { label: "HIGH", tone: "text-high border-high/40 bg-high/10", Icon: AlertTriangle },
  S3: { label: "MODERATE", tone: "text-moderate border-moderate/40 bg-moderate/10", Icon: AlertCircle },
  S2: { label: "LOW", tone: "text-info border-info/40 bg-info/10", Icon: Info },
  S1: { label: "INFO", tone: "text-muted-foreground border-border bg-surface", Icon: Info },
};

export default function RealtimeRiskFeed() {
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("risk_events")
        .select("id, encounter_id, severity, event_type, description, action_taken, resolved, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setEvents((data as RiskEvent[]) ?? []);
    })();

    const ch = supabase
      .channel("dashboard-risk-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "risk_events" },
        (payload) => {
          setEvents((prev) => [payload.new as RiskEvent, ...prev].slice(0, 20));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "risk_events" },
        (payload) => {
          setEvents((prev) =>
            prev.map((e) => (e.id === (payload.new as RiskEvent).id ? (payload.new as RiskEvent) : e)),
          );
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-tertiary mb-2">
        <Radio className={`h-3 w-3 ${live ? "text-pass animate-pulse" : "text-muted-foreground"}`} />
        {live ? "Live · subscribed" : "Connecting…"}
      </div>
      {events.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-sm p-4">
          No risk events yet. Critical findings stream in here as evaluations complete.
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-[260px] overflow-auto pr-1">
          {events.map((e) => {
            const meta = SEV_META[e.severity] ?? SEV_META.S1;
            const Icon = meta.Icon;
            const inner = (
              <div className="flex items-start gap-2 p-2 rounded-sm bg-surface border border-border hover:border-accent/40 transition">
                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${meta.tone.split(" ")[0]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-mono text-[9px] px-1 py-0.5 rounded-sm border ${meta.tone}`}>
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate">
                      {e.event_type}
                    </span>
                    {e.resolved && (
                      <span className="font-mono text-[9px] text-pass uppercase">resolved</span>
                    )}
                  </div>
                  <div className="text-xs text-foreground mt-1 line-clamp-2">
                    {e.description ?? "—"}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-[10px] text-tertiary">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </span>
                    {e.action_taken && (
                      <span className="font-mono text-[10px] text-muted-foreground truncate ml-2">
                        → {e.action_taken}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
            return (
              <li key={e.id}>
                {e.encounter_id ? (
                  <Link to={`/encounters/${e.encounter_id}`}>{inner}</Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
