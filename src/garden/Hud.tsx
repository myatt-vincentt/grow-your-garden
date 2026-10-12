// The HUD, as HTML over the scene:
//   top      a hint pill walking you through it — show a hand, pinch to plant,
//            then (once a few flowers are up) swipe for wind; gone after that
//   top-right the speaker (sound starts muted: the SDK's rule for iOS, and the
//            tap that unmutes is the gesture that unlocks playback)
//   bottom-right a floating reset button: everything sinks back into the ground
// React state changes only when what's shown does.
import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { toggleMuted, useMuted } from "@vincentt-xr/sdk";

import { loadSounds } from "./sound";
import { gardenState, requestReset } from "./state";

/** Flowers up before the wind hint shows. */
const WIND_HINT_AFTER = 3;

type Hint = { icon: string; text: string } | null;

const hintNow = (): Hint => {
  const g = gardenState.garden;
  if (g.planted === 0) {
    if (!gardenState.handSeen)
      return { icon: "✋", text: "Hold up a hand to the camera" };
    return {
      icon: "🤏",
      text: "Pinch your thumb and finger in the air to plant a flower",
    };
  }
  if (g.windCount === 0 && g.blooms >= WIND_HINT_AFTER)
    return { icon: "👋", text: "Swipe an open palm to make wind" };
  return null;
};

const sameHint = (a: Hint, b: Hint) => a?.text === b?.text;

const round = {
  width: 48,
  height: 48,
  borderRadius: 24,
  border: "3px solid #2b2340",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "auto",
  cursor: "pointer",
  padding: 0,
} as const;

export const Hud = () => {
  const muted = useMuted();
  const [hint, setHint] = useState<Hint>(hintNow);
  const [hasPlants, setHasPlants] = useState(false);

  useEffect(() => {
    loadSounds().catch(() => {
      // A clip that fails to load just stays silent.
    });
    const id = window.setInterval(() => {
      const next = hintNow();
      setHint((h) => (sameHint(h, next) ? h : next));
      const any = gardenState.garden.plants.some((p) => p.sink < 0);
      setHasPlants((v) => (v === any ? v : any));
    }, 150);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Html fullscreen zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          fontFamily: '"Nunito", "Space Grotesk", system-ui, sans-serif',
        }}
      >
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: `translate(-50%, ${hint ? 0 : -12}px)`,
            opacity: hint ? 1 : 0,
            transition: "opacity 0.35s, transform 0.35s",
            maxWidth: "min(78vw, 420px)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            borderRadius: 999,
            background: "#fffaf0",
            border: "3px solid #2b2340",
            boxShadow: "0 4px 0 #2b2340",
            color: "#2b2340",
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1.25,
          }}
        >
          <span style={{ fontSize: 24 }}>{hint?.icon}</span>
          <span>{hint?.text}</span>
        </div>

        <button
          type="button"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          onClick={toggleMuted}
          style={{
            ...round,
            position: "absolute",
            top: 16,
            right: 14,
            background: "#fffaf0",
            boxShadow: "0 3px 0 #2b2340",
            fontSize: 22,
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>

        <button
          type="button"
          aria-label="Clear the garden"
          title="Clear the garden"
          onClick={requestReset}
          disabled={!hasPlants}
          style={{
            ...round,
            position: "absolute",
            right: 16,
            bottom: 22,
            width: 60,
            height: 60,
            borderRadius: 30,
            background: "#ffe066",
            boxShadow: "0 4px 0 #2b2340",
            opacity: hasPlants ? 1 : 0.5,
            transition: "opacity 0.3s",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"
              fill="none"
              stroke="#2b2340"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M3.6 3.8v4.6h4.6"
              fill="none"
              stroke="#2b2340"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </Html>
  );
};
