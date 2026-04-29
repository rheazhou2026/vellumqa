import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";

/**
 * Lightweight evidence-trace bus. Click an EvidenceQuote anywhere in the page,
 * we find the nearest occurrence inside any registered TraceablePane and
 * scroll + highlight it. No dependence on AI-provided offsets — we string-match
 * the verbatim quote against the rendered source/note text.
 */

type TraceTarget = "source" | "note" | "any";

interface TraceCtx {
  jump: (quote: string, prefer?: TraceTarget) => void;
  registerPane: (id: string, target: TraceTarget, el: HTMLElement) => () => void;
}

const Ctx = createContext<TraceCtx | null>(null);

export function EvidenceTraceProvider({ children }: { children: ReactNode }) {
  const panes = useRef(new Map<string, { target: TraceTarget; el: HTMLElement }>());

  const registerPane = useCallback((id: string, target: TraceTarget, el: HTMLElement) => {
    panes.current.set(id, { target, el });
    return () => { panes.current.delete(id); };
  }, []);

  const jump = useCallback((quote: string, prefer: TraceTarget = "any") => {
    const cleaned = quote.trim().replace(/\s+/g, " ");
    if (!cleaned) return;

    // Order panes: preferred first, then 'any', then others.
    const ordered = [...panes.current.values()].sort((a, b) => {
      const score = (t: TraceTarget) => (t === prefer ? 0 : prefer === "any" ? 1 : t === "any" ? 1 : 2);
      return score(a.target) - score(b.target);
    });

    for (const pane of ordered) {
      if (highlightInPane(pane.el, cleaned)) return;
    }
    // No match — flash a small toast-like ping on the page edge.
    flashMissing();
  }, []);

  return <Ctx.Provider value={{ jump, registerPane }}>{children}</Ctx.Provider>;
}

function highlightInPane(root: HTMLElement, quote: string): boolean {
  // Walk text nodes and find the first one containing the (case-insensitive,
  // whitespace-collapsed) quote. We trim the match length to a reasonable
  // window so partial paraphrases still latch onto a span.
  const lcQuote = quote.toLowerCase();
  const head = lcQuote.length > 80 ? lcQuote.slice(0, 80) : lcQuote;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const original = (node.nodeValue ?? "").replace(/\s+/g, " ");
    const idx = original.toLowerCase().indexOf(head);
    if (idx === -1) continue;

    // Compute matching length on the original string preserving whitespace.
    const matchLen = Math.min(quote.length, original.length - idx);
    const range = document.createRange();
    try {
      range.setStart(node, idx);
      range.setEnd(node, idx + matchLen);
    } catch {
      continue;
    }
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) continue;

    // Wrap in a marker
    const mark = document.createElement("mark");
    mark.className = "vellum-evidence-mark";
    try {
      range.surroundContents(mark);
    } catch {
      // Range crosses element boundaries — fall back to scroll only.
      (node.parentElement ?? root).scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    // Auto-unwrap after a moment so subsequent jumps work cleanly.
    setTimeout(() => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    }, 2400);
    return true;
  }
  return false;
}

function flashMissing() {
  const el = document.createElement("div");
  el.textContent = "No matching span in source";
  el.className =
    "fixed bottom-6 right-6 z-50 px-3 py-2 rounded-sm bg-high/15 border border-high/40 text-high text-xs font-mono uppercase tracking-widest";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export function useEvidenceTrace() {
  const v = useContext(Ctx);
  return v;
}

/**
 * Wrap a panel that contains the rendered source text or AI note text. We
 * register its DOM element so EvidenceQuote can search inside it.
 */
export function TraceablePane({
  id,
  target,
  children,
  className,
}: {
  id: string;
  target: TraceTarget;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ctx = useEvidenceTrace();
  useEffect(() => {
    if (!ref.current || !ctx) return;
    return ctx.registerPane(id, target, ref.current);
  }, [id, target, ctx]);
  return <div ref={ref} className={className} data-trace-pane={id}>{children}</div>;
}

/**
 * Click-to-trace inline quote. Renders the quote and, when clicked, scrolls
 * the registered source/note pane to the matching sentence and flashes a mark.
 */
export function EvidenceQuote({
  quote,
  prefer = "any",
  className = "",
}: {
  quote?: string | null;
  prefer?: TraceTarget;
  className?: string;
}) {
  const ctx = useEvidenceTrace();
  if (!quote) return null;
  const onClick = () => ctx?.jump(quote, prefer);
  return (
    <button
      type="button"
      onClick={onClick}
      title="Jump to evidence in source"
      className={
        "group text-left italic text-muted-foreground hover:text-accent transition border-l-2 border-accent/40 hover:border-accent pl-2 cursor-pointer w-full " +
        className
      }
    >
      <span className="font-mono text-[9px] uppercase tracking-widest text-tertiary group-hover:text-accent mr-1.5 not-italic">
        ↗ trace
      </span>
      "{quote}"
    </button>
  );
}