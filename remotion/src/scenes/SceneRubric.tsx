import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const Chip: React.FC<{ label: string; delay: number; color?: string }> = ({ label, delay, color = "#6366F1" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 140 } });
  return (
    <div
      style={{
        opacity: op,
        transform: `scale(${interpolate(s, [0, 1], [0.85, 1])})`,
        display: "inline-block",
        padding: "8px 16px",
        border: `1px solid ${color}`,
        color,
        fontFamily: "JetBrains Mono",
        fontSize: 14,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginRight: 10,
        marginBottom: 10,
      }}
    >
      {label}
    </div>
  );
};

const RubricRule: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clip = interpolate(frame - delay, [0, 24], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        opacity: op,
        fontFamily: "JetBrains Mono",
        fontSize: 16,
        color: "#E4E4E7",
        clipPath: `inset(0 ${100 - clip}% 0 0)`,
        marginBottom: 8,
      }}
    >
      <span style={{ color: "#10B981", marginRight: 12 }}>✓</span>
      {text}
    </div>
  );
};

export const SceneRubric: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [10, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrowOp = interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rubricOp = interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", padding: "90px 160px", justifyContent: "center" }}>
      <div style={{ opacity: headerOp, marginBottom: 28 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "#6366F1", letterSpacing: 4, marginBottom: 12 }}>
          STEP 03 / DYNAMIC RUBRIC
        </div>
        <div style={{ fontFamily: "Playfair Display", fontSize: 60, color: "#F5F5F0", lineHeight: 1.1, maxWidth: 1400 }}>
          A custom rubric is built <em style={{ color: "#6366F1", fontStyle: "italic" }}>per case</em> — not a static checklist.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1.2fr", gap: 32, alignItems: "center", maxWidth: 1500 }}>
        <div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "#71717A", letterSpacing: 2, marginBottom: 14 }}>
            CASE CONTEXT
          </div>
          <Chip label="ER" delay={28} />
          <Chip label="Adult" delay={36} color="#10B981" />
          <Chip label="Chest pain" delay={44} color="#F59E0B" />
          <Chip label="HR 102 / BP 158/94" delay={52} color="#EF4444" />
        </div>

        <div style={{ opacity: arrowOp, fontFamily: "JetBrains Mono", fontSize: 28, color: "#6366F1", textAlign: "center" }}>
          →
        </div>

        <div style={{ opacity: rubricOp, background: "#15171C", border: "1px solid #2A2D35", padding: "22px 26px" }}>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "#6366F1", letterSpacing: 2, marginBottom: 14 }}>
            RUBRIC LOADED · ACS WORKUP v3.2
          </div>
          <RubricRule text="ECG within 10 min of arrival" delay={92} />
          <RubricRule text="Serial troponin ≥ 2 draws" delay={106} />
          <RubricRule text="HEART score documented" delay={120} />
          <RubricRule text="Aspirin contraindication checked" delay={134} />
          <RubricRule text="Disposition justified vs admit criteria" delay={148} />
        </div>
      </div>
    </AbsoluteFill>
  );
};