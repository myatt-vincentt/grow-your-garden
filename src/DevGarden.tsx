// DevGarden.tsx — dev-only: garden with the mouse in a browser without a
// camera (the built-in preview), since no sample video pinches.
//   move           the hand cursor
//   click          pinch: plant toward that point
//   ← / →          a gust blowing that way from the cursor (shift: stronger)
//   R              clear the garden
// While the mouse is over the scene it stands in for a hand; leaving it hands
// control back. Never reaches production: Scene.tsx lazy-imports this behind
// an inline `process.env.NODE_ENV` check, which esbuild folds.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { gardenState, requestReset } from "./garden/state";

const DESIGN_H = 1280;

const DevGarden = () => {
  const source = useThree((s) => s.events.connected) as HTMLElement | undefined;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    const el = source;
    if (!el) return undefined;
    const { dev } = gardenState;
    const toDesign = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const scale = DESIGN_H / Math.max(1, r.height);
      return {
        x: (e.clientX - r.left) * scale,
        y: (e.clientY - r.top) * scale,
      };
    };
    const move = (e: PointerEvent) => {
      dev.cursor = toDesign(e);
    };
    const down = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.("button")) return;
      dev.cursor = toDesign(e);
      dev.pinches.push(dev.cursor);
    };
    const leave = () => {
      dev.cursor = null;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") requestReset();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight")
        dev.gusts.push({
          x: dev.cursor?.x ?? (DESIGN_H * width) / Math.max(1, height) / 2,
          dir: e.key === "ArrowRight" ? 1 : -1,
          strength: e.shiftKey ? 1.6 : 1,
        });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerleave", leave);
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("keydown", key);
    };
  }, [source, width, height]);

  return null;
};

export default DevGarden;
