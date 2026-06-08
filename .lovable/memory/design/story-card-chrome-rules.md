---
name: Story Card Chrome Rules
description: What StoryCard must never re-add, to keep the feed publication-feel and dense
type: constraint
---
StoryCard MUST NOT show, on the homepage feed:
- A category badge ("NEWS", "EVENTS", etc.) overlaid on the image — category is conveyed by section grouping.
- A "Read full story →" link — the entire card is already the link.
- Inline ShareButtons (Twitter/Facebook icons) on every card — share belongs on the detail page.
- The default "Lake Geneva" geo chip — only show a geo chip when it's an EXCEPTION (Walworth = amber, Wisconsin = slate).
- A separate source line above the timestamp — fold into one quiet meta line: `Source · 3h`.

Story headlines (h3 in cards AND h4 in the "More from today" list) MUST use Playfair Display serif, weight 700, tight leading. Body, deck, and meta stay Inter.

**Why:** Heavy per-card chrome makes the page feel like an RSS aggregator; quiet chrome + serif headlines makes it feel like a local paper. This was a deliberate decision in the Jun 2026 homepage audit — do not regress.
