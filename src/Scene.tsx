// Scene.tsx — Grow Your Garden: pinch your thumb and finger in the air and a
// plant grows from the ground up to them, then blooms; swipe an open palm to
// make the garden sway in the wind. See PLAN.md.
import { lazy, Suspense } from "react";

import { ExperienceStatus } from "./garden/ExperienceStatus";
import { Garden } from "./garden/Garden";
import { Hud } from "./garden/Hud";

// Dev-only tools (media switcher; mouse driver) for previewing without a
// camera. Lazy and behind a constant esbuild folds to false in production.
// Two rules: `process.env.NODE_ENV`, not `import.meta.env.DEV`
// (vincentt-xr/v2-template#112); and write the check INSIDE each ternary —
// hoisted into a `const`, esbuild keeps the dead branch.
const DevMediaSwitcher =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./DevMediaSwitcher"))
    : null;
const DevGarden =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./DevGarden"))
    : null;

export const Scene = () => (
  <>
    <ExperienceStatus />
    <Garden />
    <Hud />
    {DevMediaSwitcher ? (
      <Suspense fallback={null}>
        <DevMediaSwitcher />
      </Suspense>
    ) : null}
    {DevGarden ? (
      <Suspense fallback={null}>
        <DevGarden />
      </Suspense>
    ) : null}
  </>
);
