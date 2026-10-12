// Sound effects, through the SDK's sound engine (silent-switch safe, muted by
// default; the speaker button's tap is the gesture that unlocks iOS audio).
// The clips are synthesised for this project (public/sounds/*.m4a).
import { playOneShot, registerSound } from "@vincentt-xr/sdk";

export const SOUNDS = {
  plant: "/sounds/plant.m4a",
  bloom1: "/sounds/bloom1.m4a",
  bloom2: "/sounds/bloom2.m4a",
  bloom3: "/sounds/bloom3.m4a",
  bloom4: "/sounds/bloom4.m4a",
  wind: "/sounds/wind.m4a",
  reset: "/sounds/reset.m4a",
} as const;

export type SoundName = keyof typeof SOUNDS;

/** Buffer every clip so the first unmute is instant. */
export const loadSounds = () =>
  Promise.all(Object.values(SOUNDS).map((url) => registerSound(url)));

/** Play a clip (a no-op while muted). */
export const play = (name: SoundName) => {
  playOneShot(SOUNDS[name]);
};

const BLOOMS = ["bloom1", "bloom2", "bloom3", "bloom4"] as const;

/** A bloom chime: a random note of a pentatonic set, so blooms make a tune. */
export const playBloom = () => {
  play(BLOOMS[Math.floor(Math.random() * BLOOMS.length) % BLOOMS.length]);
};
