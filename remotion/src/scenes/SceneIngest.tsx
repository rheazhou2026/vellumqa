import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const Tag: React.FC<{ label: string; delay: number; color: string }> = ({ label, delay, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 120 } });
  return (
    <div
      style={{
        display: "inline-block",
        padding: "6px 14px",
        border: `1px solid ${color}`,
        color,
        fontFamily: "JetBrains Mono",
        fontSize: 14,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        opacity: op,
        transform: `translateY(${interpolate(y, [0, 1], [16, 0])}px)`,
        marginRight: 10,
      }}
    >
      {label}
    </div>
  );
};

const Line: React.FC<{ text: string; delay: number; tag?: string }> = ({ text, delay, tag }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clip = interpolate(frame - delay, [0, 30], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginBottom: 12, opacity: op }}>
      {tag && (
        <span style={{ color: "#6366F1", fontFamily: "JetBrains Mono", fontSize: 13, width: 110 }}>{tag}</span>
      )}
      <span
        style={{
          fontFamily: "JetBrains Mono",
          fontSize: 17,
          color: "#E4E4E7",
          clipPath: `inset(0 ${100 - clip}% 0 0)`,
          flex: 1,
        }}
      >
        {text}
      </span>
    </div>
  );
};

export const SceneIngest: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const cardScale = spring({ frame: frame - 6, fps: 30, config: { damping: 20, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", padding: "100px 160px", justifyContent: "center" }}>
      <div style={{ opacity: headerOp, marginBottom: 36 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "#6366F1", letterSpacing: 4, marginBottom: 12 }}>
          STEP 01 / INGEST
        </div>
        <div style={{ fontFamily: "Playfair Display", fontSize: 72, color: "#F5F5F0", lineHeight: 1.1 }}>
          Drop in any encounter.
        </div>
      </div>

      <div
        style={{
          background: "#15171C",
          border: "1px solid #2A2D35",
          borderRadius: 4,
          padding: 36,
          maxWidth: 1100,
          transform: `scale(${interpolate(cardScale, [0, 1], [0.96, 1])})`,
          opacity: cardScale,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <Tag label="transcript" delay={20} color="#6366F1" />
          <Tag label="ehr" delay={28} color="#10B981" />
          <Tag label="labs" delay={36} color="#F59E0B" />
        </div>
        <Line tag="[transcript]" text="Patient: Crushing chest pain, started 2 hours ago…" delay={46} />
        <Line tag="[ehr]" text="BP 158/94 · HR 102 · SpO2 96% · prior MI: none" delay={62} />
        <Line tag="[labs]" text="Troponin I: 0.04 ng/mL · pending second draw" delay={78} />
        <Line tag="[ai-note]" text="Atypical chest pain, likely musculoskeletal. D/C with ibuprofen." delay={96} />
      </div>
    </AbsoluteFill>
  );
};
