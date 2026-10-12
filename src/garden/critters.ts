// Butterflies and bees — pure, unit-tested (critters.test.ts). They arrive as
// flowers bloom (one butterfly per CRITTERS.butterflies.per flowers, one bee
// per CRITTERS.bees.per, up to a cap), fly to a bloomed flower, rest on it a
// while, then pick another. A gust blows them off course (and off a flower);
// with no flowers left (a reset) they fly away.
import { CRITTERS } from "./config";
import type { Pt } from "./plant";

export type CritterKind = "butterfly" | "bee";

export type Critter = {
  id: number;
  kind: CritterKind;
  pos: Pt;
  vel: Pt;
  /** The flower it's headed for or sitting on (a plant id), if any. */
  target: number | null;
  state: "fly" | "rest" | "leave";
  /** Seconds left resting. */
  timer: number;
  /** A per-critter phase for flutter and wing beats. */
  seed: number;
  /** Faces right (1) or left (−1). */
  facing: 1 | -1;
};

/** A bloomed flower they can visit: its plant id and where its centre is now. */
export type Perch = { id: number; pos: Pt };

export type Swarm = { list: Critter[]; nextId: number };

export const createSwarm = (): Swarm => ({ list: [], nextId: 1 });

/** How many of each the garden wants for `flowers` bloomed flowers. */
export const wanted = (flowers: number) => ({
  butterfly: Math.min(
    CRITTERS.butterflies.max,
    Math.floor(flowers / CRITTERS.butterflies.per),
  ),
  bee: Math.min(CRITTERS.bees.max, Math.floor(flowers / CRITTERS.bees.per)),
});

const choose = (
  perches: readonly Perch[],
  avoid: number | null,
  random: () => number,
): number | null => {
  const options = perches.filter((p) => p.id !== avoid);
  const list = options.length ? options : perches;
  if (!list.length) return null;
  return list[Math.floor(random() * list.length) % list.length].id;
};

/**
 * Advance the swarm one frame. `perches`: the bloomed flowers now; `wind(x)`:
 * the gust force there; `w` × `h`: the screen; `t`: the clock.
 */
export const stepSwarm = (
  swarm: Swarm,
  perches: readonly Perch[],
  wind: (x: number) => number,
  dt: number,
  t: number,
  w: number,
  h: number,
  random: () => number,
) => {
  // Arrivals and departures to match the flowers.
  const want = wanted(perches.length);
  for (const kind of ["butterfly", "bee"] as const) {
    const staying = swarm.list.filter(
      (c) => c.kind === kind && c.state !== "leave",
    );
    if (staying.length < want[kind]) {
      const fromLeft = random() < 0.5;
      swarm.list.push({
        id: swarm.nextId++,
        kind,
        pos: { x: fromLeft ? -30 : w + 30, y: h * (0.15 + 0.45 * random()) },
        vel: { x: 0, y: 0 },
        target: choose(perches, null, random),
        state: "fly",
        timer: 0,
        seed: random() * 100,
        facing: fromLeft ? 1 : -1,
      });
    } else if (staying.length > want[kind]) {
      staying[staying.length - 1].state = "leave";
    }
  }
  const byId = new Map(perches.map((p) => [p.id, p.pos]));
  for (const c of swarm.list) {
    const speed = CRITTERS.speed[c.kind];
    const gust = wind(c.pos.x);
    if (c.state === "rest") {
      const perch = c.target !== null ? byId.get(c.target) : undefined;
      c.timer -= dt;
      if (!perch || Math.abs(gust) > 0.35 || c.timer <= 0) {
        // Off again: to another flower.
        c.state = "fly";
        c.target = choose(perches, c.target, random);
        c.vel = { x: (random() - 0.5) * speed, y: -speed * 0.6 };
      } else {
        // Sit on the flower as it sways.
        c.pos = { x: perch.x, y: perch.y - 6 };
        c.vel = { x: 0, y: 0 };
        continue;
      }
    }
    let goal: Pt;
    if (c.state === "leave" || !perches.length) {
      c.state = "leave";
      goal = { x: c.pos.x < w / 2 ? -80 : w + 80, y: c.pos.y - 120 };
    } else {
      if (c.target === null || !byId.has(c.target))
        c.target = choose(perches, null, random);
      goal = byId.get(c.target as number) ?? { x: w / 2, y: h / 2 };
    }
    const dx = goal.x - c.pos.x;
    const dy = goal.y - c.pos.y;
    const d = Math.max(1e-6, Math.hypot(dx, dy));
    if (c.state === "fly" && d < 14) {
      const [lo, hi] = CRITTERS.rest[c.kind];
      c.state = "rest";
      c.timer = lo + (hi - lo) * random();
      continue;
    }
    // Steer toward the goal (slowing on arrival), with a flutter across it:
    // butterflies drift in lazy loops, bees zigzag quick and tight.
    const arrive = Math.min(1, d / 120);
    const flutter =
      c.kind === "butterfly"
        ? Math.sin(t * 2.6 + c.seed) * 0.8
        : Math.sin(t * 11 + c.seed) * 0.6;
    const steer = {
      x: (dx / d) * speed * arrive + (-dy / d) * flutter * speed * arrive,
      y:
        (dy / d) * speed * arrive +
        (dx / d) * flutter * speed * arrive +
        (c.kind === "butterfly" ? Math.sin(t * 5 + c.seed) * 40 : 0),
    };
    const k = 1 - Math.exp(-dt * (c.kind === "bee" ? 6 : 3));
    c.vel.x += (steer.x - c.vel.x) * k + gust * CRITTERS.blown * dt * 4;
    c.vel.y += (steer.y - c.vel.y) * k;
    c.pos.x += c.vel.x * dt;
    c.pos.y += c.vel.y * dt;
    if (Math.abs(c.vel.x) > 8) c.facing = c.vel.x > 0 ? 1 : -1;
  }
  // Gone once they've left the screen.
  swarm.list = swarm.list.filter(
    (c) => c.state !== "leave" || (c.pos.x > -60 && c.pos.x < w + 60),
  );
};
