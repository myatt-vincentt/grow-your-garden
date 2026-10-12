// Painting the garden in a flat, illustrated style: solid fills, one dark ink
// outline, no gradients. Everything is drawn into one 2D canvas each frame, in
// design px scaled by `s` (canvas px per design px).
import type { Critter } from "./critters";
import { GREENS, GROUND, INK, PINCH, STEM } from "./config";
import {
  bloomAmount,
  type Flower,
  growth,
  type Plant,
  pointAt,
  type Pt,
  stemPoints,
  shown,
  sunk,
  tipPose,
} from "./plant";

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Fill, then outline in ink. */
const inked = (ctx: Ctx, fill: string, s: number, width = INK.width) => {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width * s;
  ctx.strokeStyle = INK.color;
  ctx.stroke();
};

/** A cheap per-index hash 0..1 (stable decoration without stored state). */
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ── Ground ────────────────────────────────────────────────────────────────

/**
 * The ground band (static: drawn once per screen size into its own canvas):
 * a grassy hill with a scalloped top edge over a strip of soil, with pebbles
 * and tiny flowers.
 */
export const paintGround = (ctx: Ctx, w: number, h: number, s: number) => {
  const top = h * GROUND.top;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Soil, then grass over it with a bumpy top.
  ctx.beginPath();
  ctx.rect(-10 * s, (top + 30) * s, (w + 20) * s, (h - top) * s);
  inked(ctx, "#8a5a3c", s);
  ctx.beginPath();
  ctx.moveTo(-10 * s, h * s + 10);
  const bumps = Math.max(4, Math.round(w / 90));
  ctx.lineTo(-10 * s, top * s);
  for (let i = 0; i < bumps; i++) {
    const x0 = (i / bumps) * w;
    const x1 = ((i + 1) / bumps) * w;
    const lift = 8 + 10 * hash(i);
    ctx.quadraticCurveTo(
      ((x0 + x1) / 2) * s,
      (top - lift) * s,
      x1 * s,
      top * s,
    );
  }
  ctx.lineTo((w + 10) * s, h * s + 10);
  ctx.closePath();
  inked(ctx, "#6cc551", s);
  // A darker band lower down for depth.
  ctx.beginPath();
  ctx.rect(-10 * s, (top + (h - top) * 0.62) * s, (w + 20) * s, h * s);
  ctx.fillStyle = "#58ad45";
  ctx.fill();
  // Pebbles and tiny flowers scattered in the grass.
  const count = Math.round(w / 40);
  for (let i = 0; i < count; i++) {
    const x = hash(i + 10) * w;
    const y = top + 18 + hash(i + 50) * (h - top - 28);
    if (hash(i + 90) < 0.45) {
      ctx.beginPath();
      ctx.ellipse(x * s, y * s, 7 * s, 4.5 * s, 0, 0, TAU);
      inked(ctx, "#d9cbb8", s, 2);
    } else {
      const c = ["#ffffff", "#ffe066", "#ff9fc8"][i % 3];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        ctx.beginPath();
        ctx.arc(
          (x + Math.cos(a) * 4) * s,
          (y + Math.sin(a) * 4) * s,
          3 * s,
          0,
          TAU,
        );
        ctx.fillStyle = c;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x * s, y * s, 2.2 * s, 0, TAU);
      ctx.fillStyle = "#ffb000";
      ctx.fill();
    }
  }
};

/** Grass tufts along the top edge, leaning with the wind (drawn every frame). */
export const drawTufts = (
  ctx: Ctx,
  w: number,
  h: number,
  s: number,
  t: number,
  wind: (x: number) => number,
) => {
  const top = h * GROUND.top;
  const n = Math.round((w / 100) * GROUND.tufts);
  ctx.lineJoin = "round";
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * w + (hash(i + 7) - 0.5) * 20;
    const y = top + 4 + hash(i + 3) * 8;
    const lean = 0.08 * Math.sin(t * 1.3 + i) + 0.35 * wind(x);
    const blade = (dx: number, len: number) => {
      const tipX = x + dx + Math.sin(lean) * len;
      const tipY = y - Math.cos(lean) * len;
      ctx.beginPath();
      ctx.moveTo((x + dx - 5) * s, y * s);
      ctx.quadraticCurveTo(
        (x + dx - 2) * s,
        (y - len * 0.5) * s,
        tipX * s,
        tipY * s,
      );
      ctx.quadraticCurveTo(
        (x + dx + 2) * s,
        (y - len * 0.5) * s,
        (x + dx + 5) * s,
        y * s,
      );
      ctx.closePath();
      inked(ctx, "#7fd35f", s, 2.4);
    };
    const len = 16 + 10 * hash(i + 11);
    blade(-6, len * 0.8);
    blade(6, len * 0.7);
    blade(0, len);
  }
};

// ── Plants ────────────────────────────────────────────────────────────────

/** A tapered stem: the visible points offset either side, filled and inked. */
const drawStem = (ctx: Ctx, pts: Pt[], p: Plant, color: string, s: number) => {
  if (pts.length < 2) return;
  const [w0, w1] = STEM.width;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1e-6, Math.hypot(dx, dy));
    const f = p.arc[Math.min(i, p.arc.length - 1)] / p.length;
    const half = ((w0 + (w1 - w0) * f) * p.scale) / 2;
    left.push({
      x: pts[i].x - (dy / len) * half,
      y: pts[i].y + (dx / len) * half,
    });
    right.push({
      x: pts[i].x + (dy / len) * half,
      y: pts[i].y - (dx / len) * half,
    });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x * s, left[0].y * s);
  for (const q of left) ctx.lineTo(q.x * s, q.y * s);
  // (No cap at the tip: the bud or flower sits on it.)
  for (let i = right.length - 1; i >= 0; i--)
    ctx.lineTo(right[i].x * s, right[i].y * s);
  ctx.closePath();
  inked(ctx, color, s);
};

/** A leaf from `base`, pointing `dir`, `len` long, with a midrib. */
const drawLeaf = (
  ctx: Ctx,
  base: Pt,
  dir: number,
  len: number,
  green: (typeof GREENS)[number],
  s: number,
) => {
  if (len < 1) return;
  const wide = len * 0.42;
  ctx.save();
  ctx.translate(base.x * s, base.y * s);
  ctx.rotate(dir);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45 * s, -wide * s, len * s, 0);
  ctx.quadraticCurveTo(len * 0.45 * s, wide * s, 0, 0);
  ctx.closePath();
  inked(ctx, green.leaf, s, 2.6);
  ctx.beginPath();
  ctx.moveTo(len * 0.1 * s, 0);
  ctx.quadraticCurveTo(len * 0.5 * s, -wide * 0.12 * s, len * 0.85 * s, 0);
  ctx.lineWidth = 2 * s;
  ctx.strokeStyle = green.vein;
  ctx.stroke();
  ctx.restore();
};

/** A pointed petal along +x, `len` long and `wide` across. */
const petalPath = (ctx: Ctx, len: number, wide: number, round = 0.5) => {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    len * 0.3,
    -wide,
    len * (0.7 + round * 0.3),
    -wide * round,
    len,
    0,
  );
  ctx.bezierCurveTo(
    len * (0.7 + round * 0.3),
    wide * round,
    len * 0.3,
    wide,
    0,
    0,
  );
  ctx.closePath();
};

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
};

/**
 * The flower at the origin, facing the viewer (tulips stand upright), opened
 * by `b` (0 bud … 1 open, a little more while overshooting).
 */
const drawFlower = (ctx: Ctx, f: Flower, b: number, s: number, t: number) => {
  const r = f.radius * s;
  const open = Math.max(0, b);
  if (f.kind === "tulip") {
    // A cup: back petal, then two side petals that part as it opens.
    const hgt = r * 1.25 * Math.min(1, 0.45 + open * 0.55);
    const spread = 0.12 + 0.3 * open;
    const back = shade(f.color, 0.8);
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, 0);
    ctx.quadraticCurveTo(-r * 0.55, -hgt * 0.8, 0, -hgt * 1.05);
    ctx.quadraticCurveTo(r * 0.55, -hgt * 0.8, r * 0.45, 0);
    ctx.quadraticCurveTo(0, r * 0.3, -r * 0.45, 0);
    inked(ctx, back, 1, INK.width * s);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * spread);
      ctx.beginPath();
      ctx.moveTo(0, r * 0.15);
      ctx.quadraticCurveTo(side * r * 0.75, -hgt * 0.2, side * r * 0.32, -hgt);
      ctx.quadraticCurveTo(side * r * 0.05, -hgt * 0.55, 0, r * 0.15);
      inked(ctx, f.color, 1, INK.width * s);
      ctx.restore();
    }
    return;
  }
  ctx.save();
  ctx.rotate(
    f.spin + (1 - Math.min(1, open)) * 0.8 + Math.sin(t * 0.8 + f.spin) * 0.05,
  );
  const n = f.petals;
  if (f.kind === "daisy") {
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate((i / n) * TAU);
      petalPath(ctx, r * open, r * 0.17, 0.9);
      inked(ctx, f.color, 1, 2.4 * s);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.32 * Math.min(1, 0.5 + open), 0, TAU);
    inked(ctx, "#ffc928", 1, INK.width * s);
  } else if (f.kind === "sunflower") {
    for (const ring of [0, 1]) {
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate(((i + ring * 0.5) / n) * TAU);
        petalPath(ctx, r * open * (ring ? 0.88 : 1), r * 0.2, 0.2);
        inked(ctx, ring ? shade(f.color, 0.88) : f.color, 1, 2.4 * s);
        ctx.restore();
      }
    }
    const cr = r * 0.46 * Math.min(1, 0.5 + open);
    ctx.beginPath();
    ctx.arc(0, 0, cr, 0, TAU);
    inked(ctx, "#6b3f22", 1, INK.width * s);
    ctx.fillStyle = "#8a5a2e";
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996; // golden angle
      const d = Math.sqrt(i / 14) * cr * 0.8;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, cr * 0.09, 0, TAU);
      ctx.fill();
    }
  } else if (f.kind === "blossom") {
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate((i / n) * TAU);
      ctx.beginPath();
      // A round petal with a little notch at its tip.
      const pr = r * 0.48 * open;
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        pr * 0.6,
        -pr * 1.1,
        pr * 2.1,
        -pr * 0.9,
        pr * 2,
        -pr * 0.12,
      );
      ctx.lineTo(pr * 1.78, 0);
      ctx.lineTo(pr * 2, pr * 0.12);
      ctx.bezierCurveTo(pr * 2.1, pr * 0.9, pr * 0.6, pr * 1.1, 0, 0);
      inked(ctx, f.color, 1, 2.6 * s);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, TAU);
    inked(ctx, "#ffe066", 1, 2.4 * s);
    ctx.fillStyle = INK.color;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.045, 0, TAU);
      ctx.fill();
    }
  } else {
    // Rose: an outer ring of round petals, then a spiral of darker layers.
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      ctx.beginPath();
      ctx.arc(
        Math.cos(a) * r * 0.5 * open,
        Math.sin(a) * r * 0.5 * open,
        r * 0.46 * open,
        0,
        TAU,
      );
      inked(ctx, f.color, 1, 2.4 * s);
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62 * Math.min(1, 0.4 + open), 0, TAU);
    inked(ctx, shade(f.color, 0.85), 1, 2.4 * s);
    ctx.beginPath();
    for (let a = 0; a < TAU * 2.2; a += 0.2) {
      const d = r * 0.5 * (1 - a / (TAU * 2.4)) * Math.min(1, 0.4 + open);
      if (a === 0) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
      else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.lineWidth = 2.4 * s;
    ctx.strokeStyle = shade(f.color, 0.55);
    ctx.stroke();
  }
  ctx.restore();
};

/** The bud on a growing stem: green, its petals' colour peeking out near the end. */
const drawBud = (ctx: Ctx, f: Flower, near: number, s: number) => {
  const r = f.radius * 0.36 * s;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.6);
  ctx.quadraticCurveTo(-r, -r * 0.3, 0, -r * 1.5);
  ctx.quadraticCurveTo(r, -r * 0.3, 0, r * 0.6);
  inked(ctx, near > 0.6 ? f.color : "#5cc45f", 1, 2.6 * s);
  // Sepals.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.6);
    ctx.quadraticCurveTo(side * r * 0.9, r * 0.2, side * r * 0.45, -r * 0.7);
    ctx.quadraticCurveTo(side * r * 0.2, -r * 0.1, 0, r * 0.6);
    inked(ctx, "#4caf50", 1, 2.2 * s);
  }
};

/** One plant: stem, leaves, root tuft, and the bud or the flower. */
export const drawPlant = (ctx: Ctx, p: Plant, s: number, t: number) => {
  const pts = stemPoints(p);
  if (pts.length < 2) return;
  const green = GREENS[p.green];
  drawStem(ctx, pts, p, green.stem, s);
  // Leaves unfurl as the tip passes them (and fold as it pulls back down).
  const reach = shown(p) * p.length;
  for (let i = 0; i < p.leaves.length; i++) {
    const leaf = p.leaves[i];
    const at = pointAt(pts, p, leaf.at);
    if (!at) continue;
    const u = clamp01((reach - leaf.at * p.length) / 70);
    const flutter = Math.sin(t * 2.2 + p.phase + i) * 0.07;
    const dir = at.dir + leaf.side * (leaf.angle * (0.4 + 0.6 * u)) + flutter;
    drawLeaf(ctx, at.pos, dir, leaf.size * (0.2 + 0.8 * u), green, s);
  }
  const tip = tipPose(pts);
  if (tip) {
    ctx.save();
    ctx.translate(tip.pos.x * s, tip.pos.y * s);
    // Face up, tilting with the stem.
    ctx.rotate((tip.dir + Math.PI / 2) * 0.7);
    const b = bloomAmount(p);
    if (b > 0) drawFlower(ctx, p.flower, b, s, t);
    else drawBud(ctx, p.flower, growth(p), s);
    ctx.restore();
  }
};

/** A tuft of grass over the root, hiding where the stem meets the ground. */
export const drawRootTuft = (ctx: Ctx, p: Plant, s: number) => {
  const { x, y } = p.root;
  const k = p.scale;
  ctx.globalAlpha = 1 - sunk(p);
  for (const [dx, len, lean] of [
    [-7, 14, -0.4],
    [7, 13, 0.4],
    [0, 17, 0.05],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo((x + dx * k - 4) * s, (y + 3) * s);
    ctx.quadraticCurveTo(
      (x + dx * k) * s,
      (y - len * k * 0.5) * s,
      (x + dx * k + Math.sin(lean) * len * k) * s,
      (y - len * k) * s,
    );
    ctx.quadraticCurveTo(
      (x + dx * k + 2) * s,
      (y - len * k * 0.4) * s,
      (x + dx * k + 4) * s,
      (y + 3) * s,
    );
    ctx.closePath();
    inked(ctx, "#7fd35f", s, 2.2);
  }
  ctx.globalAlpha = 1;
};

/** Where the flower will be, while the stem is on its way: a soft dashed ring. */
export const drawTarget = (ctx: Ctx, p: Plant, s: number, t: number) => {
  const g = growth(p);
  if (g >= 1 || p.sink >= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - g);
  ctx.setLineDash([6 * s, 7 * s]);
  ctx.lineDashOffset = -t * 30 * s;
  ctx.beginPath();
  ctx.arc(p.target.x * s, p.target.y * s, p.flower.radius * 0.8 * s, 0, TAU);
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();
};

// ── Butterflies and bees ──────────────────────────────────────────────────

const WING_COLORS = ["#ff9a3c", "#5fa8ff", "#ff7eb9", "#ffd84d", "#9b7bff"];

export const drawCritter = (ctx: Ctx, c: Critter, s: number, t: number) => {
  const resting = c.state === "rest";
  ctx.save();
  ctx.translate(c.pos.x * s, c.pos.y * s);
  ctx.scale(c.facing, 1);
  if (c.kind === "butterfly") {
    // Top view, wings beating (squashed toward the body), slow while resting.
    const beat = Math.abs(Math.cos(t * (resting ? 2.5 : 13) + c.seed));
    const flap = resting ? 0.55 + 0.45 * beat : 0.18 + 0.82 * beat;
    const color = WING_COLORS[Math.floor(c.seed) % WING_COLORS.length];
    ctx.rotate(-0.25 + Math.sin(t * 3 + c.seed) * 0.1);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side * flap, 1);
      ctx.beginPath();
      ctx.ellipse(13 * s, -9 * s, 14 * s, 11 * s, -0.5, 0, TAU);
      inked(ctx, color, s, 2.4);
      ctx.beginPath();
      ctx.ellipse(10 * s, 9 * s, 9 * s, 7.5 * s, 0.6, 0, TAU);
      inked(ctx, shade(color, 0.85), s, 2.4);
      ctx.beginPath();
      ctx.arc(15 * s, -10 * s, 3.6 * s, 0, TAU);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.2 * s, 13 * s, 0, 0, TAU);
    inked(ctx, INK.color, s, 1);
    ctx.beginPath();
    ctx.moveTo(-1.5 * s, -12 * s);
    ctx.quadraticCurveTo(-5 * s, -20 * s, -8 * s, -21 * s);
    ctx.moveTo(1.5 * s, -12 * s);
    ctx.quadraticCurveTo(5 * s, -20 * s, 8 * s, -21 * s);
    ctx.lineWidth = 1.8 * s;
    ctx.strokeStyle = INK.color;
    ctx.stroke();
  } else {
    // Side view: a striped body, buzzing wings.
    const buzz = resting
      ? 0.5 + 0.5 * Math.abs(Math.sin(t * 8))
      : 0.35 + 0.65 * Math.abs(Math.sin(t * 40 + c.seed));
    ctx.rotate(resting ? 0 : Math.sin(t * 9 + c.seed) * 0.15);
    ctx.globalAlpha = 0.85;
    for (const [dx, a] of [
      [-3, -0.5],
      [3, 0.2],
    ] as const) {
      ctx.save();
      ctx.translate(dx * s, -7 * s);
      ctx.rotate(a);
      ctx.scale(1, buzz);
      ctx.beginPath();
      ctx.ellipse(0, -8 * s, 6 * s, 9 * s, 0, 0, TAU);
      inked(ctx, "#eaf6ff", s, 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 * s, 9.5 * s, 0, 0, TAU);
    inked(ctx, "#ffd23a", s, 2.6);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = INK.color;
    ctx.fillRect(-5 * s, -12 * s, 4.5 * s, 24 * s);
    ctx.fillRect(4 * s, -12 * s, 4.5 * s, 24 * s);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-14 * s, 0);
    ctx.lineTo(-19 * s, 1.5 * s);
    ctx.lineTo(-14 * s, 3 * s);
    ctx.fillStyle = INK.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9 * s, -2 * s, 1.9 * s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
};

// ── Hand cursor and pinch pops ─────────────────────────────────────────────

/**
 * Where a pinch would plant: a ring that closes as thumb and index come
 * together, a seed in it once they're close.
 */
export const drawCursor = (
  ctx: Ctx,
  at: Pt,
  ratio: number,
  pinched: boolean,
  s: number,
) => {
  const close = clamp01((0.9 - ratio) / (0.9 - PINCH.closed));
  const r = (30 - 14 * close) * s;
  ctx.save();
  ctx.translate(at.x * s, at.y * s);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.lineWidth = 7 * s;
  ctx.strokeStyle = INK.color;
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3.5 * s;
  ctx.strokeStyle = pinched ? "#ffe066" : "#ffffff";
  ctx.stroke();
  if (close > 0.3) {
    const k = (close - 0.3) / 0.7;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5 * k * s, 7 * k * s, 0.4, 0, TAU);
    inked(ctx, "#a8743f", s, 2);
  }
  ctx.restore();
};

/** A pinch's pop: a ring of little leaves bursting out and fading (`age` s). */
export const drawPop = (ctx: Ctx, at: Pt, age: number, s: number) => {
  const u = clamp01(age / 0.5);
  if (u >= 1) return;
  ctx.save();
  ctx.translate(at.x * s, at.y * s);
  ctx.globalAlpha = 1 - u;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    const d = (12 + 30 * u) * s;
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
    ctx.rotate(a);
    petalPath(ctx, 12 * s, 4.5 * s, 0.6);
    inked(ctx, "#7fd35f", s, 1.8);
    ctx.restore();
  }
  ctx.restore();
};
