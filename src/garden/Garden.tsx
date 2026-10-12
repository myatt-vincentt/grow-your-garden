// Grow Your Garden: pinch in the air and a plant grows from the ground up to
// your fingers, then blooms. Swipe an open palm for wind.
//
//   renderOrder −999  the camera (App.tsx's VideoBackground)
//   renderOrder 50    the garden — one 2D canvas, redrawn every frame: ground,
//                     plants (back to front by root depth), butterflies and
//                     bees, pinch pops, the hand cursors
//
// The canvas is a full-screen quad drawn straight to clip space. Coordinates
// are design px (the 1280-tall design screen, x right, y down); tracker points
// (centre origin, y up, already mirrored by the SDK) map straight onto it
// because the feed fills the screen.
import { useEffect, useMemo } from "react";
import { CanvasTexture, ShaderMaterial, SRGBColorSpace } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { XRModel } from "@vincentt-xr/sdk";
import {
  measureOpenPalm,
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";
import { HandTracker } from "@vincentt-xr/sdk/tracking";

import { CANVAS, SWIPE } from "./config";
import {
  drawCritter,
  drawCursor,
  drawPlant,
  drawPop,
  drawRootTuft,
  drawTarget,
  drawTufts,
  paintGround,
} from "./draw";
import { addGust, plantAt, resetGarden, stepGarden } from "./engine";
import {
  createHandTrack,
  type HandInput,
  type HandTrack,
  matchHands,
  stepHand,
} from "./hands";
import { byDepth, type Pt } from "./plant";
import { play, playBloom } from "./sound";
import { gardenState } from "./state";
import { windAt } from "./wind";

const DESIGN_H = 1280;
// Hand landmarks (MediaPipe).
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_BASE = 5;
const INDEX_TIP = 8;
const MIDDLE_BASE = 9;
const RING_BASE = 13;
const PINKY_BASE = 17;

const layerVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`;
const layerFrag = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uMap, vUv);
    #include <colorspace_fragment>
  }
`;

const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return {
    canvas,
    ctx: canvas.getContext("2d") as CanvasRenderingContext2D,
  };
};

/** Blooms close together chime once. */
const CHIME_GAP = 0.12;

const GardenLayer = () => {
  const { size } = useThree();
  const hands = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);

  const aspect = size.width / Math.max(1, size.height);
  const designW = DESIGN_H * aspect;
  const layer = useMemo(() => {
    const h = CANVAS.height;
    const w = Math.max(2, Math.round(h * aspect));
    const main = makeCanvas(w, h);
    const ground = makeCanvas(w, h);
    const s = h / DESIGN_H;
    paintGround(ground.ctx, DESIGN_H * aspect, DESIGN_H, s);
    const texture = new CanvasTexture(main.canvas);
    texture.colorSpace = SRGBColorSpace;
    const material = new ShaderMaterial({
      uniforms: { uMap: { value: texture } },
      vertexShader: layerVert,
      fragmentShader: layerFrag,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    return { main, ground, texture, material, s };
    // Rebuilt only when the aspect changes noticeably (a rotation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(aspect * 20)]);
  useEffect(
    () => () => {
      layer.texture.dispose();
      layer.material.dispose();
    },
    [layer],
  );

  const live = useMemo(
    () => ({
      tracks: [] as HandTrack[],
      pops: [] as { at: Pt; age: number }[],
      lastChime: -1,
    }),
    [],
  );

  // Dev hook for inspecting the garden live.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __garden?: unknown }).__garden = {
        state: gardenState,
        layer,
        live,
      };
    }
  }, [layer, live]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = state.clock.elapsedTime;
    const g = gardenState.garden;
    const W = designW;
    const H = DESIGN_H;

    const plant = (at: Pt) => {
      plantAt(g, at, W, H, Math.random);
      live.pops.push({ at, age: 0 });
      play("plant");
    };
    const gust = (x: number, dir: -1 | 1, strength: number) => {
      addGust(g, { x, dir, strength });
      play("wind");
    };

    // Hands: pinch to plant, swipe an open palm for wind. Each hand keeps its
    // own track, matched to it by position (the tracker's left / right labels
    // can swap between frames).
    const cursors: { at: Pt; ratio: number; pinched: boolean }[] = [];
    const inputs: HandInput[] = [];
    for (const hand of hands?.hands ?? []) {
      const pts = hand.coordinates;
      if (pts && pts.length > PINKY_BASE) {
        const at = (k: number) => ({
          x: (pts[k].x * 0.5 + 0.5) * W,
          y: (0.5 - pts[k].y * 0.5) * H,
        });
        const palmPts = [
          WRIST,
          INDEX_BASE,
          MIDDLE_BASE,
          RING_BASE,
          PINKY_BASE,
        ].map(at);
        inputs.push({
          thumbTip: at(THUMB_TIP),
          indexTip: at(INDEX_TIP),
          wrist: at(WRIST),
          middleBase: at(MIDDLE_BASE),
          palm: {
            x: palmPts.reduce((a, p) => a + p.x, 0) / palmPts.length,
            y: palmPts.reduce((a, p) => a + p.y, 0) / palmPts.length,
          },
          open: measureOpenPalm(pts),
        });
      }
    }
    const match = matchHands(
      live.tracks.map((tr) => tr.at),
      inputs.map((i) => i.palm),
      SWIPE.teleport * W,
    );
    const fed = new Set<HandTrack>();
    inputs.forEach((input, i) => {
      let track = match[i] >= 0 ? live.tracks[match[i]] : undefined;
      if (!track) {
        track = live.tracks.find((tr) => !tr.at && !fed.has(tr));
        if (!track) {
          track = createHandTrack();
          live.tracks.push(track);
        }
      }
      fed.add(track);
      const ev = stepHand(track, input, dt, W);
      if (ev.pinch) plant(ev.pinch);
      if (ev.gust) gust(ev.gust.x, ev.gust.dir, ev.gust.strength);
      if (track.point && input.open < 0.85)
        cursors.push({
          at: track.point,
          ratio: track.ratio,
          pinched: track.pinched,
        });
    });
    for (const track of live.tracks)
      if (!fed.has(track)) stepHand(track, null, dt, W);
    const seen = inputs.length;

    // Dev mouse (dev builds only ever fill these).
    const { dev } = gardenState;
    for (const at of dev.pinches.splice(0)) plant(at);
    for (const d of dev.gusts.splice(0)) gust(d.x, d.dir, d.strength);
    if (dev.cursor)
      cursors.push({ at: dev.cursor, ratio: 0.9, pinched: false });
    gardenState.handSeen = seen > 0 || dev.cursor !== null;

    if (gardenState.resetRequested) {
      gardenState.resetRequested = false;
      if (g.plants.some((p) => p.sink < 0)) {
        resetGarden(g);
        play("reset");
      }
    }

    const ev = stepGarden(g, dt, t, W, H, Math.random);
    if (ev.bloomed.length && t - live.lastChime > CHIME_GAP) {
      live.lastChime = t;
      playBloom();
    }
    for (const p of live.pops) p.age += dt;
    live.pops = live.pops.filter((p) => p.age < 0.5);

    // Paint.
    const { ctx, canvas } = layer.main;
    const { s } = layer;
    const wind = (x: number) => windAt(g.gusts, x);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.drawImage(layer.ground.canvas, 0, 0);
    drawTufts(ctx, W, H, s, t, wind);
    const plants = [...g.plants].sort(byDepth);
    for (const p of plants) drawTarget(ctx, p, s, t);
    for (const p of plants) {
      drawPlant(ctx, p, s, t);
      drawRootTuft(ctx, p, s);
    }
    for (const c of g.swarm.list) drawCritter(ctx, c, s, t);
    for (const p of live.pops) drawPop(ctx, p.at, p.age, s);
    for (const c of cursors) drawCursor(ctx, c.at, c.ratio, c.pinched, s);
    layer.texture.needsUpdate = true;
  });

  return (
    <mesh
      name="garden"
      material={layer.material}
      renderOrder={50}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
};

export const Garden = () => (
  <>
    <HandTracker />
    <GardenLayer />
  </>
);
