export default function SeverityDot({ severity }: { severity?: string | null }) {
  const map: Record<string, string> = {
    S5: "bg-critical",
    S4: "bg-high",
    S3: "bg-moderate",
    S2: "bg-pass/70",
    S1: "bg-tertiary",
  };
  const cls = map[severity ?? ""] ?? "bg-tertiary";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} aria-label={severity ?? ""} />;
}