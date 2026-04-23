import { ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export function TopRiskBanner({
  risk,
  rating,
  pattern,
}: {
  risk: string;
  rating?: string | null;
  pattern?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-lg border border-critical/40 bg-gradient-to-br from-critical-soft via-surface to-important-soft p-6 shadow-glow-risk"
    >
      <div className="absolute right-4 top-4 opacity-10">
        <ShieldAlert className="h-32 w-32 text-critical" />
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-critical">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-critical animate-pulse-soft" />
          Top Clinical Risk Identified
        </div>
        <p className="mt-3 max-w-3xl font-display text-2xl font-semibold leading-snug text-foreground">
          {risk}
        </p>
        {(rating || pattern) && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {pattern && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground/60">Pattern:</span>
                <span className="font-medium text-foreground">{pattern}</span>
              </span>
            )}
            {rating && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-muted-foreground/60">Reasoning:</span>
                  <span className="font-medium text-foreground">{rating}</span>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}