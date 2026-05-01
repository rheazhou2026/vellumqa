import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const Finding: React.FC<{ severity: "critical" | "fail" | "concern"; title: string; quote: string; delay: number }> = ({ severity, title, quote, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame - delay, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 110 } });
  const colors = {
    critical: { border: "#EF4444", bg: "rgba(239,68,68,0.06)", label: "CRITICAL FAIL" },
    fail: { border: "#F59E0B", bg: "rgba(245,158,11,0.06)", label: "FAIL" },
    concern: { border: "#FCD34D", bg: "rgba(252,211,77,0.05)", label: "CONCERN" },
  }[severity];

  return (
    <div
      style={{
        opacity: op,
        transform: `translateX(${interpolate(x, [0, 1], [-40, 0])}px)`,
        background: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        padding: "18px 22px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontFamily: "Inter", fontSize: 17, color: "#F5F5F0", fontWeight: 500 }}>{title}</div>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: colors.border, letterSpacing: 2 }}>{colors.label}</div>
      </div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: "#A1A1AA", lineHeight: 1.5 }}>"{quote}"</div>
    </div>
  );
};

export const SceneReview: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", padding: "100px 160px", justifyContent: "center" }}>
      <div style={{ opacity: headerOp, marginBottom: 36 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "#6366F1", letterSpacing: 4, marginBottom: 12 }}>
          STEP 05 / REVIEW
        </div>
        <div style={{ fontFamily: "Playfair Display", fontSize: 72, color: "#F5F5F0", lineHeight: 1.1 }}>
          Every flag traces to evidence.
        </div>
      </div>

      <div style={{ maxWidth: 1100 }}>
        <Finding
          severity="critical"
          title="Missed ACS workup despite classic presentation"
          quote="Patient reported substernal pressure radiating to left arm + diaphoresis — note dispositioned as musculoskeletal with no EKG."
          delay={20}
        />
        <Finding
          severity="critical"
          title="Discharge plan contradicts vital signs"
          quote="HR 102, BP 158/94 — no repeat troponin ordered before discharge."
          delay={48}
        />
        <Finding
          severity="fail"
          title="Family history omitted from assessment"
          quote="Father had MI at 55 — not factored into risk stratification."
          delay={76}
        />
      </div>
    </AbsoluteFill>
  );
};
