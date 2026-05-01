import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const Logo: React.FC<{ name: string; delay: number; tone: string }> = ({ name, delay, tone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 110 } });
  return (
    <div
      style={{
        opacity: op,
        transform: `translateY(${interpolate(y, [0, 1], [18, 0])}px)`,
        background: "#15171C",
        border: "1px solid #2A2D35",
        padding: "22px 28px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        minWidth: 240,
      }}
    >
      <div style={{ width: 10, height: 10, background: tone, borderRadius: 999 }} />
      <div style={{ fontFamily: "Inter", fontSize: 18, color: "#F5F5F0", fontWeight: 500 }}>{name}</div>
    </div>
  );
};

const Pill: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        opacity: op,
        fontFamily: "JetBrains Mono",
        fontSize: 12,
        letterSpacing: 2,
        color: "#A1A1AA",
        border: "1px solid #2A2D35",
        padding: "6px 12px",
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
};

export const SceneIntegrate: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", padding: "100px 160px", justifyContent: "center" }}>
      <div style={{ opacity: headerOp, marginBottom: 40 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "#6366F1", letterSpacing: 4, marginBottom: 12 }}>
          STEP 05 / INTEGRATE
        </div>
        <div style={{ fontFamily: "Playfair Display", fontSize: 72, color: "#F5F5F0", lineHeight: 1.1, maxWidth: 1200 }}>
          Plugs into the stack you already run.
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 36, maxWidth: 1200 }}>
        <Logo name="Epic" delay={26} tone="#6366F1" />
        <Logo name="Cerner / Oracle Health" delay={36} tone="#10B981" />
        <Logo name="Athenahealth" delay={46} tone="#F59E0B" />
        <Logo name="Nuance DAX" delay={56} tone="#6366F1" />
        <Logo name="Abridge" delay={66} tone="#10B981" />
        <Logo name="Suki" delay={76} tone="#F59E0B" />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 1100 }}>
        <Pill text="FHIR R4" delay={86} />
        <Pill text="HL7 v2" delay={92} />
        <Pill text="Webhooks" delay={98} />
        <Pill text="REST API" delay={104} />
        <Pill text="SAML SSO" delay={110} />
        <Pill text="Audit Export" delay={116} />
      </div>
    </AbsoluteFill>
  );
};