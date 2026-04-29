import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/vellum/PageHeader";
import NewEncounterDialog from "@/components/vellum/NewEncounterDialog";
import TrustScorePill from "@/components/vellum/TrustScorePill";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Search } from "lucide-react";

type Row = {
  id: string;
  encounter_date: string;
  specialty: string;
  visit_type: string | null;
  chief_complaint: string | null;
  ai_vendor: string | null;
  trust_score: number | null;
  critical_failures: string[];
  artifact_status: string | null;
};

export default function Encounters() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [sort, setSort] = useState<"date" | "trust">("date");

  async function load() {
    setLoading(true);
    const { data: encs } = await supabase
      .from("encounters")
      .select("id, encounter_date, specialty, visit_type, chief_complaint, ai_vendor")
      .order("encounter_date", { ascending: false })
      .limit(200);
    if (!encs) { setRows([]); setLoading(false); return; }

    const ids = encs.map((e) => e.id);
    const [{ data: runs }, { data: arts }] = await Promise.all([
      supabase.from("evaluation_runs").select("encounter_id, trust_score, critical_failures, completed_at").in("encounter_id", ids),
      supabase.from("note_artifacts").select("encounter_id, status").in("encounter_id", ids),
    ]);
    const runByEnc = new Map<string, any>();
    (runs ?? []).forEach((r: any) => {
      const prev = runByEnc.get(r.encounter_id);
      if (!prev || new Date(r.completed_at) > new Date(prev.completed_at)) runByEnc.set(r.encounter_id, r);
    });
    const artByEnc = new Map<string, string>();
    (arts ?? []).forEach((a: any) => artByEnc.set(a.encounter_id, a.status));

    setRows(encs.map((e) => ({
      ...e,
      trust_score: runByEnc.get(e.id)?.trust_score ?? null,
      critical_failures: runByEnc.get(e.id)?.critical_failures ?? [],
      artifact_status: artByEnc.get(e.id) ?? null,
    })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("encounters-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluation_runs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (specialty !== "all") r = r.filter((x) => x.specialty === specialty);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        (x.chief_complaint ?? "").toLowerCase().includes(q) ||
        (x.ai_vendor ?? "").toLowerCase().includes(q) ||
        x.id.toLowerCase().includes(q),
      );
    }
    r = [...r].sort((a, b) => {
      if (sort === "trust") return (a.trust_score ?? 999) - (b.trust_score ?? 999);
      return +new Date(b.encounter_date) - +new Date(a.encounter_date);
    });
    return r;
  }, [rows, search, specialty, sort]);

  const specialties = useMemo(() => Array.from(new Set(rows.map((r) => r.specialty))).sort(), [rows]);

  return (
    <div>
      <PageHeader
        eyebrow="Console / Encounters"
        title="Encounter ledger"
        description="Every patient encounter with an AI-generated artifact, sortable by specialty, trust score, and reviewer status."
        actions={<NewEncounterDialog onCreated={load} />}
      />

      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
            <Input
              placeholder="Search by complaint, vendor, encounter ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-surface border-border"
            />
          </div>
          <Select value={specialty} onValueChange={setSpecialty}>
            <SelectTrigger className="w-[200px] bg-surface border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All specialties</SelectItem>
              {specialties.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="w-[180px] bg-surface border-border">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Most recent</SelectItem>
              <SelectItem value="trust">Lowest trust score</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="vellum-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border bg-sidebar/40">
                <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary px-4 py-3">Encounter</th>
                <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary px-4 py-3">Specialty</th>
                <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary px-4 py-3">Chief complaint</th>
                <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary px-4 py-3">Vendor</th>
                <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary px-4 py-3">Trust</th>
                <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary px-4 py-3">Crit</th>
                <th className="font-mono text-[10px] uppercase tracking-widest text-tertiary px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-xs">Loading encounters…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No encounters yet. Click <span className="text-foreground">New encounter</span> to ingest one.
                </td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-sidebar/30 transition">
                  <td className="px-4 py-3">
                    <Link to={`/encounters/${r.id}`} className="font-mono text-xs text-accent hover:text-accent-hover">
                      ENC-{r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.specialty.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-xs truncate max-w-[260px]">{r.chief_complaint ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{r.ai_vendor ?? "—"}</td>
                  <td className="px-4 py-3"><TrustScorePill score={r.trust_score} /></td>
                  <td className="px-4 py-3">
                    {r.critical_failures.length > 0 ? (
                      <span className="font-mono text-[11px] text-critical">{r.critical_failures.length}</span>
                    ) : <span className="text-tertiary text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    {new Date(r.encounter_date).toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}