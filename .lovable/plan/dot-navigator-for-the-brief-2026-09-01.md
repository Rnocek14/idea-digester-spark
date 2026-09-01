# Dot Navigator for the Brief

A row of small dots — one per story in today's run — sits directly under the top bar. Each dot is a story. Tap to jump, press and hold to peek at the headline, and the colors tell you how local today's brief actually is.

Verdict: this fits local news better than it fits chat. A daily brief is a finite, ordered run of 8–30 stories, so a dot per story is honest — you can see the whole day at a glance and know when you're near the end. That's the piece the current reel is missing (it has a thin rail, but it's hidden on phones and does nothing when tapped).

## What it looks like

```text
 [X]      Swipe the Brief      [bookmark]
   ● ● ● ○ ○ ◐ ○ ○ ○ ○ ○ ○
   blue  amber   grey
   read     current     unread
```

- Dots are 6px, 10px apart, in a single centered row under the header. On long runs the row scrolls sideways and keeps the active dot centered.
- Color = locality: blue for Lake Geneva, amber for Walworth County, grey for wider Wisconsin. Same palette as the geo pills already on the cards.
- Read state: stories you've passed are solid; ones ahead are faded to 30%. The current dot is larger with a soft ring.
- Press and hold: a small dark card floats above the dots with the headline and the geo label. Lift off to jump there, drag off to cancel.
- Tapping a dot scroll-snaps to that story (instant when reduce-motion is on).
- Whole row is a tab-list for keyboard and screen readers: arrow keys move between stories, each dot announces "Story 4 of 12, Lake Geneva, [headline]".

## Where it appears

**Reel (`/reel`)** — replaces the current hidden right-side rail. Always visible under the top bar.

**Mobile homepage** — a matching row pinned just below the site header, appearing once you scroll past the hero and covering the same ranked story run. Tapping scrolls the page to that story card. Hidden on desktop and when there are fewer than four stories. Read state comes from which cards you've actually scrolled past.

## Technical notes

- New `src/components/StoryDots.tsx`: presentational, takes `stories`, `activeIndex`, `readIds`, `onJump`. Locality color from `geo_tier`, matching the existing `GEO_PILL` map, which moves into the component so the reel and homepage can't drift.
- Peek uses a pointer-down timer (~350ms) with pointer-cancel cleanup, no library. Suppresses the jump if the hold fired.
- Reel: `StoryReel.tsx` already tracks `activeIndex` via IntersectionObserver — reuse it, delete the `sm:flex` rail, and scroll by index with `scrollIntoView` on the card node.
- Homepage: a small `useActiveStoryIndex` hook observes the rendered `StoryCard` wrappers in `LakeGenevaV2.tsx` and reports the topmost visible one; jump scrolls with a header offset.
- Read state is per-session in component state on both surfaces, seeded from stories already marked seen in the reel. No new storage, no schema changes.
- Analytics: a dot jump fires the existing `trackStoryEvent` `homepage_click` with `metadata.surface: "dots"` and the target position, so we can see whether people navigate or just scroll.
