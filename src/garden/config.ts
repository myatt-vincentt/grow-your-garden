// Every tunable in one place. Units: design px (the 1280-tall design screen,
// x right, y down), seconds, unless noted.

/** The ground: a grassy band along the bottom of the screen; stems root in it. */
export const GROUND = {
  /** Its top edge, as a share of the screen height from the top. */
  top: 0.86,
  /** Roots sit this deep into the band (share of its height): further down = nearer = drawn on top. */
  rootDepth: [0.15, 0.75] as const,
  /** A root lands this far (px) either side of the pinch. */
  rootJitter: 40,
  /** Grass tufts along the edge, per 100 px of width. */
  tufts: 3.2,
};

/** Pinch: thumb tip to index tip ÷ palm size (wrist to middle-finger base). */
export const PINCH = {
  /** Closed below this, open again above `open` (hysteresis: no flicker). */
  closed: 0.3,
  open: 0.48,
  /** One pinch per hand at most this often. */
  cooldown: 0.35,
  /** Closed this long (s) before it counts: a one-frame tracking glitch doesn't plant. */
  hold: 0.06,
  /**
   * The index fingertip must be at least this far from the wrist (palm
   * sizes): out in a pinch, curled into the palm in a fist or a thumbs-up.
   */
  reach: 1.0,
};

/** Wind: an open palm swept sideways. */
export const SWIPE = {
  /** Open-palm score (SDK measureOpenPalm) needed. */
  palm: 0.7,
  /** Sideways palm speed (screen widths per second) that counts as a swipe. */
  speed: 1.1,
  /** One gust per hand at most this often. */
  cooldown: 0.5,
  /** Gust strength per unit of speed above the threshold, and its cap. */
  gain: 0.9,
  max: 1.6,
  /**
   * A palm jumping further than this (share of the width) in one frame is
   * another hand, not a swipe (the tracker can swap hands between frames).
   */
  teleport: 0.3,
};

/** How a stem grows: its path, its pace, its leaves. */
export const STEM = {
  /** Targets closer to the ground than this are lifted to it. */
  minHeight: 90,
  /** Seconds to grow: base + per 1000 px of length. */
  growBase: 0.7,
  growPer1000: 1.4,
  /** Side-to-side bow of the path, as a share of its height (random up to this). */
  bow: 0.22,
  /** Extra S-curve wiggle, share of height. */
  wiggle: 0.06,
  /** Stem width at the root and the tip (px), scaled by the plant's size. */
  width: [14, 6] as const,
  /** Leaves: one per this many px of stem, at least `minLeaves`. */
  leafEvery: 130,
  minLeaves: 1,
  leafSize: [32, 52] as const,
  /** Seconds a leaf takes to unfurl. */
  leafUnfurl: 0.45,
};

/** Blooming at the tip once the stem arrives. */
export const BLOOM = {
  /** Seconds to open fully (with a little overshoot). */
  time: 0.9,
  /** Flower radius (px): random in this range, × the plant's size. */
  radius: [44, 68] as const,
};

/** Swaying: each plant is a damped spring bending at its root. */
export const SWAY = {
  /** Idle breeze: angle (radians) and how fast it drifts. */
  idle: 0.035,
  idleSpeed: 0.7,
  /** Spring stiffness and damping (per second). */
  stiffness: 9,
  damping: 2.6,
  /** Gust push (radians per second² per unit of strength). */
  push: 7.5,
  /** Most a plant bends (radians at the tip). */
  maxBend: 0.65,
  /** A gust rolls across the screen at this speed (px/s) from the hand. */
  travel: 1500,
  /** And pushes for this long where it passes. */
  pulse: 0.45,
};

/** Plants on screen at most; past it, the oldest sinks back into the ground. */
export const MAX_PLANTS = 70;

/** Reset: flowers close, then every stem pulls back into the ground, over this long. */
export const RESET_TIME = 1.0;

/** Butterflies and bees: how many, per bloomed flower, and how they fly. */
export const CRITTERS = {
  butterflies: { per: 2, max: 5 },
  bees: { per: 3, max: 4 },
  /** Cruising speed (px/s), and how long they sit on a flower (s). */
  speed: { butterfly: 190, bee: 260 },
  rest: { butterfly: [1.6, 3.6] as const, bee: [0.8, 1.8] as const },
  /** A gust blows them this far (px per unit of strength). */
  blown: 260,
};

/** Flower colours by kind (petals; the centre is chosen by the kind). */
export const FLOWER_COLORS = {
  daisy: ["#ffffff", "#fff2f8", "#fdf6d8"],
  tulip: ["#ff5a6e", "#ffb02e", "#e04dc2", "#ff7b3d"],
  sunflower: ["#ffc93c", "#ffb31a"],
  blossom: ["#ff8fc2", "#b48cff", "#6fa8ff", "#ff9f7a"],
  rose: ["#e8364f", "#ff6f91", "#c2185b", "#ffa1b5"],
} as const;

/** Flat illustration: one outline colour and weight for everything. */
export const INK = { color: "#2b2340", width: 3.2 };

/** Leaf and stem greens (a few, picked per plant). */
export const GREENS = [
  { stem: "#3f9b4a", leaf: "#5cc45f", vein: "#2f7a3a" },
  { stem: "#4c8f3a", leaf: "#7bcf4f", vein: "#3a6f2c" },
  { stem: "#2f8a5a", leaf: "#4fbf86", vein: "#256b46" },
] as const;

/** The garden canvas is drawn at this height (px), the width follows the screen. */
export const CANVAS = { height: 1100 };
