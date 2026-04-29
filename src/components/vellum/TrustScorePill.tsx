export default function TrustScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-tertiary border border-border rounded-sm px-2 py-0.5">
        pending
      </span>
    );
  }
  const s = Math.round(score);
  const tone =
    s >= 85 ? "bg-pass/10 text-pass border-pass/30"
    : s >= 70 ? "bg-moderate/10 text-moderate border-moderate/30"
    : s >= 55 ? "bg-high/10 text-high border-high/30"
    : "bg-critical/10 text-critical border-critical/30";
  return (
    <span className={`font-mono text-xs px-2 py-0.5 border rounded-sm ${tone}`}>
      {s}
    </span>
  );
}