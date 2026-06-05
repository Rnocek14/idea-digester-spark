## The problem

Today the map markers are click-only. A click yanks you to the bottom of the page, the map scrolls out of view, and you lose track of *which* number you tapped. There's also no way to "preview" a stop before committing to scroll.

## Design goals

1. **Peek before you leap** — see a stop's name + one-line description without leaving the map.
2. **Don't lose your place** — when you do jump to a stop, keep the map visible and visually mark which stop you came from.
3. **Same behavior on touch** — phones don't have hover, so the peek has to work on tap too.

## What I'll build

### 1. Marker peek card (desktop hover + mobile tap)

Replace the current `<title>` browser tooltip with a real floating card anchored to the marker.

Contents of the peek card:
- `Stop {n} · {community}` eyebrow
- Stop **name** (bold)
- 1–2 sentence excerpt from `description` (truncated to ~140 chars)
- Optional `Mile {approx_mile}` chip if present
- Primary action: **"Jump to this stop ↓"** (smooth scroll + highlight)
- Secondary action: **"Start walk from here →"** (opens Walking Mode at this index)

Interaction model:
- **Desktop**: hover marker → card fades in after ~150ms, anchored above/below depending on space. Moving to the card keeps it open; leaving both closes it.
- **Mobile**: tap marker → card opens; tap outside or the X to close. Tap again on same marker = close. This replaces the immediate scroll-on-tap, which is the root of the "I forgot which one I picked" problem.
- Keyboard: markers become focusable buttons; Enter/Space opens the peek; Esc closes.

### 2. Sticky map on scroll (desktop only)

On screens ≥ `lg`, when the user clicks "Jump to this stop", the hero map collapses into a slim sticky strip at the top of the viewport showing:
- A mini version of the same lake silhouette
- The currently-active marker pulsing
- "Stop 7 of 16 · South Shore Path Stretch" label
- A small "Back to full map ↑" link

This keeps the user oriented even after they've scrolled into the stop list. On mobile it stays inline (sticky maps eat too much screen).

### 3. "Active stop" highlighting

When you click a marker, the corresponding stop card in the list below gets:
- A brief 1.5s amber ring animation on arrival (so your eye lands on it)
- Persistent left-border accent matching the active marker color while it's the most recently selected

This costs almost nothing and solves the "which one did I pick again?" feeling.

### 4. Small polish

- Markers get a subtle `aria-label` ("Stop 7: South Shore Path Stretch") for screen readers.
- The peek card uses the existing shadcn `HoverCard` for desktop and a lightweight `Popover` for touch, so styling stays consistent with the rest of the site.
- Description text in the peek is pulled from the same `description` field already on `shore_path_stops` — no schema changes, no migrations.

## Files touched

- `src/components/shore-path/ShorePathMap.tsx` — markers become buttons; integrate HoverCard/Popover; emit `onMarkerHover` and `onMarkerSelect` separately so the page can decide whether to scroll.
- `src/components/shore-path/StopPeekCard.tsx` — **new** small presentational component for the peek body.
- `src/components/shore-path/StickyMapStrip.tsx` — **new** slim sticky map for desktop, hidden on mobile.
- `src/pages/guides/LakeGenevaShorePath.tsx` — wire up active-stop state, sticky strip, and the arrival highlight animation on the stop list.

## Out of scope (intentionally)

- No DB schema changes.
- No new marker coordinates.
- No changes to Walking Mode itself — only adding an entry point to it from the peek card.
- No global header changes.

## Open question for you

Do you want **tap-once-to-peek, tap-again-to-jump** on mobile (safer, two-step), or **tap-to-peek with an explicit "Jump" button inside the card** (one tap + one tap, but more obvious)? My recommendation is the second — it's more discoverable and matches how Google Maps pins behave. I'll go with that unless you say otherwise.
