import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { GitBranch, History, Loader2 } from "lucide-react";
import { toast } from "sonner";

type UsedVersion = {
  version_id: string;
  source_id: string;
  name?: string;
  abbreviation?: string;
  version_string?: string;
  effective_date?: string;
  is_current?: boolean;
};

type SourceWithVersions = {
  id: string;
  name: string;
  abbreviation: string | null;
  versions: { id: string; version_string: string; is_current: boolean; effective_date: string | null; retired_date: string | null }[];
};

export default function GuidelineVersionBanner({
  encounterId,
  used,
  onReran,
}: {
  encounterId: string;
  used: UsedVersion[] | null | undefined;
  onReran?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<SourceWithVersions[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: srcs } = await supabase
        .from("guideline_sources")
        .select("id, name, abbreviation")
        .eq("active", true);
      const ids = (srcs ?? []).map((s: any) => s.id);
      const { data: vers } = ids.length
        ? await supabase
            .from("guideline_versions")
            .select("id, source_id, version_string, is_current, effective_date, retired_date")
            .in("source_id", ids)
            .order("effective_date", { ascending: false })
        : { data: [] as any[] };
      const grouped: SourceWithVersions[] = (srcs ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        abbreviation: s.abbreviation,
        versions: (vers ?? []).filter((v: any) => v.source_id === s.id),
      }));
      setSources(grouped);
      const init: Record<string, string> = {};
      for (const s of grouped) {
        const usedForSrc = used?.find((u) => u.source_id === s.id);
        const fallback = s.versions.find((v) => v.is_current) ?? s.versions[0];
        if (usedForSrc) init[s.id] = usedForSrc.version_id;
        else if (fallback) init[s.id] = fallback.id;
      }
      setSelected(init);
    })();
  }, [open, used]);

  async function rerun() {
    setBusy(true);
    try {
      const ids = Object.values(selected).filter(Boolean);
      const { error } = await supabase.functions.invoke("evaluate-encounter", {
        body: { encounter_id: encounterId, guideline_version_ids: ids },
      });
      if (error) throw error;
      toast.success("Re-evaluated against selected guideline versions");
      setOpen(false);
      onReran?.();
    } catch (e: any) {
      toast.error(e.message ?? "Re-run failed");
    } finally {
      setBusy(false);
    }
  }

  const items = used ?? [];

  return (
    <div className="flex items-center justify-between border border-border rounded-sm bg-surface px-3 py-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <GitBranch className="h-3.5 w-3.5 text-accent flex-shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary flex-shrink-0">
          Guideline set
        </span>
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {items.length === 0 && (
            <span className="font-mono text-[11px] text-muted-foreground">No versions recorded</span>
          )}
          {items.map((u) => (
            <span
              key={u.version_id}
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm border ${
                u.is_current
                  ? "border-pass/40 bg-pass/5 text-pass"
                  : "border-moderate/40 bg-moderate/5 text-moderate"
              }`}
              title={u.effective_date ?? ""}
            >
              {u.abbreviation ?? u.name} · {u.version_string}
              {!u.is_current && " · historical"}
            </span>
          ))}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="font-mono text-[10px] uppercase tracking-widest">
            <History className="h-3 w-3 mr-1" /> Re-run vs version
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm uppercase tracking-wider">
              Re-evaluate against historical guideline versions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {sources.map((s) => (
              <div key={s.id} className="space-y-1">
                <div className="font-heading text-xs">{s.abbreviation ?? s.name}</div>
                <select
                  value={selected[s.id] ?? ""}
                  onChange={(e) => setSelected((p) => ({ ...p, [s.id]: e.target.value }))}
                  className="w-full bg-surface border border-border rounded-sm px-2 py-1.5 font-mono text-xs"
                >
                  {s.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version_string}
                      {v.is_current ? " · current" : v.effective_date ? ` · eff. ${v.effective_date}` : ""}
                      {v.retired_date ? ` · retired ${v.retired_date}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {!sources.length && (
              <div className="text-xs text-muted-foreground">No guideline sources configured.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={rerun} disabled={busy} className="bg-accent text-accent-foreground hover:bg-accent-hover">
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Re-evaluate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}