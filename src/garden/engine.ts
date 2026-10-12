// The garden engine — pure, unit-tested (engine.test.ts): the plants, the
// wind and the butterflies and bees, stepped together. The scene feeds it
// pinches, gusts and resets; draw.ts paints it.
import { MAX_PLANTS, RESET_TIME } from "./config";
import { createSwarm, type Perch, stepSwarm, type Swarm } from "./critters";
import {
  bloomAmount,
  bloomed,
  createPlant,
  type Plant,
  type Pt,
  stemPoints,
  stepPlant,
  tipPose,
} from "./plant";
import { type Gust, stepGusts, windAt } from "./wind";

export type Garden = {
  plants: Plant[];
  gusts: Gust[];
  swarm: Swarm;
  nextId: number;
  /** Counters (for the prompt's walkthrough and the dev hook). */
  planted: number;
  blooms: number;
  windCount: number;
};

export const createGarden = (): Garden => ({
  plants: [],
  gusts: [],
  swarm: createSwarm(),
  nextId: 1,
  planted: 0,
  blooms: 0,
  windCount: 0,
});

/** Plant toward `target`. Past MAX_PLANTS, the oldest standing plant sinks away. */
export const plantAt = (
  g: Garden,
  target: Pt,
  w: number,
  h: number,
  random: () => number,
): Plant => {
  const p = createPlant(g.nextId++, target, w, h, random);
  g.plants.push(p);
  g.planted++;
  const standing = g.plants.filter((q) => q.sink < 0);
  if (standing.length > MAX_PLANTS) standing[0].sink = 0;
  return p;
};

export const addGust = (g: Garden, gust: Omit<Gust, "age">) => {
  g.gusts.push({ ...gust, age: 0 });
  g.windCount++;
};

/** Everything sinks back into the ground. */
export const resetGarden = (g: Garden) => {
  for (const p of g.plants) if (p.sink < 0) p.sink = 0;
};

/** Where a plant's flower centre is now (null while it has no stem). */
export const flowerCentre = (p: Plant): Pt | null =>
  tipPose(stemPoints(p))?.pos ?? null;

export type GardenEvents = {
  /** Flowers that began to open this frame. */
  bloomed: Plant[];
};

/** Advance the garden one frame on a `w` × `h` screen; `t`: the clock. */
export const stepGarden = (
  g: Garden,
  dt: number,
  t: number,
  w: number,
  h: number,
  random: () => number,
): GardenEvents => {
  const ev: GardenEvents = { bloomed: [] };
  stepGusts(g.gusts, dt, w);
  for (const p of g.plants) {
    // The wind at the flower's height leans the plant.
    if (stepPlant(p, dt, t, windAt(g.gusts, p.target.x)).bloomed) {
      ev.bloomed.push(p);
      g.blooms++;
    }
  }
  g.plants = g.plants.filter((p) => p.sink < RESET_TIME);
  const perches: Perch[] = [];
  for (const p of g.plants) {
    if (!bloomed(p) || bloomAmount(p) < 0.9) continue;
    const pos = flowerCentre(p);
    if (pos) perches.push({ id: p.id, pos });
  }
  stepSwarm(g.swarm, perches, (x) => windAt(g.gusts, x), dt, t, w, h, random);
  return ev;
};
