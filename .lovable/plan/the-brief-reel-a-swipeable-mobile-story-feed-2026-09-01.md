# The Brief Reel — a swipeable mobile story feed

A full-screen, flick-through story experience for phones. One story at a time: photo, headline, the short local summary, and a save button. Swipe up for the next one, tap to read the full story. Saved stories live on the phone — no login.

## What the reader gets

- A "Swipe the Brief" entry point on the mobile homepage (a card at the top of the feed) plus a direct URL at `/reel`.
- Full-screen cards, one per story, in the same locally-ranked order the homepage already uses (Lake Geneva first, then Walworth, freshness-weighted).
- Each card shows: image, geo pill (Lake Geneva / Walworth), category, headline, summary, source and time.
- Gestures: swipe up = next story, swipe down = previous, tap the card = open the full story page, swipe right = save.
- A heart/bookmark button on every card for readers who'd rather tap than swipe. Saving shows a brief confirmation.
- A progress rail down the side so you know how deep you are, and an end card ("You're caught up") linking to the Shore Path guide, Eats, and the newsletter signup.
- Desktop keeps the current homepage untouched; the reel entry only appears on phones.

## Saved stories

- Stored on the device (no account, nothing to sign up for), keyed to the same anonymous session ID the site already uses.
- A `/saved` page listing saved stories with a remove action, reachable from the reel and from the mobile header.
- Empty state points back into the reel.

## Technical notes

- New `src/pages/StoryReel.tsx` and `src/pages/SavedStories.tsx`, routed in `src/App.tsx` (lazy-loaded, matching the existing split).
- Reuse the existing homepage feed query by extracting it from `LakeGenevaV2.tsx` into a shared `useLocalFeed` hook so the reel and homepage always agree on ranking; no changes to the query filters, tiers, or scoring.
- Vertical paging via CSS scroll-snap (`snap-y snap-mandatory`, one viewport-height panel per story) with a light touch handler for the horizontal save swipe. No new dependencies; `embla-carousel-react` is already available if snap proves rough on iOS Safari.
- Saves in `localStorage` behind `src/lib/savedStories.ts` (add / remove / list / subscribe), storing id, title, image, and slug so `/saved` renders without a refetch.
- Existing `trackStoryEvent` fires on card view, save, and tap-through so reel engagement shows up in Content Analytics.
- `PageMeta` on both routes; `/reel` and `/saved` marked `noindex` (they're app surfaces, not content pages) so nothing dilutes the guide SEO.
- Respect `prefers-reduced-motion`; 44px minimum touch targets per the design baseline.

## Not in this pass

Accounts, cross-device sync, passport/streak integration, and horizontal section swiping — all deferred until we see whether readers use the reel.
