import { AbsoluteFill, Audio, Series, staticFile, useCurrentFrame } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadSans } from "@remotion/google-fonts/Inter";

import { SceneIntro } from "./scenes/SceneIntro";
import { SceneIngest } from "./scenes/SceneIngest";
import { SceneAudit } from "./scenes/SceneAudit";
import { SceneTrust } from "./scenes/SceneTrust";
import { SceneReview } from "./scenes/SceneReview";
import { SceneIntegrate } from "./scenes/SceneIntegrate";
import { SceneOutro } from "./scenes/SceneOutro";
import { SceneWrap } from "./components/SceneWrap";

loadDisplay("normal", { weights: ["400", "700"], subsets: ["latin"] });
loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });
loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

const Grid: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (frame * 0.15) % 60;
  return (
    <AbsoluteFill
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        backgroundPosition: `${drift}px ${drift}px`,
        opacity: 0.6,
      }}
    />
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
      pointerEvents: "none",
    }}
  />
);

const SCENES: { Component: React.FC; duration: number; leadIn?: number; leadOut?: number }[] = [
  { Component: SceneIntro, duration: 130 },
  { Component: SceneIngest, duration: 175 },
  { Component: SceneAudit, duration: 180 },
  { Component: SceneTrust, duration: 200 },
  { Component: SceneReview, duration: 210 },
  { Component: SceneIntegrate, duration: 160 },
  { Component: SceneOutro, duration: 145 },
];

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0F1115" }}>
      <Audio src={staticFile("music.mp3")} volume={0.55} />
      <Grid />
      <Series>
        {SCENES.map(({ Component, duration, leadIn, leadOut }, i) => (
          <Series.Sequence key={i} durationInFrames={duration}>
            <SceneWrap duration={duration} leadIn={leadIn ?? 10} leadOut={leadOut ?? 16}>
              <Component />
            </SceneWrap>
          </Series.Sequence>
        ))}
      </Series>
      <Vignette />
    </AbsoluteFill>
  );
};
