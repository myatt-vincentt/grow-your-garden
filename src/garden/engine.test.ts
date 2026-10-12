import { describe, expect, it } from "vitest";

import { BLOOM, MAX_PLANTS, RESET_TIME, SWAY } from "./config";
import { wanted } from "./critters";
import {
  addGust,
  createGarden,
  plantAt,
  resetGarden,
  stepGarden,
} from "./engine";
import { windAt } from "./wind";

const W = 720;
const H = 1280;
const random = (() => {
  let s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
})();

const run = (g: ReturnType<typeof createGarden>, seconds: number, from = 0) => {
  let t = from;
  const bloomed = [];
  for (; t < from + seconds; t += 1 / 30)
    bloomed.push(...stepGarden(g, 1 / 30, t, W, H, random).bloomed);
  return bloomed;
};

describe("wind", () => {
  it("a gust reaches near plants first, far ones later", () => {
    const gusts = [{ x: 100, dir: 1 as const, strength: 1, age: 0.1 }];
    expect(windAt(gusts, 100)).toBeGreaterThan(0);
    expect(windAt(gusts, 600)).toBe(0); // not there yet
    gusts[0].age = 500 / SWAY.travel + 0.1;
    expect(windAt(gusts, 600)).toBeGreaterThan(0);
  });
});

describe("garden", () => {
  it("plants grow, bloom (once each) and bring butterflies and bees", () => {
    const g = createGarden();
    for (let i = 0; i < 6; i++)
      plantAt(g, { x: 80 + i * 110, y: 500 }, W, H, random);
    const bloomed = run(g, 6);
    expect(bloomed.length).toBe(6);
    expect(g.blooms).toBe(6);
    const want = wanted(6);
    const kinds = (k: string) =>
      g.swarm.list.filter((c) => c.kind === k).length;
    expect(kinds("butterfly")).toBe(want.butterfly);
    expect(kinds("bee")).toBe(want.bee);
    // Given time, they land on flowers.
    run(g, 8, 6);
    expect(g.swarm.list.some((c) => c.state === "rest")).toBe(true);
  });

  it("a gust leans the plants it passes", () => {
    const g = createGarden();
    const p = plantAt(g, { x: 360, y: 400 }, W, H, random);
    run(g, p.growTime + BLOOM.time);
    addGust(g, { x: 360, dir: -1, strength: 1.2 });
    let lean = 0;
    for (let i = 0; i < 20; i++) {
      stepGarden(g, 1 / 30, 10 + i / 30, W, H, random);
      lean = Math.min(lean, p.bend);
    }
    expect(lean).toBeLessThan(-0.08);
  });

  it("reset sinks everything away; the critters leave", () => {
    const g = createGarden();
    for (let i = 0; i < 6; i++)
      plantAt(g, { x: 80 + i * 110, y: 500 }, W, H, random);
    run(g, 6);
    resetGarden(g);
    run(g, RESET_TIME + 0.1, 6);
    expect(g.plants.length).toBe(0);
    run(g, 8, 7);
    expect(g.swarm.list.length).toBe(0);
  });

  it("past the cap, the oldest sinks away", () => {
    const g = createGarden();
    for (let i = 0; i < MAX_PLANTS + 3; i++)
      plantAt(g, { x: 50 + ((i * 7) % 600), y: 500 }, W, H, random);
    run(g, RESET_TIME + 0.1);
    expect(g.plants.length).toBe(MAX_PLANTS);
    expect(g.plants[0].id).toBe(4);
  });
});
