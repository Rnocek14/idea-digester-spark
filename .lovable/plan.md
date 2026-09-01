# The Dot Field — thumb-scrub navigation

A new full-screen way to move through the day's brief: a field of dots you drag your thumb across in any direction. Whichever dot is under your thumb lights up, the phone gives a tiny tap, and that story's preview floats above your hand. Lift off to open it.

## What it feels like

- Open `/field` (a "Feel the Brief" card on the mobile homepage, plus a switch on the reel's top bar).
- The screen is a loose grid of dots — one per story in today's run, laid out in rows that fill the thumb zone rather than a single line.
- Put a thumb down anywhere. The nearest dot becomes the selection: it swells, gets a soft halo, and neighbours nudge slightly away, like a magnet under a sheet.
- Slide in any direction. Each time the selection crosses to a new dot you get one short haptic tap (10ms) plus a subtle scale pulse. Fast scrubbing across many dots gives that ribbed, "running your thumb over a comb" feeling.
- A preview card floats above the field the whole time you're touching: geo label, headline, 2-line summary, source and time. It follows the selection instantly, no fade-in lag, and repositions so your thumb never covers it.
- Lift your thumb on a dot to open that story. Drag off the field's edge (or press the X) to cancel without opening.
- Colour still carries locality — blue Lake Geneva, amber Walworth, slate wider Wisconsin — so the field itself shows how local today's brief is. Stories you've already read are solid; unread are faded.

## Details that make it Apple-like

- Selection follows a spring, not the raw finger: the halo eases into the dot, so the motion feels weighted.
- Haptics fire only on dot change, never continuously, and never twice for the same dot.
- Reduce-motion: no springs or pulses, preview swaps instantly, haptics still fire.
- Devices without vibration (iPhone Safari, desktop) simply lose the tap; everything else is unchanged.
- Keyboard and screen readers get the same content as a plain list with arrow-key movement.

## Where it lives

- New route `/field`, noindexed like the reel and saved pages.
- Mobile homepage: a "Feel the Brief" entry card next to the existing "Swipe the Brief" card.
- Reel top bar: a small toggle to jump between reel and field, keeping the same story run.
- Desktop: `/field` shows the reel instead, since the interaction is thumb-only.

## Technical notes

- New `src/pages/DotField.tsx` plus `src/components/DotFieldCanvas.tsx`. Feed comes from the existing `useLocalFeed` hook, so the field, reel and homepage stay in sync.
- Layout: dots positioned absolutely from a computed grid (columns based on viewport width, ~44px pitch so hit areas stay comfortable), measured once per resize into a ref array of centres.
- Hit testing on `pointermove` against the cached centres (nearest centre within a radius), not DOM hit tests — keeps the scrub at 60fps. Single `pointerdown`/`move`/`up`/`cancel` set on the container with `touch-action: none` so the page never scrolls under the thumb.
- Haptics: `navigator.vibrate(10)` guarded by a capability check, fired only when the selected index changes. No library.
- Locality palette and labels keep coming from `StoryDots.tsx` (`GEO_PILL`, `geoTierKey`) — no duplicated colour maps.
- Read state reuses the same per-session approach as the reel (component state seeded from stories already seen). No new storage, no schema changes.
- Analytics: dot selections are not tracked (too noisy); a lift-to-open fires the existing `trackStoryEvent` `homepage_click` with `metadata.surface: "dot_field"` and the position.
- Existing dot row, reel and swipe-to-save behaviour are untouched.
