import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleClip = interpolate(frame, [0, 40], [0, 100], { extrapolateRight: "clamp" });
  const titleY = spring({ frame, fps, config: { damping: 22, stiffness: 90 } });

  const subOp = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(frame, [30, 60], [16, 0], { extrapolateRight: "clamp" });

  const linePct = interpolate(frame, [50, 90], [0, 100], { extrapolateRight: "clamp" });

  const wordOp = (d: number) => interpolate(frame - d, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "0 160px" }}>
      <div style={{ maxWidth: 1300, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Playfair Display",
            fontSize: 116,
            color: "#F5F5F0",
            lineHeight: 1.05,
            transform: `translateY(${interpolate(titleY, [0, 1], [40, 0])}px)`,
            clipPath: `inset(0 ${100 - titleClip}% 0 0)`,
            letterSpacing: -2,
          }}
        >
          Audit before <em style={{ color: "#6366F1", fontStyle: "italic" }}>harm.</em>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
          <div style={{ width: `${linePct}%`, maxWidth: 200, height: 2, background: "#F5F5F0" }} />
        </div>

        <div
          style={{
            fontFamily: "Inter",
            fontSize: 22,
            color: "#A1A1AA",
            marginTop: 28,
            opacity: subOp,
            transform: `translateY(${subY}px)`,
          }}
        >
          Independent · Evidence-grounded · Regulator-ready
        </div>

        <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 50 }}>
          {["HIPAA", "SOC 2", "21 CFR PART 11"].map((t, i) => (
            <div
              key={t}
              style={{
                opacity: wordOp(60 + i * 8),
                fontFamily: "JetBrains Mono",
                fontSize: 13,
                letterSpacing: 3,
                color: "#71717A",
                border: "1px solid #2A2D35",
                padding: "8px 18px",
              }}
            >
              {t}
            </div>
          ))}
        </div>

        <div
          style={{
            opacity: wordOp(75),
            marginTop: 48,
            fontFamily: "Playfair Display",
            fontSize: 38,
            color: "#F5F5F0",
            letterSpacing: -0.5,
          }}
        >
          Vellum
        </div>
      </div>
    </AbsoluteFill>
  );
};
