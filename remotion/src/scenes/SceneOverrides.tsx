import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const OVERRIDES = [
  "Fabricated consent",
  "Allergy inversion",
  "Wrong-patient data",
  "Suicidality omission",
  "Pediatric weight-dose error",
  "Procedure laterality error",
  "High-risk medication fabrication",
  "Missed emergency red flag",
  "Unsafe disposition",
  "Unreviewed patient communication",
];

const Override: React.FC<{ idx: number; text: string; delay: number }> = ({ idx, text, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 130 } });
  return (
    <div
      style={{
        opacity: op,
        transform: `translateX(${interpolate(x, [0, 1], [-30, 0])}px)`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        background: "#15171C",
        borderLeft: "3px solid #EF4444",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          background: "#EF4444",
          color: "#0F1115",
          fontFamily: "JetBrains Mono",
          fontWeight: 700,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {String(idx).padStart(2, "0")}
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 16, color: "#F5F5F0", fontWeight: 500 }}>{text}</div>
    </div>
  );
};

export const SceneOverrides: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", padding: "80px 160px", justifyContent: "center" }}>
      <div style={{ opacity: headerOp, marginBottom: 28 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "#EF4444", letterSpacing: 4, marginBottom: 12 }}>
          NEVER-EVENT OVERRIDES
        </div>
        <div style={{ fontFamily: "Playfair Display", fontSize: 56, color: "#F5F5F0", lineHeight: 1.1, maxWidth: 1300 }}>
          Ten defects that <em style={{ color: "#EF4444", fontStyle: "italic" }}>bypass scoring</em> and route straight to a human.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 1450 }}>
        {OVERRIDES.map((t, i) => (
          <Override key={t} idx={i + 1} text={t} delay={28 + i * 6} />
        ))}
      </div>
    </AbsoluteFill>
  );
};