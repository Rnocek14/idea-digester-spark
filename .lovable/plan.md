## Surface Polish Sprint — 4 Changes Only

No new features. No backend. No schema. Just four surgical UI fixes to make the homepage feel more human and less dashboard-like.

### Changes

1. **Cap event poster height in Latest feed**
   File: `src/components/StoryCard.tsx`
   Add `max-h-[280px]` (non-featured) and `max-h-[320px]` (featured) to the image container so tall event flyers don't visually outweigh editorial stories.

2. **Rename LIVE → RIGHT NOW and only pulse when incidents exist**
   File: `src/pages/LakeGenevaV2.tsx`
   - Change `[LIVE]` label to `[RIGHT NOW]`.
   - Only show the pulsing red dot when `isActive === true`. When all clear, show a static green dot (no pulse) or hide the dot entirely and just show `All Clear`.

3. **Add one-line editorial greeting above Latest**
   File: `src/pages/LakeGenevaV2.tsx`
   Insert a warm sentence between the view-mode toggle and the lead stories, e.g.:
   `Good morning, Lake Geneva. Here's what locals should know today.`
   Static text, no backend needed.

4. **Remove WelcomeModal entirely**
   File: `src/pages/LakeGenevaV2.tsx`
   Delete the `<WelcomeModal />` JSX at line ~740 and remove its import at line ~22. Keep the `WelcomeModal.tsx` component file intact (unused, but not deleted). The sticky banner and inline CTAs already handle subscribe surfacing.

### Technical Details
- Purely frontend/presentation changes.
- No new dependencies.
- Estimated effort: ~30 minutes.
