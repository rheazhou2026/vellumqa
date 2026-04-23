// Helpers to export an audit as CSV or PDF.
import jsPDF from "jspdf";

export function exportAuditAsCSV(analysis: any, patientLabel?: string) {
  const rows: string[][] = [];
  const push = (...cells: any[]) => rows.push(cells.map((c) => csvCell(String(c ?? ""))));

  push("Vellum Clinical Audit Report");
  push("Patient", patientLabel ?? "");
  push("Generated", new Date().toISOString());
  push("Model", analysis.model_used ?? "");
  push("");
  push("Top clinical risk", analysis.top_clinical_risk ?? "");
  push("Recognized pattern", analysis.recognized_pattern ?? "");
  push("Reasoning rating", analysis.reasoning_rating ?? "");
  push("");
  push("Score", "Value");
  push("Overall trust", analysis.overall_trust_score ?? "");
  push("Safety", analysis.safety_score ?? "");
  push("Reasoning", analysis.reasoning_score ?? "");
  push("Accuracy", analysis.accuracy_score ?? "");
  push("Completeness", analysis.completeness_score ?? "");
  push("");
  push("Red flag checklist (scenario)", analysis.red_flag_checklist?.scenario ?? "");
  push("Item", "Status", "Evidence");
  for (const it of analysis.red_flag_checklist?.items ?? []) {
    push(it.item, it.status, it.evidence);
  }
  push("");
  push("Issues");
  push("Category", "Severity", "Description", "Suggested fix");
  for (const i of analysis.issues ?? []) {
    push(i.category, i.severity, i.description, i.suggested_fix);
  }
  push("");
  push("Guideline references");
  push("Name", "Organization", "Alignment", "Notes");
  for (const g of analysis.guideline_references ?? []) {
    push(g.name, g.organization, g.alignment, g.notes);
  }

  const csv = rows.map((r) => r.join(",")).join("\n");
  download(`vellum-audit-${stamp()}.csv`, csv, "text/csv");
}

export function exportAuditAsPDF(analysis: any, patientLabel?: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const addPageIfNeeded = (needed = 16) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const text = (str: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    if (opts.color) doc.setTextColor(...opts.color); else doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(str, pageW - margin * 2);
    for (const line of lines) {
      addPageIfNeeded(size + 2);
      doc.text(line, margin, y);
      y += size + 2;
    }
    y += opts.gap ?? 4;
  };
  const heading = (str: string) => { addPageIfNeeded(28); text(str, { size: 14, bold: true, gap: 6 }); };
  const subheading = (str: string) => { addPageIfNeeded(20); text(str, { size: 11, bold: true, gap: 4 }); };

  text("Vellum Clinical Audit Report", { size: 18, bold: true, gap: 8 });
  text(`Patient: ${patientLabel ?? "n/a"}`, { size: 9, color: [110, 110, 110] });
  text(`Generated: ${new Date().toLocaleString()}`, { size: 9, color: [110, 110, 110] });
  text(`Model: ${analysis.model_used ?? "n/a"}`, { size: 9, color: [110, 110, 110], gap: 12 });

  heading("Top Clinical Risk");
  text(analysis.top_clinical_risk ?? "n/a");
  text(`Pattern: ${analysis.recognized_pattern ?? "n/a"} · Reasoning: ${analysis.reasoning_rating ?? "n/a"}`, { color: [110, 110, 110], gap: 10 });

  heading("Scores");
  const scores: Array<[string, any]> = [
    ["Overall trust", analysis.overall_trust_score],
    ["Safety", analysis.safety_score],
    ["Reasoning", analysis.reasoning_score],
    ["Accuracy", analysis.accuracy_score],
    ["Completeness", analysis.completeness_score],
  ];
  for (const [k, v] of scores) text(`${k}: ${v ?? "n/a"}`);
  y += 6;

  if (analysis.red_flag_checklist?.items?.length) {
    heading("Red Flag Checklist");
    text(`Scenario: ${analysis.red_flag_checklist.scenario}`, { color: [110, 110, 110], gap: 6 });
    for (const it of analysis.red_flag_checklist.items) {
      const mark = it.status === "present" ? "[x]" : it.status === "missing" ? "[ ]" : "[-]";
      subheading(`${mark} ${it.item} — ${it.status}`);
      if (it.evidence) text(it.evidence, { color: [80, 80, 80] });
    }
  }

  if (analysis.issues?.length) {
    heading("Issues");
    for (const i of analysis.issues) {
      subheading(`[${i.severity?.toUpperCase()}] ${i.category}`);
      text(i.description);
      if (i.suggested_fix) text(`Fix: ${i.suggested_fix}`, { color: [80, 80, 80] });
    }
  }

  if (analysis.guideline_references?.length) {
    heading("Guideline References");
    for (const g of analysis.guideline_references) {
      subheading(`${g.name} — ${g.organization} (${g.alignment})`);
      if (g.notes) text(g.notes, { color: [80, 80, 80] });
      if (g.aligned_elements?.length) text(`Aligned: ${g.aligned_elements.join("; ")}`, { color: [40, 110, 70] });
      if (g.missing_elements?.length) text(`Missing: ${g.missing_elements.join("; ")}`, { color: [160, 50, 50] });
    }
  }

  doc.save(`vellum-audit-${stamp()}.pdf`);
}

function csvCell(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
