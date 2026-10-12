// Shared live state: the scene writes it, the HUD and the dev driver read and
// poke it. Plain mutable fields, read every frame (no React state).
import { createGarden } from "./engine";
import type { Pt } from "./plant";

export const gardenState = {
  garden: createGarden(),
  /** A hand (or the dev mouse) is in view. */
  handSeen: false,
  /** A reset waiting for the next frame (the HUD button). */
  resetRequested: false,
  /** Dev-only: the mouse as a hand — pinches and gusts queued for the next frame. */
  dev: {
    cursor: null as Pt | null,
    pinches: [] as Pt[],
    gusts: [] as { x: number; dir: -1 | 1; strength: number }[],
  },
};

export const requestReset = () => {
  gardenState.resetRequested = true;
};
