import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const Pillar: React.FC<{ tag: string; title: string; body: string; delay: number }> = ({ tag, title, body, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 110 } });
  return (
    <div
      style={{
        opacity: op,
        transform: `translateY(${interpolate(y, [0, 1], [24, 0])}px)`,
        background: "#15171C",
        borderTop: "2px solid #6366F1",
        padding: "22px 24px",
      }}
    >
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#6366F1", letterSpacing: 3, marginBottom: 10 }}>
        {tag}
      </div>
      <div style={{ fontFamily: "Playfair Display", fontSize: 24, color: "#F5F5F0", marginBottom: 10, lineHeight: 1.2 }}>
        {title}
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 14, color: "#A1A1AA", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
};

export const SceneWhyNow: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", padding: "90px 160px", justifyContent: "center" }}>
      <div style={{ opacity: headerOp, marginBottom: 28 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "#6366F1", letterSpacing: 4, marginBottom: 12 }}>
          WHY NOW
        </div>
        <div style={{ fontFamily: "Playfair Display", fontSize: 60, color: "#F5F5F0", lineHeight: 1.1 }}>
          Four forcing functions converge in <em style={{ color: "#6366F1", fontStyle: "italic" }}>2025–2026.</em>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, maxWidth: 1500 }}>
        <Pillar
          tag="FDA TEMPO"
          title="Real-world performance data."
          body="Statements of interest opened Jan 2026. Real-world monitoring required for digital health devices."
          delay={26}
        />
        <Pillar
          tag="FDA CDS GUIDANCE"
          title="Clinicians must verify AI."
          body="Revised Jan 2026. Defines when CDS sits outside device regulation and requires independent verification."
          delay={42}
        />
        <Pillar
          tag="ONC HTI-1"
          title="AI transparency rules."
          body="First federal transparency rules for AI in certified health IT, covering safety, fairness, and validity."
          delay={58}
        />
        <Pillar
          tag="CA AB 3030 + LITIGATION"
          title="Liability has arrived."
          body="Sutter, MemorialCare, and Sharp face suits over AI-recorded encounters. AB 3030 in effect Jan 2025."
          delay={74}
        />
      </div>
    </AbsoluteFill>
  );
};