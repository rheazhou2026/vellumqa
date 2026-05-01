import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const Stat: React.FC<{
  value: string;
  label: string;
  source: string;
  delay: number;
  big?: boolean;
}> = ({ value, label, source, delay, big }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 110 } });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  return (
    <div
      style={{
        opacity: op,
        transform: `scale(${scale})`,
        textAlign: "left",
        padding: "20px 26px",
        background: "#15171C",
        border: "1px solid #2A2D35",
      }}
    >
      <div
        style={{
          fontFamily: "Playfair Display",
          fontSize: big ? 110 : 78,
          color: "#EF4444",
          lineHeight: 1,
          letterSpacing: -2,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 16, color: "#F5F5F0", marginTop: 12, lineHeight: 1.35 }}>{label}</div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#71717A", marginTop: 6, letterSpacing: 1 }}>{source}</div>
    </div>
  );
};

export const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", padding: "100px 160px", justifyContent: "center" }}>
      <div style={{ opacity: headerOp, marginBottom: 36 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "#EF4444", letterSpacing: 4, marginBottom: 12 }}>
          THE PROBLEM
        </div>
        <div style={{ fontFamily: "Playfair Display", fontSize: 64, color: "#F5F5F0", lineHeight: 1.1, maxWidth: 1300 }}>
          AI scribes are in production. <em style={{ color: "#EF4444", fontStyle: "italic" }}>Production QA isn't.</em>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 16, maxWidth: 1450 }}>
        <Stat value="70%" label="of AI scribe notes contained errors" source="JMIR · 44 notes studied" delay={28} big />
        <Stat value="1.47%" label="hallucination rate in LLM-generated notes" source="npj Digital Medicine" delay={42} />
        <Stat value="3.45%" label="omission rate in LLM-generated notes" source="npj Digital Medicine" delay={56} />
        <Stat value="44%" label="of hallucinations are major errors" source="npj Digital Medicine" delay={70} />
      </div>
    </AbsoluteFill>
  );
};