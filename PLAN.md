# Plan — Grow Your Garden

Pinch in the air; a plant grows from the ground up to the pinch and blooms. Built 2026-10-12.

## Decisions (the user's)

- Stems root in the ground band along the bottom of the screen, under the pinch.
- One pinch is enough: the plant grows by itself (no holding).
- Flat illustrated 2D style (solid fills, one dark ink outline).
- Extras: an open-palm swipe makes the plants sway like wind; a floating reset button in the
  HUD; butterflies and bees; sounds.
- As many plants as you like (a soft cap of 70 keeps phones smooth: past it the oldest pulls
  back into the ground).

## How it works

- **Hands** (`hands.ts`, pure): per hand, per frame, in design px.
  - Pinch = thumb tip to index tip under 0.3 palm sizes (hysteresis: open again past 0.48),
    held for 0.06 s, with the index reaching out (≥ 1 palm from the wrist — a fist or a
    thumbs-up curls it in and can bring the tips close). Plants at the point between the tips.
    A hand that arrives pinched doesn't plant until it opens.
  - Swipe = open palm (SDK `measureOpenPalm` ≥ 0.7) moving sideways faster than 1.1 screen
    widths / s (smoothed) → a gust that way, stronger the faster.
  - Hands are matched to their tracks by position (`matchHands`), not by the tracker's
    left / right label, which can swap between frames (that made one "hand" jump across the
    screen and read as a swipe). A palm jumping > 30 % of the width in a frame starts over.
- **Plants** (`plant.ts`, pure): root in the ground band under the pinch (random depth: deeper
  = nearer = bigger, drawn on top); stem = a cubic Bézier rising out of the soil, bowing to a
  random side, arriving from below, plus an S-wiggle, sampled into 40 points with arc lengths.
  Grows fast then eases in (time grows with length); leaves unfurl as the tip passes; at the
  tip a bud, then the flower opens with a little overshoot. Sway: a damped spring bending the
  stem about its root (more bend higher up), toward an idle breeze, pushed by gusts. Reset:
  the flower closes, then the stem pulls back down into its root.
- **Wind** (`wind.ts`, pure): a gust starts at the hand and rolls across the screen both ways
  at 1500 px/s, pushing each place it passes for 0.45 s — near plants lean first.
- **Butterflies and bees** (`critters.ts`, pure): one butterfly per 2 bloomed flowers (max 5),
  one bee per 3 (max 4); fly in from the sides, steer to a flower with a flutter (lazy loops /
  quick zigzag), rest on it, move on; gusts blow them off; with no flowers they leave.
- **Engine** (`engine.ts`, pure): plants + wind + critters stepped together; plant / gust /
  reset in.
- **Drawing** (`draw.ts`, `Garden.tsx`): one 2D canvas, redrawn every frame, shown as a
  full-screen clip-space quad (renderOrder 50) over the camera. Ground band painted once per
  screen size; grass tufts lean with the wind; plants back to front; a dashed ring marks where
  a flower will bloom while its stem is on the way; pinch pops; a hand cursor that closes as
  you pinch.
- **HUD** (`Hud.tsx`): hint pill (hold up a hand → pinch to plant → after 3 blooms, swipe for
  wind), speaker (muted by default for iOS), floating reset button.
- **Sound** (`sound.ts`): synthesised clips — plant bloop, four pentatonic bloom chimes (so
  several blooms make a tune), wind, reset.

## Notes

- `Garden.tsx` and the engine can't share a name that differs only in case (`garden.ts`):
  macOS's case-insensitive file system breaks `tsc`. Hence `engine.ts`.
- The dev media switcher's full-screen overlay must be click-through, or it swallows taps on
  the HUD buttons in a camera-less browser.
