import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clinical/SectionCard";
import { toast } from "sonner";
import { Layers, Upload, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Item = { patient_label?: string | null; note_text: string };

function parseUpload(file: File): Promise<Item[]> {
  return new Promise((resolve, reject) => {
    const name = file.name.toLowerCase();
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    if (name.endsWith(".json")) {
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const arr = Array.isArray(raw) ? raw : raw.notes ?? [];
          resolve(
            arr
              .map((r: any) => ({
                patient_label: r.patient_label ?? r.patient ?? r.label ?? null,
                note_text: r.note_text ?? r.note ?? r.text ?? r.content ?? "",
              }))
              .filter((x: Item) => x.note_text && x.note_text.trim().length > 20),
          );
        } catch (e) { reject(e); }
      };
      reader.readAsText(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const rows = (res.data as any[]).map((r) => ({
            patient_label: r.patient_label ?? r.patient ?? r.label ?? null,
            note_text: r.note_text ?? r.note ?? r.text ?? r.content ?? "",
          })).filter((x: Item) => x.note_text && x.note_text.trim().length > 20);
          resolve(rows);
        },
        error: reject,
      });
    }
  });
}

export default function Bulk() {
  const { batchId } = useParams();
  const [batches, setBatches] = useState<any[]>([]);
  const [activeBatch, setActiveBatch] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const { data } = await supabase.from("batch_jobs").select("*").order("created_at", { ascending: false });
    setBatches(data ?? []);
  };
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!batchId) return;
    (async () => {
      const { data: b } = await supabase.from("batch_jobs").select("*").eq("id", batchId).maybeSingle();
      setActiveBatch(b);
      const { data: it } = await supabase.from("batch_job_items").select("*").eq("batch_id", batchId).order("position");
      setItems(it ?? []);
    })();
  }, [batchId, processing]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const rows = await parseUpload(file);
      if (rows.length === 0) { toast.error("No valid notes found in file"); return; }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: batch, error } = await supabase
        .from("batch_jobs")
        .insert({ user_id: u.user.id, label: file.name, total_items: rows.length, status: "pending" })
        .select()
        .single();
      if (error) throw error;
      const itemRows = rows.map((r, i) => ({
        batch_id: batch.id,
        user_id: u.user!.id,
        position: i,
        patient_label: r.patient_label,
        note_text: r.note_text,
      }));
      const { error: iErr } = await supabase.from("batch_job_items").insert(itemRows);
      if (iErr) throw iErr;
      toast.success(`Queued ${rows.length} notes from ${file.name}`);
      await refresh();
      window.history.pushState({}, "", `/app/bulk/${batch.id}`);
      setActiveBatch(batch);
      const { data: it } = await supabase.from("batch_job_items").select("*").eq("batch_id", batch.id).order("position");
      setItems(it ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const runBatch = async () => {
    if (!activeBatch) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-batch", { body: { batchId: activeBatch.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Processed ${data.processed} notes (${data.failed} failed)`);
      await refresh();
      const { data: b } = await supabase.from("batch_jobs").select("*").eq("id", activeBatch.id).maybeSingle();
      setActiveBatch(b);
      const { data: it } = await supabase.from("batch_job_items").select("*").eq("batch_id", activeBatch.id).order("position");
      setItems(it ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Processing failed"); }
    finally { setProcessing(false); }
  };

  const summary = activeBatch?.aggregate_summary;

  return (
    <div className="space-y-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.18em] text-accent">Bulk Processing</div>
        <h1 className="mt-2 font-display text-4xl font-semibold">Queue, audit, aggregate</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Upload a CSV (column <code className="font-mono">note_text</code>) or JSON array of notes.
          The queue processes sequentially and produces a high-level summary report.
        </p>
      </header>

      <SectionCard icon={Upload} title="Upload notes" eyebrow="CSV or JSON">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2 bg-gradient-ink text-primary-foreground hover:opacity-90">
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</> : <>Choose file</>}
          </Button>
          <span className="text-xs text-muted-foreground">CSV columns recognized: note_text, patient_label · or JSON array of {`{ note_text, patient_label }`}.</span>
        </div>
      </SectionCard>

      {activeBatch && (
        <SectionCard
          icon={Layers}
          title={activeBatch.label ?? "Batch"}
          eyebrow={`Status: ${activeBatch.status}`}
          action={
            activeBatch.status !== "completed" && (
              <Button onClick={runBatch} disabled={processing} className="gap-2 bg-gradient-ink text-primary-foreground hover:opacity-90">
                {processing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <>Run queue</>}
              </Button>
            )
          }
        >
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-md border border-border p-3"><div className="font-display text-2xl">{activeBatch.total_items}</div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</div></div>
            <div className="rounded-md border border-border p-3"><div className="font-display text-2xl text-safe">{activeBatch.processed_items}</div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Processed</div></div>
            <div className="rounded-md border border-border p-3"><div className="font-display text-2xl text-critical">{activeBatch.failed_items}</div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Failed</div></div>
          </div>

          {summary && (
            <div className="rounded-md border border-accent/30 bg-accent/5 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-accent">Aggregate QA report</div>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5 text-center">
                {Object.entries(summary.averages ?? {}).map(([k, v]) => (
                  <div key={k} className="rounded-md bg-surface p-3">
                    <div className="font-display text-xl">{Number(v).toFixed(1)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k.replace("_", " ")}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Issue categories</div>
                  <ul className="space-y-1">{Object.entries(summary.issue_category_counts ?? {}).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{String(v)}</span></li>)}</ul>
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Severity</div>
                  <ul className="space-y-1">{Object.entries(summary.severity_counts ?? {}).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{String(v)}</span></li>)}</ul>
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Top biases</div>
                  <ul className="space-y-1">{Object.entries(summary.bias_counts ?? {}).slice(0,5).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{String(v)}</span></li>)}</ul>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Notes with critical issues: <span className="font-medium text-critical">{summary.notes_with_critical_issues}</span> · Total red flags surfaced: <span className="font-medium">{summary.red_flags_total}</span>
              </div>
            </div>
          )}

          <div className="mt-4 max-h-80 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Note preview</th></tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{it.position + 1}</td>
                    <td className="px-3 py-2">{it.patient_label ?? "-"}</td>
                    <td className="px-3 py-2">{it.status}</td>
                    <td className="px-3 py-2 max-w-md truncate text-muted-foreground">{it.note_text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Recent batches" eyebrow="History">
        {batches.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No batches yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {batches.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{b.label ?? "Untitled batch"}</div>
                  <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })} · {b.total_items} notes · {b.status}</div>
                </div>
                <a href={`/app/bulk/${b.id}`} className="text-accent">Open →</a>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}