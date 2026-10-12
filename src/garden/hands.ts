// Reading the hands — pure, unit-tested (hands.test.ts). Per hand, per frame:
//
//   🤏 pinch  thumb tip to index tip under PINCH.closed palm sizes, the index
//            reaching out, for PINCH.hold → plant at the point between them
//            (once; open past PINCH.open to pinch again)
//   ✋ swipe  an open palm moving sideways faster than SWIPE.speed → a gust
//            that way, stronger the faster
//
// Measured in design px (the tracker's x and y have different scales on a
// portrait screen, so ratios there would lean with the hand).
import { PINCH, SWIPE } from "./config";
import type { Pt } from "./plant";

/** One hand this frame (design px), or null when it isn't seen. */
export type HandInput = {
  thumbTip: Pt;
  indexTip: Pt;
  wrist: Pt;
  middleBase: Pt;
  /** Palm centre, for swipes. */
  palm: Pt;
  /** Open-palm score 0..1 (the SDK's measureOpenPalm). */
  open: number;
};

export type HandTrack = {
  seen: boolean;
  /** Its palm centre last frame (null: not seen), for matching hands up. */
  at: Pt | null;
  pinched: boolean;
  /** Pinch closeness: thumb–index gap ÷ palm size (lower = closer). */
  ratio: number;
  /** Seconds thumb and index have been closed (a pinch shape) so far. */
  closedFor: number;
  /** The point between thumb and index tips. */
  point: Pt | null;
  pinchCool: number;
  /** Palm x last frame, smoothed sideways speed (screen widths / s). */
  lastX: number | null;
  vx: number;
  swipeCool: number;
};

export const createHandTrack = (): HandTrack => ({
  seen: false,
  at: null,
  pinched: false,
  ratio: 1,
  closedFor: 0,
  point: null,
  pinchCool: 0,
  lastX: null,
  vx: 0,
  swipeCool: 0,
});

export type HandEvents = {
  /** A pinch closed here: plant. */
  pinch?: Pt;
  /** A swipe: a gust from `x` blowing `dir`, `strength` 0..SWIPE.max. */
  gust?: { x: number; dir: -1 | 1; strength: number };
};

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Advance one hand's track by one frame on a `w`-wide screen. */
export const stepHand = (
  h: HandTrack,
  input: HandInput | null,
  dt: number,
  w: number,
): HandEvents => {
  h.pinchCool = Math.max(0, h.pinchCool - dt);
  h.swipeCool = Math.max(0, h.swipeCool - dt);
  const ev: HandEvents = {};
  if (!input) {
    h.seen = false;
    h.closedFor = 0;
    h.at = null;
    h.point = null;
    h.lastX = null;
    h.vx = 0;
    return ev;
  }
  // A jump across the screen in one frame is another hand (the tracker can
  // swap them): start over, as if it just arrived.
  if (
    h.lastX !== null &&
    Math.abs(input.palm.x - h.lastX) > SWIPE.teleport * w
  ) {
    h.seen = false;
    h.lastX = null;
    h.vx = 0;
  }
  const palm = Math.max(1, dist(input.wrist, input.middleBase));
  h.ratio = dist(input.thumbTip, input.indexTip) / palm;
  h.point = {
    x: (input.thumbTip.x + input.indexTip.x) / 2,
    y: (input.thumbTip.y + input.indexTip.y) / 2,
  };
  // A pinch: thumb and index tips together, the index reaching out (a fist
  // or a thumbs-up curls it into the palm, and can bring the tips close).
  const reach = dist(input.indexTip, input.wrist) / palm;
  const closed = h.ratio < PINCH.closed && reach >= PINCH.reach;
  h.closedFor = closed ? h.closedFor + dt : 0;
  if (!h.seen) {
    // A hand that arrives already pinched doesn't plant until it opens.
    h.seen = true;
    h.pinched = closed;
  } else if (!h.pinched && h.closedFor >= PINCH.hold) {
    h.pinched = true;
    if (h.pinchCool === 0) {
      ev.pinch = h.point;
      h.pinchCool = PINCH.cooldown;
    }
  } else if (h.pinched && h.ratio > PINCH.open) {
    h.pinched = false;
  }
  // Swipe: sideways palm speed, smoothed over a few frames.
  if (h.lastX !== null && dt > 0) {
    const v = (input.palm.x - h.lastX) / dt / w;
    h.vx += (v - h.vx) * (1 - Math.exp(-dt * 14));
  }
  h.lastX = input.palm.x;
  h.at = input.palm;
  const speed = Math.abs(h.vx);
  if (
    input.open >= SWIPE.palm &&
    !h.pinched &&
    speed >= SWIPE.speed &&
    h.swipeCool === 0
  ) {
    ev.gust = {
      x: input.palm.x,
      dir: h.vx > 0 ? 1 : -1,
      strength: Math.min(SWIPE.max, 0.6 + (speed - SWIPE.speed) * SWIPE.gain),
    };
    h.swipeCool = SWIPE.cooldown;
  }
  return ev;
};

/**
 * Pair this frame's hands (their palm centres) with last frame's tracks,
 * nearest first, ignoring pairs further apart than `maxJump`. Returns, per
 * palm, the index of its track, or −1 for a hand that's new. (The tracker's
 * left / right labels can swap between frames, so they can't be the key.)
 */
export const matchHands = (
  tracks: readonly (Pt | null)[],
  palms: readonly Pt[],
  maxJump: number,
): number[] => {
  const pairs: { d: number; t: number; p: number }[] = [];
  tracks.forEach((at, t) => {
    if (!at) return;
    palms.forEach((q, p) => {
      const d = dist(at, q);
      if (d <= maxJump) pairs.push({ d, t, p });
    });
  });
  pairs.sort((a, b) => a.d - b.d);
  const out = palms.map(() => -1);
  const used = new Set<number>();
  for (const { t, p } of pairs) {
    if (out[p] !== -1 || used.has(t)) continue;
    out[p] = t;
    used.add(t);
  }
  return out;
};
