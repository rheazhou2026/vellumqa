import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  FileText,
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

type DisclosureStatus = "compliant" | "flagged" | "exempt";

type Row = {
  evaluation_id: string;
  encounter_id: string;
  encounter_date: string;
  specialty: string;
  jurisdiction: string;
  reviewer: string;
  status: DisclosureStatus;
  trust_score: number | null;
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "compliant" | "flagged" | "exempt";
}) {
  const toneCls = {
    default: "text-foreground",
    compliant: "text-emerald-500",
    flagged: "text-critical",
    exempt: "text-muted-foreground",
  }[tone];
  return (
    <div className="vellum-panel p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
          {label}
        </div>
        <Icon className={`h-3.5 w-3.5 ${toneCls}`} />
      </div>
      <div className={`font-display text-3xl mt-2 ${toneCls}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: DisclosureStatus }) {
  const cfg = {
    compliant: { label: "Compliant", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
    flagged: { label: "Flagged", cls: "bg-critical/10 text-critical border-critical/30" },
    exempt: { label: "Exempt", cls: "bg-muted text-muted-foreground border-border" },
  }[status];
  return (
    <span
      className={`inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

function startOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function jurisdictionLabel(org: {
  jurisdiction: string | null;
  state_jurisdiction: string | null;
}) {
  const map: Record<string, string> = {
    US_FEDERAL: "US Federal",
    US_CA: "California",
    US_NY: "New York",
    US_TX: "Texas",
    US_FL: "Florida",
    OTHER: "Other",
  };
  if (!org.jurisdiction) return "—";
  if (org.jurisdiction === "OTHER") return org.state_jurisdiction || "Other";
  return map[org.jurisdiction] ?? org.jurisdiction;
}

export default function ConsentTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      // 1) Pull eval runs for this month with encounter join.
      const since = startOfMonthIso();
      const { data: runs, error } = await supabase
        .from("evaluation_runs")
        .select(
          `id, encounter_id, completed_at, auto_escalated, trust_score,
           encounters!inner (
             id, encounter_date, specialty, user_id, organization_id,
             organizations ( jurisdiction, state_jurisdiction )
           )`,
        )
        .gte("completed_at", since)
        .order("completed_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const list = (runs ?? []) as any[];
      if (list.length === 0) {
        setRows([]);
        return;
      }

      // 2) Find which evaluations have a clinician adjudication ⇒ exempt.
      const evalIds = list.map((r) => r.id);
      const { data: crits } = await supabase
        .from("criterion_results")
        .select("id, evaluation_run_id")
        .in("evaluation_run_id", evalIds);
      const critByEval = new Map<string, string[]>();
      for (const c of crits ?? []) {
        const arr = critByEval.get(c.evaluation_run_id) ?? [];
        arr.push(c.id);
        critByEval.set(c.evaluation_run_id, arr);
      }
      const allCritIds = (crits ?? []).map((c) => c.id);
      let adjudicatedEvalIds = new Set<string>();
      if (allCritIds.length > 0) {
        const { data: adjs } = await supabase
          .from("adjudications")
          .select("criterion_result_id")
          .in("criterion_result_id", allCritIds);
        const adjudicatedCrits = new Set((adjs ?? []).map((a) => a.criterion_result_id));
        for (const [evalId, ids] of critByEval) {
          if (ids.some((id) => adjudicatedCrits.has(id))) adjudicatedEvalIds.add(evalId);
        }
      }

      // 3) Resolve clinician reviewer display names.
      const userIds = Array.from(
        new Set(list.map((r) => r.encounters?.user_id).filter(Boolean) as string[]),
      );
      const reviewerMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: vu } = await supabase
          .from("vellum_users")
          .select("user_id, display_name, email")
          .in("user_id", userIds);
        for (const u of vu ?? []) {
          if (u.user_id) {
            reviewerMap.set(u.user_id, u.display_name || u.email || u.user_id.slice(0, 8));
          }
        }
        // Fallback to profiles if vellum_users missing.
        const missing = userIds.filter((id) => !reviewerMap.has(id));
        if (missing.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", missing);
          for (const p of profs ?? []) {
            if (p.user_id) reviewerMap.set(p.user_id, p.display_name || p.user_id.slice(0, 8));
          }
        }
      }

      const built: Row[] = list.map((r) => {
        const enc = r.encounters ?? {};
        const org = enc.organizations ?? {};
        let status: DisclosureStatus = "compliant";
        if (r.auto_escalated) status = "flagged";
        else if (adjudicatedEvalIds.has(r.id)) status = "exempt";
        return {
          evaluation_id: r.id,
          encounter_id: enc.id ?? r.encounter_id,
          encounter_date: enc.encounter_date ?? r.completed_at,
          specialty: enc.specialty ?? "—",
          jurisdiction: jurisdictionLabel(org),
          reviewer: reviewerMap.get(enc.user_id) ?? "—",
          status,
          trust_score: typeof r.trust_score === "number" ? r.trust_score : null,
        };
      });
      setRows(built);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load consent data.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    return {
      total: rows.length,
      compliant: rows.filter((r) => r.status === "compliant").length,
      exempt: rows.filter((r) => r.status === "exempt").length,
      flagged: rows.filter((r) => r.status === "flagged").length,
    };
  }, [rows]);

  function exportNdjson() {
    if (rows.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    const ndjson = rows
      .map((r) =>
        JSON.stringify({
          evaluation_id: r.evaluation_id,
          encounter_id: r.encounter_id,
          encounter_date: r.encounter_date,
          specialty: r.specialty,
          jurisdiction: r.jurisdiction,
          disclosure_status: r.status,
          clinician_reviewer: r.reviewer,
          trust_score: r.trust_score,
          exported_at: new Date().toISOString(),
        }),
      )
      .join("\n");
    const blob = new Blob([ndjson], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consent-disclosures-${new Date().toISOString().slice(0, 10)}.ndjson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} record(s).`);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="AI notes this month" value={stats.total} icon={FileText} />
        <StatCard
          label="Disclosure compliant"
          value={stats.compliant}
          icon={ShieldCheck}
          tone="compliant"
        />
        <StatCard
          label="Clinician-reviewed (exempt)"
          value={stats.exempt}
          icon={UserCheck}
          tone="exempt"
        />
        <StatCard label="Flagged" value={stats.flagged} icon={AlertTriangle} tone="flagged" />
      </div>

      <section className="vellum-panel">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-display text-base">Disclosure ledger</h3>
            <p className="text-[11px] text-muted-foreground">
              All AI-generated notes since the start of this month.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportNdjson}
            disabled={loading || rows.length === 0}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export NDJSON
          </Button>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="mx-auto h-10 w-10 rounded-sm border border-border flex items-center justify-center text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <div className="font-display text-base">No encounters yet this month.</div>
            <p className="text-[12px] text-muted-foreground">
              Disclosure tracking will populate after your first AI-generated note.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Encounter ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Disclosure Status</TableHead>
                <TableHead>Clinician Reviewer</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.evaluation_id}>
                  <TableCell className="font-mono text-[11px]">
                    {r.encounter_id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[12px]">
                    {new Date(r.encounter_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{r.specialty}</TableCell>
                  <TableCell className="text-muted-foreground">{r.jurisdiction}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.reviewer}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/encounters/${r.encounter_id}/eval`}>
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
    </div>
  );
}