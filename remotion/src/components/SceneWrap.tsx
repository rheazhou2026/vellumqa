import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import React from "react";

/**
 * Wraps a scene so its content fades in after the prior scene fully exits
 * and fades out before the next scene begins. This prevents the "next scene
 * pops in before the previous one is gone" issue when using TransitionSeries
 * or back-to-back Sequences.
 *
 * leadIn: frames of black at the start where content is hidden.
 * leadOut: frames before the end where content fades to black.
 */
export const SceneWrap: React.FC<{
  children: React.ReactNode;
  leadIn?: number;
  leadOut?: number;
}> = ({ children, leadIn = 8, leadOut = 14 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [leadIn, leadIn + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - leadOut, durationInFrames - 2],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
  );
};