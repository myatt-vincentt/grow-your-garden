import { describe, expect, it } from "vitest";

import { PINCH, SWIPE } from "./config";
import { createHandTrack, type HandInput, matchHands, stepHand } from "./hands";

const W = 720;

/** A hand with its palm at (x, y), 100 px palm size, thumb–index gap `gap` palms, open-palm score `open`. */
const hand = (x: number, y: number, gap: number, open = 0): HandInput => ({
  wrist: { x, y: y + 100 },
  middleBase: { x, y },
  palm: { x, y: y + 50 },
  thumbTip: { x: x - 30, y: y - 40 },
  indexTip: { x: x - 30 + gap * 100, y: y - 40 },
  open,
});

/** Hold a pinch (gap 0.1 palms) for `seconds`; the events merged. */
const pinchFor = (h: ReturnType<typeof createHandTrack>, seconds: number) => {
  let out: ReturnType<typeof stepHand> = {};
  for (let t = 0; t < seconds; t += 1 / 30) {
    const ev = stepHand(h, hand(300, 500, 0.1), 1 / 30, W);
    out = { ...out, ...ev };
  }
  return out;
};

describe("pinch", () => {
  it("closing thumb and index plants once, between them", () => {
    const h = createHandTrack();
    stepHand(h, hand(300, 500, 0.9), 1 / 30, W);
    const ev = pinchFor(h, PINCH.hold + 0.05);
    expect(ev.pinch).toBeDefined();
    expect(ev.pinch!.x).toBeCloseTo(300 - 30 + 5);
    expect(ev.pinch!.y).toBeCloseTo(460);
    // Holding the pinch doesn't plant again.
    for (let i = 0; i < 30; i++)
      expect(stepHand(h, hand(300, 500, 0.1), 1 / 30, W).pinch).toBeUndefined();
  });

  it("must open past the hysteresis before pinching again", () => {
    const h = createHandTrack();
    stepHand(h, hand(300, 500, 0.9), 1 / 30, W);
    expect(pinchFor(h, PINCH.hold + 0.05).pinch).toBeDefined();
    // Hovering between closed and open: no new pinch.
    const mid = (PINCH.closed + PINCH.open) / 2;
    for (let i = 0; i < 20; i++) stepHand(h, hand(300, 500, mid), 1 / 30, W);
    expect(pinchFor(h, 0.3).pinch).toBeUndefined();
    // Open fully, wait out the cooldown, pinch: plants.
    for (let i = 0; i < 20; i++) stepHand(h, hand(300, 500, 0.9), 1 / 30, W);
    expect(pinchFor(h, PINCH.hold + 0.05).pinch).toBeDefined();
  });

  it("a hand arriving already pinched doesn't plant", () => {
    const h = createHandTrack();
    expect(stepHand(h, hand(300, 500, 0.1), 1 / 30, W).pinch).toBeUndefined();
    expect(stepHand(h, hand(300, 500, 0.1), 1 / 30, W).pinch).toBeUndefined();
  });
});

describe("swipe", () => {
  const sweep = (open: number, pxPerFrame: number, frames = 12) => {
    const h = createHandTrack();
    let gust;
    for (let i = 0; i < frames; i++) {
      const ev = stepHand(
        h,
        hand(100 + i * pxPerFrame, 500, 0.9, open),
        1 / 30,
        W,
      );
      gust = gust ?? ev.gust;
    }
    return gust;
  };

  it("an open palm swept fast makes one gust that way", () => {
    const fast = (SWIPE.speed * 1.6 * W) / 30;
    const right = sweep(0.95, fast);
    expect(right?.dir).toBe(1);
    expect(right!.strength).toBeGreaterThan(0);
    expect(sweep(0.95, -fast)?.dir).toBe(-1);
  });

  it("a slow move or a closed hand doesn't", () => {
    expect(sweep(0.95, (SWIPE.speed * 0.5 * W) / 30)).toBeUndefined();
    expect(sweep(0.2, (SWIPE.speed * 2 * W) / 30)).toBeUndefined();
  });
});

describe("telling hands apart", () => {
  it("pairs hands with their tracks by position, not order", () => {
    const tracks = [
      { x: 100, y: 500 },
      { x: 600, y: 500 },
    ];
    // This frame the tracker lists them the other way round.
    expect(
      matchHands(
        tracks,
        [
          { x: 590, y: 510 },
          { x: 110, y: 490 },
        ],
        200,
      ),
    ).toEqual([1, 0]);
    // A hand far from both is new; a missing track is skipped.
    expect(
      matchHands([null, { x: 600, y: 500 }], [{ x: 100, y: 500 }], 200),
    ).toEqual([-1]);
  });

  it("a palm jumping across the screen is not a swipe (or a pinch)", () => {
    const h = createHandTrack();
    stepHand(h, hand(600, 500, 0.9, 0.95), 1 / 30, W);
    stepHand(h, hand(600, 500, 0.9, 0.95), 1 / 30, W);
    // The tracker swapped hands: same track, now on the far side, pinched.
    const ev = stepHand(h, hand(100, 500, 0.1, 0.95), 1 / 30, W);
    expect(ev.gust).toBeUndefined();
    expect(ev.pinch).toBeUndefined();
    for (let i = 0; i < 10; i++)
      expect(
        stepHand(h, hand(100, 500, 0.1, 0.95), 1 / 30, W).gust,
      ).toBeUndefined();
  });
});

describe("not a pinch", () => {
  it("a one-frame glitch doesn't plant", () => {
    const h = createHandTrack();
    stepHand(h, hand(300, 500, 0.9), 1 / 30, W);
    expect(stepHand(h, hand(300, 500, 0.1), 1 / 60, W).pinch).toBeUndefined();
    expect(stepHand(h, hand(300, 500, 0.9), 1 / 30, W).pinch).toBeUndefined();
  });

  it("a fist (index curled into the palm, thumb over it) doesn't plant", () => {
    const fist = (x: number, y: number): HandInput => ({
      wrist: { x, y: y + 100 },
      middleBase: { x, y },
      palm: { x, y: y + 50 },
      // Index tip curled back near its base; the thumb tip lying beside it.
      indexTip: { x: x - 20, y: y + 20 },
      thumbTip: { x: x - 5, y: y + 15 },
      open: 0,
    });
    const h = createHandTrack();
    stepHand(h, hand(300, 500, 0.9), 1 / 30, W);
    for (let i = 0; i < 20; i++)
      expect(stepHand(h, fist(300, 500), 1 / 30, W).pinch).toBeUndefined();
  });
});
