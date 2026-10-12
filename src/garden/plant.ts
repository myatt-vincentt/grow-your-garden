// A plant — pure, unit-tested (plant.test.ts). No drawing here (see draw.ts).
//
// A pinch at `target` roots a plant in the ground below it. Its stem follows a
// natural path — up out of the soil first, bowing to one side, arriving at the
// target from below so the flower faces up — sampled into points with their
// arc lengths. It grows along that path (fast at first, easing in), leaves
// unfurl as the tip passes them, and once it arrives the flower blooms. All
// the while it sways: a damped spring bending it about its root, nudged by an
// idle breeze and by gusts.
import {
  BLOOM,
  FLOWER_COLORS,
  GREENS,
  GROUND,
  RESET_TIME,
  STEM,
  SWAY,
} from "./config";

export type Pt = { x: number; y: number };

export type FlowerKind = keyof typeof FLOWER_COLORS;
export const FLOWER_KINDS = Object.keys(FLOWER_COLORS) as FlowerKind[];

export type Leaf = {
  /** Where on the stem, as a share of its length. */
  at: number;
  side: -1 | 1;
  size: number;
  /** Angle off the stem (radians). */
  angle: number;
};

export type Flower = {
  kind: FlowerKind;
  color: string;
  radius: number;
  /** Petal count, and a fixed twist (radians) so no two look alike. */
  petals: number;
  spin: number;
};

export type Plant = {
  id: number;
  root: Pt;
  target: Pt;
  /** The stem's path root → tip (unswayed), and the arc length at each point. */
  path: Pt[];
  arc: number[];
  length: number;
  /** Seconds grown, and the seconds it takes. */
  grown: number;
  growTime: number;
  leaves: Leaf[];
  flower: Flower;
  /** Seconds since the flower began to open (−1: not yet). */
  bloom: number;
  /** Size by depth: roots nearer the front are bigger and drawn on top. */
  scale: number;
  depth: number;
  green: number;
  /** Sway: the bend at the tip (radians) and its rate; a phase for the idle breeze. */
  bend: number;
  bendVel: number;
  phase: number;
  /** Seconds sinking back into the ground (−1: not sinking). */
  sink: number;
};

const PATH_POINTS = 40;

const pick = <T>(list: readonly T[], random: () => number): T =>
  list[Math.floor(random() * list.length) % list.length];
const between = ([a, b]: readonly [number, number], random: () => number) =>
  a + (b - a) * random();
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Top edge of the ground band (design px). */
export const groundTop = (h: number) => h * GROUND.top;

/** A random flower: kind, colour, size, petal count. */
export const randomFlower = (random: () => number, size = 1): Flower => {
  const kind = pick(FLOWER_KINDS, random);
  const petals: Record<FlowerKind, [number, number]> = {
    daisy: [11, 15],
    tulip: [3, 3],
    sunflower: [14, 18],
    blossom: [5, 6],
    rose: [5, 5],
  };
  const [lo, hi] = petals[kind];
  return {
    kind,
    color: pick(FLOWER_COLORS[kind], random),
    radius: between(BLOOM.radius, random) * size,
    petals: lo + Math.floor(random() * (hi - lo + 1)),
    spin: random() * Math.PI * 2,
  };
};

/**
 * A new plant reaching for `target` on a `w` × `h` screen. The root lands in
 * the ground below it (a little to either side); a target too close to the
 * ground, or in it, is lifted to `STEM.minHeight` above the root.
 */
export const createPlant = (
  id: number,
  target: Pt,
  w: number,
  h: number,
  random: () => number,
): Plant => {
  const top = groundTop(h);
  const depth = between(GROUND.rootDepth, random);
  const root = {
    x: clamp(target.x + (random() * 2 - 1) * GROUND.rootJitter, 16, w - 16),
    y: top + depth * (h - top),
  };
  const scale = 0.85 + 0.3 * depth;
  const tip = {
    x: clamp(target.x, 24, w - 24),
    y: clamp(target.y, 40, root.y - STEM.minHeight),
  };
  const height = root.y - tip.y;
  const dx = tip.x - root.x;
  // Bow to one side (more for a tall stem), arriving from below: the first
  // control point rises from the root, the second sits under the tip.
  const side = random() < 0.5 ? -1 : 1;
  const bow = side * STEM.bow * height * (0.4 + 0.6 * random());
  const c1 = { x: root.x + bow, y: root.y - height * 0.42 };
  const c2 = { x: tip.x - dx * 0.15 + bow * 0.35, y: tip.y + height * 0.4 };
  const wiggle = STEM.wiggle * height * (random() * 2 - 1);
  const path: Pt[] = [];
  for (let i = 0; i < PATH_POINTS; i++) {
    const t = i / (PATH_POINTS - 1);
    const u = 1 - t;
    const x =
      u * u * u * root.x +
      3 * u * u * t * c1.x +
      3 * u * t * t * c2.x +
      t * t * t * tip.x;
    const y =
      u * u * u * root.y +
      3 * u * u * t * c1.y +
      3 * u * t * t * c2.y +
      t * t * t * tip.y;
    // An S-curve wiggle sideways, zero at both ends.
    path.push({ x: x + wiggle * Math.sin(t * Math.PI * 2), y });
  }
  const arc = [0];
  for (let i = 1; i < path.length; i++)
    arc.push(
      arc[i - 1] +
        Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y),
    );
  const length = arc[arc.length - 1];
  const count = Math.max(STEM.minLeaves, Math.floor(length / STEM.leafEvery));
  let leafSide: -1 | 1 = random() < 0.5 ? -1 : 1;
  const leaves: Leaf[] = [];
  for (let i = 0; i < count; i++) {
    leaves.push({
      at: clamp(
        0.12 + (0.7 * (i + 0.5)) / count + (random() - 0.5) * 0.08,
        0.08,
        0.85,
      ),
      side: leafSide,
      size: between(STEM.leafSize, random) * scale,
      angle: 0.55 + 0.45 * random(),
    });
    leafSide = leafSide === 1 ? -1 : 1;
  }
  return {
    id,
    root,
    target: tip,
    path,
    arc,
    length,
    grown: 0,
    growTime: STEM.growBase + (STEM.growPer1000 * length) / 1000,
    leaves,
    flower: randomFlower(random, scale),
    bloom: -1,
    scale,
    depth,
    green: Math.floor(random() * GREENS.length) % GREENS.length,
    bend: 0,
    bendVel: 0,
    phase: random() * Math.PI * 2,
    sink: -1,
  };
};

/** Growth 0..1: quick out of the ground, easing in as it arrives. */
export const growth = (p: Plant) => {
  const u = clamp(p.grown / p.growTime, 0, 1);
  return 1 - (1 - u) ** 2.2;
};

/** How far it has sunk back into the ground, 0..1. */
export const sunk = (p: Plant) =>
  p.sink < 0 ? 0 : clamp(p.sink / RESET_TIME, 0, 1);

/** Sinking: the flower closes over this first share of it, then the stem pulls back down. */
const CLOSE_SHARE = 0.3;

/**
 * Bloom 0..~1.08: the flower opens with a little overshoot, then settles at
 * 1; while sinking it closes back to a bud.
 */
export const bloomAmount = (p: Plant) => {
  if (p.bloom < 0) return 0;
  const u = clamp(p.bloom / BLOOM.time, 0, 1);
  // Ease-out-back.
  const k = 1.7;
  const open = 1 + (k + 1) * (u - 1) ** 3 + k * (u - 1) ** 2;
  return open * (1 - clamp(sunk(p) / CLOSE_SHARE, 0, 1));
};

/**
 * How much of the stem shows, 0..1: its growth, pulled back down into the
 * root while sinking (after the flower has closed).
 */
export const shown = (p: Plant) => {
  const back = clamp((sunk(p) - CLOSE_SHARE) / (1 - CLOSE_SHARE), 0, 1);
  return growth(p) * (1 - back * back * (3 - 2 * back));
};

/** The plant is fully open. */
export const bloomed = (p: Plant) => p.bloom >= BLOOM.time && p.sink < 0;

export type StepEvents = { bloomed?: boolean };

/**
 * Advance one frame: grow, bloom, sway (`wind`: the gust force here, signed;
 * `t`: the clock, for the idle breeze), sink. Returns what happened.
 */
export const stepPlant = (
  p: Plant,
  dt: number,
  t: number,
  wind: number,
): StepEvents => {
  const ev: StepEvents = {};
  if (p.sink >= 0) p.sink += dt;
  else if (p.grown < p.growTime) {
    p.grown = Math.min(p.growTime, p.grown + dt);
  } else if (p.bloom < 0) {
    p.bloom = 0;
    ev.bloomed = true;
  } else p.bloom += dt;
  // Sway: a damped spring toward the idle breeze, pushed by gusts. Taller
  // plants (and flowers on top) catch more wind.
  const rest = SWAY.idle * Math.sin(t * SWAY.idleSpeed + p.phase);
  const catchWind = 0.6 + 0.4 * Math.min(1, p.length / 600);
  const acc =
    -SWAY.stiffness * (p.bend - rest) -
    SWAY.damping * p.bendVel +
    SWAY.push * wind * catchWind;
  p.bendVel += acc * dt;
  p.bend = clamp(p.bend + p.bendVel * dt, -SWAY.maxBend, SWAY.maxBend);
  if (Math.abs(p.bend) === SWAY.maxBend) p.bendVel *= 0.5;
  return ev;
};

/** Rotate `q` about `o` by `a` radians. */
const rotate = (q: Pt, o: Pt, a: number): Pt => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = q.x - o.x;
  const y = q.y - o.y;
  return { x: o.x + x * c - y * s, y: o.y + x * s + y * c };
};

/**
 * The visible stem, swayed: the path up to how far it shows (the last point
 * interpolated), each point bent about the root by `bend` × its share of the
 * way up.
 */
export const stemPoints = (p: Plant): Pt[] => {
  const reach = shown(p) * p.length;
  const out: Pt[] = [];
  const place = (q: Pt, s: number) =>
    rotate(q, p.root, p.bend * (s / p.length) ** 1.3);
  for (let i = 0; i < p.path.length; i++) {
    if (p.arc[i] <= reach) {
      out.push(place(p.path[i], p.arc[i]));
    } else {
      if (i > 0 && reach > p.arc[i - 1]) {
        const a = p.arc[i - 1];
        const f = (reach - a) / Math.max(1e-6, p.arc[i] - a);
        const q = {
          x: p.path[i - 1].x + (p.path[i].x - p.path[i - 1].x) * f,
          y: p.path[i - 1].y + (p.path[i].y - p.path[i - 1].y) * f,
        };
        out.push(place(q, reach));
      }
      break;
    }
  }
  return out;
};

/** A point on the visible stem at arc share `at` (0 root .. 1 full length), with its direction (radians). */
export const pointAt = (
  pts: readonly Pt[],
  p: Plant,
  at: number,
): { pos: Pt; dir: number } | null => {
  const s = at * p.length;
  if (s > shown(p) * p.length || pts.length < 2) return null;
  let i = 1;
  while (i < pts.length - 1 && p.arc[i] < s) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const f = clamp(
    (s - p.arc[i - 1]) / Math.max(1e-6, p.arc[i] - p.arc[i - 1]),
    0,
    1,
  );
  return {
    pos: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
    dir: Math.atan2(b.y - a.y, b.x - a.x),
  };
};

/** The tip: where the bud / flower sits, and the stem's heading there (radians). */
export const tipPose = (
  pts: readonly Pt[],
): { pos: Pt; dir: number } | null => {
  if (pts.length < 2) return null;
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  return { pos: b, dir: Math.atan2(b.y - a.y, b.x - a.x) };
};

/** Draw order: roots further back first. */
export const byDepth = (a: Plant, b: Plant) => a.depth - b.depth;
