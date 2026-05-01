import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const Pipeline: React.FC<{ label: string; sublabel: string; delay: number; status: "run" | "done" }> = ({ label, sublabel, delay, status }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 110 } });

  // Progress bar fills
  const progress = interpolate(frame - delay - 6, [0, 28], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const isComplete = progress >= 100 || status === "done";

  return (
    <div
      style={{
        opacity: op,
        transform: `translateY(${interpolate(y, [0, 1], [20, 0])}px)`,
        background: "#15171C",
        border: "1px solid #2A2D35",
        padding: "20px 24px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "Inter", fontSize: 18, color: "#F5F5F0", fontWeight: 500 }}>{label}</div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "#71717A", marginTop: 4 }}>{sublabel}</div>
        </div>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: isComplete ? "#10B981" : "#6366F1", letterSpacing: 2 }}>
          {isComplete ? "✓ COMPLETE" : "RUNNING…"}
        </div>
      </div>
      <div style={{ height: 3, background: "#2A2D35", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: isComplete ? "#10B981" : "#6366F1" }} />
      </div>
    </div>
  );
};

export const SceneAudit: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", padding: "100px 160px", justifyContent: "center" }}>
      <div style={{ opacity: headerOp, marginBottom: 36 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "#6366F1", letterSpacing: 4, marginBottom: 12 }}>
          STEP 02 / AUDIT
        </div>
        <div style={{ fontFamily: "Playfair Display", fontSize: 72, color: "#F5F5F0", lineHeight: 1.1 }}>
          Multi-agent pipeline scores every claim.
        </div>
      </div>

      <div style={{ maxWidth: 1100 }}>
        <Pipeline label="Extract clinical claims" sublabel="LLM agent · structured tool-call output" delay={18} status="run" />
        <Pipeline label="Source-faithfulness check" sublabel="cross-reference against transcript + EHR + labs" delay={42} status="run" />
        <Pipeline label="Guideline concordance" sublabel="match plan to specialty rubric · ACC/AHA, ACR…" delay={66} status="run" />
        <Pipeline label="Red-flag & omission scan" sublabel="missed diagnoses, escalation hazards" delay={90} status="run" />
      </div>
    </AbsoluteFill>
  );
};
