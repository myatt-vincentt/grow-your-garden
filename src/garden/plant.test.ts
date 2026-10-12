import { describe, expect, it } from "vitest";

import { BLOOM, GROUND, RESET_TIME, STEM } from "./config";
import {
  bloomAmount,
  bloomed,
  createPlant,
  groundTop,
  growth,
  stemPoints,
  stepPlant,
  tipPose,
} from "./plant";

const W = 720;
const H = 1280;

/** A seeded random (mulberry32), so the tests are repeatable. */
const seeded = (seed: number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const grow = (p: ReturnType<typeof createPlant>, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) stepPlant(p, 1 / 60, t, 0);
};

describe("createPlant", () => {
  it("roots in the ground below the pinch and ends at the pinch", () => {
    for (let s = 1; s <= 20; s++) {
      const p = createPlant(s, { x: 300, y: 400 }, W, H, seeded(s));
      expect(p.root.y).toBeGreaterThan(groundTop(H));
      expect(p.root.y).toBeLessThan(H);
      expect(Math.abs(p.root.x - 300)).toBeLessThanOrEqual(GROUND.rootJitter);
      const end = p.path[p.path.length - 1];
      expect(end.x).toBeCloseTo(300);
      expect(end.y).toBeCloseTo(400);
      // It rises all the way (never dips back below where it was much).
      for (let i = 1; i < p.path.length; i++)
        expect(p.path[i].y).toBeLessThan(p.path[i - 1].y + 2);
    }
  });

  it("a pinch near (or in) the ground still gets a stem", () => {
    const p = createPlant(1, { x: 200, y: H - 10 }, W, H, seeded(3));
    expect(p.root.y - p.target.y).toBeGreaterThanOrEqual(STEM.minHeight - 1e-6);
    expect(p.length).toBeGreaterThan(STEM.minHeight * 0.9);
  });

  it("taller stems take longer and carry more leaves", () => {
    const short = createPlant(1, { x: 300, y: 1000 }, W, H, seeded(5));
    const tall = createPlant(2, { x: 300, y: 200 }, W, H, seeded(5));
    expect(tall.growTime).toBeGreaterThan(short.growTime);
    expect(tall.leaves.length).toBeGreaterThan(short.leaves.length);
  });

  it("random flowers vary", () => {
    const kinds = new Set<string>();
    const r = seeded(9);
    for (let i = 0; i < 40; i++)
      kinds.add(createPlant(i, { x: 300, y: 500 }, W, H, r).flower.kind);
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });
});

describe("growing and blooming", () => {
  it("grows along the path, then blooms once it arrives", () => {
    const p = createPlant(1, { x: 360, y: 500 }, W, H, seeded(2));
    expect(stemPoints(p).length).toBeLessThanOrEqual(1);
    grow(p, p.growTime * 0.5);
    expect(growth(p)).toBeGreaterThan(0.5); // quick at first
    expect(growth(p)).toBeLessThan(1);
    expect(bloomAmount(p)).toBe(0);
    const tip = tipPose(stemPoints(p))!.pos;
    expect(tip.y).toBeGreaterThan(500); // not there yet
    grow(p, p.growTime * 0.5 + BLOOM.time + 0.2);
    expect(growth(p)).toBe(1);
    expect(bloomed(p)).toBe(true);
    expect(bloomAmount(p)).toBeCloseTo(1);
    const end = tipPose(stemPoints(p))!.pos;
    expect(Math.hypot(end.x - 360, end.y - 500)).toBeLessThan(25); // there (idle sway aside)
  });

  it("the bloom opens with a little overshoot", () => {
    const p = createPlant(1, { x: 360, y: 500 }, W, H, seeded(2));
    p.grown = p.growTime;
    stepPlant(p, 0, 0, 0); // starts blooming
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      stepPlant(p, BLOOM.time / 60, 0, 0);
      peak = Math.max(peak, bloomAmount(p));
    }
    expect(peak).toBeGreaterThan(1.02);
  });
});

describe("sway", () => {
  it("a gust bends it that way, then it springs back", () => {
    const p = createPlant(1, { x: 360, y: 400 }, W, H, seeded(4));
    p.grown = p.growTime;
    for (let i = 0; i < 20; i++) stepPlant(p, 1 / 60, 0, 1.2);
    expect(p.bend).toBeGreaterThan(0.05);
    const tipBent = tipPose(stemPoints(p))!.pos;
    expect(tipBent.x).toBeGreaterThan(360);
    for (let i = 0; i < 400; i++) stepPlant(p, 1 / 60, 0, 0);
    expect(Math.abs(p.bend)).toBeLessThan(0.05);
  });

  it("sinking closes the flower, then pulls the stem back into the ground", () => {
    const p = createPlant(1, { x: 360, y: 400 }, W, H, seeded(4));
    grow(p, p.growTime + BLOOM.time + 0.1);
    expect(bloomAmount(p)).toBeCloseTo(1);
    const { root } = p;
    p.sink = 0;
    // First the flower closes; the stem is still all there.
    stepPlant(p, RESET_TIME * 0.3, 0, 0);
    expect(bloomAmount(p)).toBe(0);
    expect(tipPose(stemPoints(p))!.pos.y).toBeLessThan(450);
    // Then it shrinks down into its root (not sliding down over the ground).
    stepPlant(p, RESET_TIME * 0.4, 0, 0);
    const mid = tipPose(stemPoints(p))!.pos;
    expect(mid.y).toBeGreaterThan(450);
    expect(mid.y).toBeLessThan(root.y);
    stepPlant(p, RESET_TIME * 0.3 + 0.01, 0, 0);
    expect(stemPoints(p).length).toBeLessThanOrEqual(1);
    expect(stemPoints(p)[0]?.y ?? root.y).toBeCloseTo(root.y);
  });
});
