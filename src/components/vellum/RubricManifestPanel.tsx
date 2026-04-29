import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

type ModuleEntry = {
  key: string;
  name?: string;
  specialty?: string | null;
  reason?: string;
  matched_topics?: string[];
};

type Manifest = {
  loaded_modules?: string[] | null;
  loaded_modules_detail?: ModuleEntry[] | null;
  excluded_modules?: Array<ModuleEntry | string> | null;
  guideline_versions?: any[] | null;
  assembled_at?: string | null;
};

function normalize(m: ModuleEntry | string, fallbackReason: string): ModuleEntry {
  if (typeof m === "string") return { key: m, name: m, reason: fallbackReason };
  return { key: m.key ?? m.name ?? "?", ...m };
}

export default function RubricManifestPanel({
  manifest,
  chiefComplaint,
}: {
  manifest: Manifest | null;
  chiefComplaint?: string | null;
}) {
  const [openLoaded, setOpenLoaded] = useState(true);
  const [openExcluded, setOpenExcluded] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (!manifest) return null;

  const detail = (manifest.loaded_modules_detail ?? []) as ModuleEntry[];
  const loadedKeys = (manifest.loaded_modules ?? []) as string[];
  const loaded: ModuleEntry[] = detail.length
    ? detail
    : loadedKeys.map((k) => ({ key: k, name: k, reason: "Loaded for this encounter." }));
  const excluded = ((manifest.excluded_modules ?? []) as Array<ModuleEntry | string>).map((m) =>
    normalize(m, `Off-topic for chief complaint "${chiefComplaint ?? ""}".`),
  );

  return (
    <section className="vellum-panel p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary mb-3 flex items-center justify-between">
        <span>Rubric load manifest · scoped to chief complaint</span>
        <span className="text-muted-foreground normal-case tracking-normal">
          {loaded.length} loaded · {excluded.length} excluded
        </span>
      </div>

      {chiefComplaint && (
        <div className="text-[11px] text-muted-foreground mb-3">
          Chief complaint:{" "}
          <span className="text-foreground font-mono">{chiefComplaint}</span>
        </div>
      )}

      <ManifestSection
        title="Loaded modules"
        Icon={CheckCircle2}
        toneClass="text-pass"
        open={openLoaded}
        onToggle={() => setOpenLoaded((v) => !v)}
        entries={loaded}
        expandedKey={expandedKey}
        setExpandedKey={setExpandedKey}
        emptyText="No modules loaded."
      />

      <div className="h-2" />

      <ManifestSection
        title="Excluded as off-topic"
        Icon={XCircle}
        toneClass="text-tertiary"
        open={openExcluded}
        onToggle={() => setOpenExcluded((v) => !v)}
        entries={excluded}
        expandedKey={expandedKey}
        setExpandedKey={setExpandedKey}
        emptyText="No modules excluded."
      />
    </section>
  );
}

function ManifestSection({
  title,
  Icon,
  toneClass,
  open,
  onToggle,
  entries,
  expandedKey,
  setExpandedKey,
  emptyText,
}: {
  title: string;
  Icon: typeof CheckCircle2;
  toneClass: string;
  open: boolean;
  onToggle: () => void;
  entries: ModuleEntry[];
  expandedKey: string | null;
  setExpandedKey: (k: string | null) => void;
  emptyText: string;
}) {
  return (
    <div className="border border-border rounded-sm bg-surface">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-tertiary" /> : <ChevronRight className="h-3.5 w-3.5 text-tertiary" />}
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
        <span className="font-mono text-[10px] uppercase tracking-wider">{title}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{entries.length}</span>
      </button>
      {open && (
        <ul className="border-t border-border divide-y divide-border">
          {entries.length === 0 && (
            <li className="px-3 py-2 text-[11px] text-muted-foreground">{emptyText}</li>
          )}
          {entries.map((e) => {
            const isOpen = expandedKey === e.key;
            return (
              <li key={e.key}>
                <button
                  onClick={() => setExpandedKey(isOpen ? null : e.key)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-muted/20 transition"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3 text-tertiary" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-tertiary" />
                  )}
                  <span className="font-mono text-[11px] truncate">{e.key}</span>
                  {e.specialty && (
                    <span className="font-mono text-[9px] text-tertiary uppercase">{e.specialty}</span>
                  )}
                  {e.matched_topics && e.matched_topics.length > 0 && (
                    <span className="ml-auto font-mono text-[9px] text-pass">
                      ↳ {e.matched_topics.join(" · ")}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="px-3 pb-2 pl-9 text-[11px] text-foreground/80 space-y-1">
                    {e.name && e.name !== e.key && (
                      <div>
                        <span className="text-tertiary font-mono text-[10px] uppercase mr-2">Name</span>
                        {e.name}
                      </div>
                    )}
                    <div>
                      <span className="text-tertiary font-mono text-[10px] uppercase mr-2">Reason</span>
                      {e.reason ?? "—"}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}