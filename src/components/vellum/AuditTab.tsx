import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  Edit,
  Download,
  Activity,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  FileDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type EventTypeKey =
  | "evaluation_completed"
  | "note_approved"
  | "critical_failure_detected"
  | "escalation_triggered"
  | "adjudication_recorded"
  | "export_generated";

const EVENT_TYPES: Record<
  EventTypeKey,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: string;
    iconColor: string;
  }
> = {
  evaluation_completed: {
    label: "Evaluation Completed",
    icon: Search,
    badge: "bg-accent/10 text-accent border-accent/30",
    iconColor: "text-accent",
  },
  note_approved: {
    label: "Note Approved",
    icon: CheckCircle,
    badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    iconColor: "text-emerald-500",
  },
  critical_failure_detected: {
    label: "Critical Failure Detected",
    icon: AlertTriangle,
    badge: "bg-critical/10 text-critical border-critical/30",
    iconColor: "text-critical",
  },
  escalation_triggered: {
    label: "Escalation Triggered",
    icon: ArrowUp,
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    iconColor: "text-amber-500",
  },
  adjudication_recorded: {
    label: "Adjudication Recorded",
    icon: Edit,
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    iconColor: "text-purple-400",
  },
  export_generated: {
    label: "Export Generated",
    icon: Download,
    badge: "bg-muted text-muted-foreground border-border",
    iconColor: "text-muted-foreground",
  },
};

function eventConfig(type: string) {
  return (
    EVENT_TYPES[type as EventTypeKey] ?? {
      label: type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: Activity,
      badge: "bg-muted text-muted-foreground border-border",
      iconColor: "text-muted-foreground",
    }
  );
}

type AuditRow = {
  id: string;
  occurred_at: string;
  event_type: string;
  user_id: string | null;
  encounter_id: string | null;
  event_data: Record<string, unknown> | null;
};

type EnrichedRow = AuditRow & {
  user_name: string;
  user_role: string;
};

const PAGE_SIZE = 25;

export default function AuditTab() {
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState<string>("all");
  const [encounterQuery, setEncounterQuery] = useState("");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_events")
        .select("id, occurred_at, event_type, user_id, encounter_id, event_data")
        .order("occurred_at", { ascending: false })
        .limit(2000);
      if (error) throw error;

      const list = (data ?? []) as AuditRow[];
      const userIds = Array.from(
        new Set(list.map((r) => r.user_id).filter(Boolean) as string[]),
      );

      const userMap = new Map<string, { name: string; role: string }>();
      if (userIds.length > 0) {
        const [{ data: vu }, { data: roles }] = await Promise.all([
          supabase
            .from("vellum_users")
            .select("user_id, display_name, email, vellum_role")
            .in("user_id", userIds),
          supabase
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", userIds),
        ]);
        const roleMap = new Map<string, string>();
        for (const r of roles ?? []) {
          // Prefer admin if present, else keep first role.
          if (r.role === "admin" || !roleMap.has(r.user_id)) {
            roleMap.set(r.user_id, r.role);
          }
        }
        for (const u of vu ?? []) {
          if (!u.user_id) continue;
          userMap.set(u.user_id, {
            name: u.display_name || u.email || u.user_id.slice(0, 8),
            role: roleMap.get(u.user_id) || u.vellum_role || "—",
          });
        }
        // Fallback for ids missing from vellum_users
        for (const id of userIds) {
          if (!userMap.has(id)) {
            userMap.set(id, { name: id.slice(0, 8), role: roleMap.get(id) || "—" });
          }
        }
      }

      const enriched: EnrichedRow[] = list.map((r) => ({
        ...r,
        user_name: r.user_id
          ? userMap.get(r.user_id)?.name ?? r.user_id.slice(0, 8)
          : "system",
        user_role: r.user_id ? userMap.get(r.user_id)?.role ?? "—" : "system",
      }));
      setRows(enriched);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load audit events.");
    } finally {
      setLoading(false);
    }
  }

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [eventType, encounterQuery, from, to]);

  const filtered = useMemo(() => {
    const q = encounterQuery.trim().toLowerCase();
    const fromTs = from ? new Date(from.setHours(0, 0, 0, 0)).getTime() : null;
    const toTs = to ? new Date(new Date(to).setHours(23, 59, 59, 999)).getTime() : null;
    return rows.filter((r) => {
      if (eventType !== "all" && r.event_type !== eventType) return false;
      if (q && !(r.encounter_id ?? "").toLowerCase().includes(q)) return false;
      const ts = new Date(r.occurred_at).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      return true;
    });
  }, [rows, eventType, encounterQuery, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function detailsSummary(row: EnrichedRow): string {
    const d = row.event_data ?? {};
    const keys = Object.keys(d);
    if (keys.length === 0) return "—";
    const preferred = ["summary", "trust_score", "outcome", "reason", "severity", "note"];
    const k = preferred.find((p) => p in d) ?? keys[0];
    const v = (d as Record<string, unknown>)[k];
    const str =
      typeof v === "string"
        ? v
        : typeof v === "number" || typeof v === "boolean"
          ? String(v)
          : JSON.stringify(v);
    return `${k}: ${str.length > 80 ? str.slice(0, 80) + "…" : str}`;
  }

  function clearFilters() {
    setEventType("all");
    setEncounterQuery("");
    setFrom(undefined);
    setTo(undefined);
  }

  async function exportPdf() {
    if (filtered.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    setExporting(true);
    try {
      const { pdf, Document, Page, Text, View, StyleSheet } = await import(
        "@react-pdf/renderer"
      );

      const styles = StyleSheet.create({
        page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica" },
        title: { fontSize: 16, marginBottom: 4, fontFamily: "Helvetica-Bold" },
        meta: { fontSize: 9, color: "#555", marginBottom: 12 },
        row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 4 },
        head: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#222", paddingBottom: 4, marginBottom: 2, fontFamily: "Helvetica-Bold" },
        c1: { width: "16%" },
        c2: { width: "14%" },
        c3: { width: "11%" },
        c4: { width: "19%" },
        c5: { width: "12%" },
        c6: { width: "28%" },
        footer: { position: "absolute", bottom: 14, left: 28, right: 28, fontSize: 7, color: "#777", textAlign: "center" },
      });

      const Doc = (
        <Document>
          <Page size="LETTER" orientation="landscape" style={styles.page}>
            <Text style={styles.title}>Vellum Audit Trail</Text>
            <Text style={styles.meta}>
              Exported {format(new Date(), "PPpp")} · {filtered.length} event(s)
              {eventType !== "all" ? ` · type=${eventType}` : ""}
              {encounterQuery ? ` · encounter~${encounterQuery}` : ""}
              {from ? ` · from ${format(from, "yyyy-MM-dd")}` : ""}
              {to ? ` · to ${format(to, "yyyy-MM-dd")}` : ""}
            </Text>
            <View style={styles.head}>
              <Text style={styles.c1}>Timestamp</Text>
              <Text style={styles.c2}>User</Text>
              <Text style={styles.c3}>Role</Text>
              <Text style={styles.c4}>Event Type</Text>
              <Text style={styles.c5}>Encounter</Text>
              <Text style={styles.c6}>Details</Text>
            </View>
            {filtered.map((r) => (
              <View key={r.id} style={styles.row} wrap={false}>
                <Text style={styles.c1}>
                  {format(new Date(r.occurred_at), "yyyy-MM-dd HH:mm:ss")}
                </Text>
                <Text style={styles.c2}>{r.user_name}</Text>
                <Text style={styles.c3}>{r.user_role}</Text>
                <Text style={styles.c4}>{eventConfig(r.event_type).label}</Text>
                <Text style={styles.c5}>
                  {r.encounter_id ? r.encounter_id.slice(0, 8) : "—"}
                </Text>
                <Text style={styles.c6}>{detailsSummary(r)}</Text>
              </View>
            ))}
            <Text
              style={styles.footer}
              render={({ pageNumber, totalPages }) =>
                `Vellum · Immutable audit ledger · Page ${pageNumber} of ${totalPages}`
              }
              fixed
            />
          </Page>
        </Document>
      );

      const blob = await pdf(Doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log the export itself as an audit event (best-effort).
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes?.user?.id) {
        await supabase.from("audit_events").insert({
          event_type: "export_generated",
          user_id: userRes.user.id,
          event_data: { artifact: "audit_trail_pdf", count: filtered.length },
        });
      }
      toast.success(`Exported ${filtered.length} event(s).`);
    } catch (e) {
      console.error(e);
      toast.error("PDF export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="vellum-panel p-4 grid gap-3 md:grid-cols-[200px_1fr_1fr_1fr_auto] items-end">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-mono tracking-widest text-tertiary">
            Event type
          </Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {(Object.keys(EVENT_TYPES) as EventTypeKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {EVENT_TYPES[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-mono tracking-widest text-tertiary">
            From
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal w-full",
                  !from && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {from ? format(from, "PPP") : <span>Any date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={from}
                onSelect={setFrom}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-mono tracking-widest text-tertiary">
            To
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal w-full",
                  !to && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {to ? format(to, "PPP") : <span>Any date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={to}
                onSelect={setTo}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-mono tracking-widest text-tertiary">
            Encounter ID
          </Label>
          <Input
            value={encounterQuery}
            onChange={(e) => setEncounterQuery(e.target.value)}
            placeholder="search by id…"
          />
        </div>

        <div className="flex gap-2">
          {(eventType !== "all" || encounterQuery || from || to) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={exportPdf}
            disabled={exporting || filtered.length === 0}
          >
            {exporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Building
              </>
            ) : (
              <>
                <FileDown className="h-3.5 w-3.5 mr-1.5" /> Export PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Table */}
      <section className="vellum-panel">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit ledger…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="mx-auto h-10 w-10 rounded-sm border border-border flex items-center justify-center text-muted-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div className="font-display text-base">No audit events match.</div>
            <p className="text-[12px] text-muted-foreground">
              Try widening your filters or clearing them entirely.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Encounter ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => {
                  const cfg = eventConfig(r.event_type);
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.occurred_at), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell>{r.user_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.user_role}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${cfg.badge}`}
                        >
                          <Icon className={`h-3 w-3 ${cfg.iconColor}`} />
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {r.encounter_id ? r.encounter_id.slice(0, 8) : "—"}
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground max-w-[320px] truncate">
                        {detailsSummary(r)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-[11px] font-mono text-muted-foreground">
              <span>
                Showing {page * PAGE_SIZE + 1}–
                {Math.min(filtered.length, (page + 1) * PAGE_SIZE)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span>
                  Page {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}