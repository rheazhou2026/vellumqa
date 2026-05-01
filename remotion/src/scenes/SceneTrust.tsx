import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const SubScore: React.FC<{ label: string; value: number; delay: number; bad?: boolean }> = ({ label, value, delay, bad }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fill = interpolate(frame - delay, [0, 30], [0, value], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const color = bad ? "#EF4444" : "#10B981";
  return (
    <div style={{ opacity: op, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "Inter", fontSize: 14, color: "#A1A1AA" }}>{label}</span>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 14, color }}>{Math.round(fill)}</span>
      </div>
      <div style={{ height: 4, background: "#2A2D35" }}>
        <div style={{ height: "100%", width: `${fill}%`, background: color }} />
      </div>
    </div>
  );
};

export const SceneTrust: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const ringScale = spring({ frame: frame - 12, fps, config: { damping: 18, stiffness: 90 } });

  // Trust score animates from 100 → 38
  const score = interpolate(frame, [30, 80], [100, 38], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Ring stroke
  const radius = 130;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - score / 100);

  const flagOp = interpolate(frame, [85, 110], [0, 1], { extrapolateRight: "clamp" });
  const flagY = interpolate(frame, [85, 110], [16, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "row", padding: "100px 160px", alignItems: "center", gap: 100 }}>
      {/* Left: trust score ring */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: "#6366F1", letterSpacing: 4, marginBottom: 16 }}>
          TRUST SCORE
        </div>
        <div style={{ position: "relative", width: 320, height: 320, transform: `scale(${interpolate(ringScale, [0, 1], [0.85, 1])})` }}>
          <svg width={320} height={320} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={160} cy={160} r={radius} stroke="#2A2D35" strokeWidth={14} fill="none" />
            <circle
              cx={160}
              cy={160}
              r={radius}
              stroke="#EF4444"
              strokeWidth={14}
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontFamily: "Playfair Display", fontSize: 110, color: "#F5F5F0", lineHeight: 1 }}>{Math.round(score)}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "#71717A", letterSpacing: 2, marginTop: 4 }}>
              / 100
            </div>
          </div>
        </div>
        <div
          style={{
            opacity: flagOp,
            transform: `translateY(${flagY}px)`,
            marginTop: 24,
            padding: "8px 16px",
            border: "1px solid #EF4444",
            color: "#EF4444",
            fontFamily: "JetBrains Mono",
            fontSize: 13,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Critical failures · 2
        </div>
      </div>

      {/* Right: sub-scores */}
      <div style={{ flex: 1, maxWidth: 600 }}>
        <div style={{ opacity: headerOp, marginBottom: 32 }}>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "#6366F1", letterSpacing: 4, marginBottom: 12 }}>
            STEP 03 / SCORE
          </div>
          <div style={{ fontFamily: "Playfair Display", fontSize: 56, color: "#F5F5F0", lineHeight: 1.1 }}>
            Specialty-aware risk.
          </div>
        </div>
        <SubScore label="Source faithfulness" value={42} delay={36} bad />
        <SubScore label="Differential integrity" value={28} delay={48} bad />
        <SubScore label="Guideline concordance" value={51} delay={60} bad />
        <SubScore label="Omission hazard" value={88} delay={72} bad />
        <SubScore label="Reviewability" value={71} delay={84} />
      </div>
    </AbsoluteFill>
  );
};
