import { cn } from "@/lib/utils";

function scoreColor(score: number) {
  if (score >= 80) return "text-safe";
  if (score >= 60) return "text-info";
  if (score >= 40) return "text-important";
  return "text-critical";
}

function scoreStroke(score: number) {
  if (score >= 80) return "hsl(var(--safe))";
  if (score >= 60) return "hsl(var(--info))";
  if (score >= 40) return "hsl(var(--important))";
  return "hsl(var(--critical))";
}

export function ScoreGauge({
  score,
  label,
  size = 88,
  className,
}: {
  score: number;
  label: string;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--border))"
            strokeWidth={5}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={scoreStroke(pct)}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-display text-2xl font-semibold", scoreColor(pct))}>
            {pct}
          </span>
        </div>
      </div>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}