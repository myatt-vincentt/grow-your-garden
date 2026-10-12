// Wind — pure, unit-tested (wind.test.ts). A swipe makes a gust where the hand
// is; it rolls out across the screen both ways at `SWAY.travel` px/s and pushes
// each place it passes for `SWAY.pulse` seconds (a smooth hump), so plants
// near the hand lean first and the far side of the garden follows.
import { SWAY } from "./config";

export type Gust = {
  /** Where it started (design px), which way it blows, how hard; its age (s). */
  x: number;
  dir: -1 | 1;
  strength: number;
  age: number;
};

/** The gust force at `x` now (signed: + blows right). */
export const windAt = (gusts: readonly Gust[], x: number): number => {
  let f = 0;
  for (const g of gusts) {
    const local = g.age - Math.abs(x - g.x) / SWAY.travel;
    if (local > 0 && local < SWAY.pulse)
      f += g.dir * g.strength * Math.sin((Math.PI * local) / SWAY.pulse);
  }
  return f;
};

/** Age the gusts; drop those that have crossed a `w`-wide screen. */
export const stepGusts = (gusts: Gust[], dt: number, w: number) => {
  for (const g of gusts) g.age += dt;
  const done = w / SWAY.travel + SWAY.pulse;
  for (let i = gusts.length - 1; i >= 0; i--)
    if (gusts[i].age > done) gusts.splice(i, 1);
};
