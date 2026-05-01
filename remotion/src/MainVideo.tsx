import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadSans } from "@remotion/google-fonts/Inter";

import { SceneIntro } from "./scenes/SceneIntro";
import { SceneIngest } from "./scenes/SceneIngest";
import { SceneAudit } from "./scenes/SceneAudit";
import { SceneTrust } from "./scenes/SceneTrust";
import { SceneReview } from "./scenes/SceneReview";
import { SceneOutro } from "./scenes/SceneOutro";

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

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0F1115" }}>
      <Grid />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneIntro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={140}>
          <SceneIngest />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 24 })}
        />
        <TransitionSeries.Sequence durationInFrames={140}>
          <SceneAudit />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={150}>
          <SceneTrust />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 24 })}
        />
        <TransitionSeries.Sequence durationInFrames={140}>
          <SceneReview />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={100}>
          <SceneOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Vignette />
    </AbsoluteFill>
  );
};
