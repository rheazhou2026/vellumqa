import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // All animations begin after the SceneWrap fade-in (which runs ~frames 10–20).
  // Using only opacity + translateY (no clip-path) to avoid subpixel shimmer.
  const eyebrowOp = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eyebrowY = interpolate(frame, [22, 36], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titleOp = interpolate(frame, [30, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = spring({ frame: frame - 30, fps, config: { damping: 22, stiffness: 95 } });

  const subOp = interpolate(frame, [60, 84], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subY = interpolate(frame, [60, 84], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const lineWidth = interpolate(frame, [70, 100], [0, 280], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "0 160px" }}>
      <div style={{ maxWidth: 1400 }}>
        <div
          style={{
            fontFamily: "JetBrains Mono",
            fontSize: 18,
            letterSpacing: 6,
            color: "#6366F1",
            textTransform: "uppercase",
            opacity: eyebrowOp,
            transform: `translateY(${eyebrowY}px)`,
            marginBottom: 28,
          }}
        >
          Vellum · Clinical AI Audit
        </div>
        <div
          style={{
            fontFamily: "Playfair Display",
            fontSize: 132,
            color: "#F5F5F0",
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: -2,
            opacity: titleOp,
            transform: `translateY(${interpolate(titleY, [0, 1], [40, 0])}px)`,
          }}
        >
          Trust, but <em style={{ fontStyle: "italic", color: "#6366F1" }}>verify.</em>
        </div>
        <div
          style={{
            width: lineWidth,
            height: 2,
            background: "#F5F5F0",
            marginTop: 32,
          }}
        />
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 26,
            color: "#A1A1AA",
            marginTop: 28,
            opacity: subOp,
            transform: `translateY(${subY}px)`,
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          Independent infrastructure for auditing every AI-generated clinical note.
        </div>
      </div>
    </AbsoluteFill>
  );
};
